import { PublicKey, type Connection } from "@solana/web3.js";
import { DUST_LAMPORTS, PROGRAM_IDS, type ParsedTxLike } from "./counterparties";
import { getParsedTransaction, mapWithConcurrency, toTxLike } from "./history";
import type { RiskReport } from "./risk";
import type { AddressReputation, ReputationVerdict } from "./types";

const SIGNATURE_WINDOW = 100;
const PARSE_SAMPLE = 80;
const REPUTATION_CONCURRENCY = 8;

export interface ReputationProfileInput {
  sampled: number;
  outbound: number;
  inbound: number;
  dustOut: number;
  distinctRecipients: number;
  failed: number;
  elapsedMs: number;
  firstSeen: number | null;
  lastSeen: number | null;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

/**
 * Pure classifier so the rules are testable without touching the network.
 * A poisoner's public history is overwhelmingly one-way tiny transfers to many
 * wallets, with almost no inflows of its own.
 */
export function classifyReputation(input: ReputationProfileInput): AddressReputation {
  const dustShare = input.outbound > 0 ? input.dustOut / input.outbound : 0;
  const base = {
    sampled: input.sampled,
    outbound: input.outbound,
    inbound: input.inbound,
    dustOut: input.dustOut,
    dustShare,
    distinctRecipients: input.distinctRecipients,
    failed: input.failed,
    elapsedMs: input.elapsedMs,
    firstSeen: input.firstSeen,
    lastSeen: input.lastSeen,
  };

  let verdict: ReputationVerdict = "active";

  if (input.sampled === 0) {
    verdict = "unknown";
  } else if (
    input.dustOut >= 3 &&
    input.distinctRecipients >= 3 &&
    dustShare >= 0.3 &&
    input.inbound <= Math.max(2, Math.floor(input.outbound * 0.3))
  ) {
    verdict = "dust-fanout";
  } else if (input.dustOut >= 2 && input.distinctRecipients >= 2 && dustShare >= 0.2) {
    verdict = "dust-sender";
  } else if (input.outbound === 0 && input.inbound === 0) {
    verdict = "quiet";
  }

  const summary =
    verdict === "unknown"
      ? "No recent public history was returned for this address."
      : verdict === "dust-fanout"
        ? `Sent ${input.dustOut} dust transfers to ${input.distinctRecipients} different wallets and received almost nothing back.`
        : verdict === "dust-sender"
          ? `${input.dustOut} of ${input.outbound} outgoing transfers were dust to ${input.distinctRecipients} ${plural(
              input.distinctRecipients,
              "wallet",
            )}.`
          : verdict === "quiet"
            ? "No recent SOL movement in the sampled window."
            : `${input.outbound} outgoing and ${input.inbound} incoming transfers with no dust pattern.`;

  return {
    address: "",
    verdict,
    summary,
    ...base,
  };
}

export async function fetchAddressReputation(
  connection: Connection,
  address: string,
  options: { signal?: AbortSignal } = {},
): Promise<AddressReputation> {
  const startedAt = Date.now();
  const owner = new PublicKey(address);

  const signatures = await connection.getSignaturesForAddress(owner, {
    limit: SIGNATURE_WINDOW,
  });
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const targets = signatures.filter((entry) => !entry.err).slice(0, PARSE_SAMPLE);
  let failed = 0;

  const transactions = await mapWithConcurrency(
    targets,
    REPUTATION_CONCURRENCY,
    async (entry) => {
      try {
        const tx = await getParsedTransaction(connection, entry.signature);
        return tx ? toTxLike(tx) : null;
      } catch {
        failed += 1;
        return null;
      }
    },
  );

  let outbound = 0;
  let inbound = 0;
  let dustOut = 0;
  let firstSeen: number | null = null;
  let lastSeen: number | null = null;
  const recipients = new Set<string>();
  let sampled = 0;

  for (const tx of transactions) {
    if (!tx?.meta || tx.meta.err) continue;
    sampled += 1;

    if (tx.blockTime) {
      if (firstSeen === null || tx.blockTime < firstSeen) firstSeen = tx.blockTime;
      if (lastSeen === null || tx.blockTime > lastSeen) lastSeen = tx.blockTime;
    }

    const keys = tx.transaction.message.accountKeys;
    const index = keys.findIndex((key) => key.pubkey === address);
    if (index < 0) continue;

    const delta = tx.meta.postBalances[index] - tx.meta.preBalances[index];
    if (delta > 0) inbound += 1;

    if (delta < 0) {
      outbound += 1;
      let moved = 0;
      const touched = new Set<string>();
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i].pubkey;
        if (key === address || PROGRAM_IDS.has(key)) continue;
        const gain = tx.meta.postBalances[i] - tx.meta.preBalances[i];
        if (gain > 0) {
          moved += gain;
          touched.add(key);
        }
      }
      if (touched.size > 0) {
        for (const key of touched) recipients.add(key);
        if (moved > 0 && moved <= DUST_LAMPORTS) dustOut += 1;
      }
    }
  }

  const profile = classifyReputation({
    sampled,
    outbound,
    inbound,
    dustOut,
    distinctRecipients: recipients.size,
    failed,
    elapsedMs: Date.now() - startedAt,
    firstSeen,
    lastSeen,
  });

  return { ...profile, address };
}

const SEVERITY: Record<RiskReport["verdict"], number> = {
  invalid: -1,
  self: -1,
  exact: -1,
  unknown: 0,
  safe: 0,
  suspicious: 1,
  "high-risk": 2,
};

/**
 * A poisoner's own history can raise a verdict, but never clears one and never
 * overrides an address the user has actually paid.
 */
export function applyReputation(
  report: RiskReport,
  reputation: AddressReputation | null,
): RiskReport {
  if (!reputation) return report;
  const withNetwork = { ...report, network: reputation };

  if (report.verdict === "invalid" || report.verdict === "self" || report.verdict === "exact") {
    return withNetwork;
  }

  const escalate: RiskReport["verdict"] | null =
    reputation.verdict === "dust-fanout"
      ? "high-risk"
      : reputation.verdict === "dust-sender"
        ? "suspicious"
        : null;

  if (!escalate || SEVERITY[escalate] <= SEVERITY[report.verdict]) {
    return withNetwork;
  }

  const evidence = `${reputation.dustOut} dust transfers to ${reputation.distinctRecipients} ${plural(
    reputation.distinctRecipients,
    "wallet",
  )} and ${reputation.inbound} ${plural(reputation.inbound, "inflow")} in its own public history.`;

  return {
    ...withNetwork,
    verdict: escalate,
    score: Math.max(report.score, escalate === "high-risk" ? 92 : 62),
    headline:
      escalate === "high-risk"
        ? "This address behaves like a dust poisoner"
        : "This address mostly sends dust",
    summary:
      escalate === "high-risk"
        ? `Independent of your wallet: ${evidence} That one-way dust pattern is how poisoning addresses build history and get copied.`
        : `Independent of your wallet, ${evidence} Verify the full address with the recipient before sending.`,
    reasons: [
      `Public history: ${evidence}`,
      ...report.reasons,
    ],
  };
}
