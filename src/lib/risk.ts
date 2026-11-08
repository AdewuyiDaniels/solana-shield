import { isValidSolanaAddress, normalizeAddress, shortAddress } from "./address";
import { diffAgainst, type AddressDiff } from "./similarity";
import type { Counterparty } from "./types";

export type Verdict = "safe" | "suspicious" | "high-risk" | "exact" | "self" | "invalid";
export type MatchVerdict = "exact" | "high-risk" | "suspicious" | "weak";

export interface MatchDetail {
  address: string;
  label?: string;
  interactions: number;
  lastSeen: number | null;
  prefix: number;
  suffix: number;
  sameLength: boolean;
  differingMiddle: number;
  score: number;
  verdict: MatchVerdict;
}

export interface RiskReport {
  verdict: Verdict;
  score: number;
  headline: string;
  summary: string;
  reasons: string[];
  candidate: string;
  best: MatchDetail | null;
  matches: MatchDetail[];
  comparedAgainst: number;
}

export const HIGH_RISK_ANCHOR = 4;
const SUSPICIOUS_SCORE_FLOOR = 42;

function classifyPair(prefix: number, suffix: number): MatchVerdict {
  if (prefix >= HIGH_RISK_ANCHOR && suffix >= HIGH_RISK_ANCHOR) return "high-risk";
  if (
    (prefix >= 3 && suffix >= 3) ||
    prefix >= 5 ||
    suffix >= 5 ||
    prefix + suffix >= 8
  ) {
    return "suspicious";
  }
  return "weak";
}

function pairScore(prefix: number, suffix: number, verdict: MatchVerdict): number {
  const raw = prefix * 9 + suffix * 9;
  if (verdict === "high-risk") return Math.max(88, Math.min(99, raw));
  if (verdict === "suspicious") return Math.max(SUSPICIOUS_SCORE_FLOOR, Math.min(74, raw));
  return Math.min(30, raw);
}

function toMatch(reference: Counterparty, diff: AddressDiff): MatchDetail {
  const verdict = classifyPair(diff.prefix, diff.suffix);
  return {
    address: reference.address,
    label: reference.label,
    interactions: reference.interactions,
    lastSeen: reference.lastSeen,
    prefix: diff.prefix,
    suffix: diff.suffix,
    sameLength: diff.sameLength,
    differingMiddle: diff.differingMiddle,
    score: pairScore(diff.prefix, diff.suffix, verdict),
    verdict,
  };
}

const RANK: Record<MatchVerdict, number> = {
  exact: 4,
  "high-risk": 3,
  suspicious: 2,
  weak: 1,
};

function compareMatches(a: MatchDetail, b: MatchDetail): number {
  return (
    RANK[b.verdict] - RANK[a.verdict] ||
    b.score - a.score ||
    b.prefix + b.suffix - (a.prefix + a.suffix) ||
    b.interactions - a.interactions
  );
}

function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

function emptyReport(candidate: string, comparedAgainst: number): RiskReport {
  return {
    verdict: "invalid",
    score: 0,
    headline: "",
    summary: "",
    reasons: [],
    candidate,
    best: null,
    matches: [],
    comparedAgainst,
  };
}

export function evaluateAddress(
  input: string,
  known: Counterparty[],
  ownWallet?: string | null,
): RiskReport {
  const candidate = normalizeAddress(input);
  const comparedAgainst = known.length;

  if (!candidate) {
    return {
      ...emptyReport(candidate, comparedAgainst),
      headline: "Paste an address to check",
      summary:
        "Solana Shield compares a destination address against every counterparty in your recent transaction history.",
    };
  }

  if (!isValidSolanaAddress(candidate)) {
    return {
      ...emptyReport(candidate, comparedAgainst),
      headline: "Not a valid Solana address",
      summary:
        "That is not a base58-encoded 32-byte public key. A real Solana address is 32–44 characters long.",
      reasons: ["A truncated paste or one extra character is the usual cause."],
    };
  }

  if (ownWallet && candidate === ownWallet) {
    return {
      ...emptyReport(candidate, comparedAgainst),
      verdict: "self",
      headline: "This is your own wallet",
      summary: "You are about to send to yourself, not to a counterparty.",
      reasons: ["Double-check the amount and the token mint before signing."],
    };
  }

  const exact = known.find((entry) => entry.address === candidate);
  if (exact) {
    const best = toMatch(exact, diffAgainst(candidate, exact.address));
    best.verdict = "exact";
    best.score = 0;
    return {
      verdict: "exact",
      score: 0,
      headline: "Known address — exact match",
      summary: `This exact address is already in your recent history${
        exact.interactions > 1 ? ` (${exact.interactions} interactions)` : ""
      }.`,
      reasons: [
        "Every character matches a counterparty you have used before.",
        "Still confirm the asset and the amount before you sign.",
      ],
      candidate,
      best,
      matches: [best],
      comparedAgainst,
    };
  }

  const matches = known
    .map((entry) => toMatch(entry, diffAgainst(candidate, entry.address)))
    .sort(compareMatches);

  const best = matches[0] ?? null;

  if (!best || best.verdict === "weak") {
    return {
      verdict: "safe",
      score: best ? Math.min(30, best.score) : 0,
      headline: "No lookalike detected",
      summary:
        comparedAgainst === 0
          ? "There is no recent counterparty history to compare against yet. Use demo mode or connect a wallet with activity."
          : `Compared against ${comparedAgainst} recent ${plural(
              comparedAgainst,
              "counterparty",
              "counterparties",
            )}. None of them shares this address's opening and closing characters.`,
      reasons:
        comparedAgainst === 0
          ? [
              "A brand-new address always looks new. Check the first and last characters against the source yourself.",
            ]
          : [
              "No known counterparty matches both the start and the end of this address.",
              "This does not prove the address is legitimate — confirm it with the recipient.",
            ],
      candidate,
      best,
      matches: matches.slice(0, 3),
      comparedAgainst,
    };
  }

  const anchor = shortAddress(best.address, 6);

  if (best.verdict === "high-risk") {
    return {
      verdict: "high-risk",
      score: Math.max(88, best.score),
      headline: "High risk — likely a poisoned lookalike",
      summary: `This address mimics ${anchor}, an address you have already used. The opening and closing characters match; only the middle differs.`,
      reasons: [
        `Shares its first ${best.prefix} and last ${best.suffix} characters with ${anchor}.`,
        `Only ${best.differingMiddle} ${plural(
          best.differingMiddle,
          "character differs",
          "characters differ",
        )} in the middle. A real random address would never line up like this.`,
        best.sameLength
          ? "Both addresses have the same length, which is why they look identical at a glance."
          : "The lengths differ slightly, but the visible ends still look identical.",
        `You have transacted with ${anchor} ${best.interactions} ${plural(
          best.interactions,
          "time",
        )}.`,
        "You have never transacted with this exact address.",
      ],
      candidate,
      best,
      matches: matches.slice(0, 3),
      comparedAgainst,
    };
  }

  return {
    verdict: "suspicious",
    score: best.score,
    headline: "Suspicious — verify before sending",
    summary: `This address is unusually close to ${anchor}. It shares part of the visible prefix and suffix, but not both full anchors.`,
    reasons: [
      `Shares its first ${best.prefix} and last ${best.suffix} characters with ${anchor}.`,
      `This is weaker than the classic 4-and-4 poison pattern, but still unlikely to happen by chance.`,
      "Ask the recipient to confirm the full address out-of-band before you send.",
    ],
    candidate,
    best,
    matches: matches.slice(0, 3),
    comparedAgainst,
  };
}
