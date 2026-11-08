import { describe, expect, it } from "vitest";
import { decodeBase58, encodeBase58 } from "./base58";
import {
  decodeAddress,
  isValidSolanaAddress,
  normalizeAddress,
  shortAddress,
} from "./address";
import { commonPrefixLength, commonSuffixLength, diffAgainst } from "./similarity";
import { evaluateAddress, findHistoryLookalikes } from "./risk";
import {
  mulberry32,
  generatedAddress,
  makeLookalike,
  getDemoBundle,
} from "./demo";
import { extractCounterparties, PROGRAM_IDS, type ParsedTxLike } from "./counterparties";
import { formatSolPrecise } from "./format";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

describe("base58", () => {
  it("round-trips 32-byte keys", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 25; i += 1) {
      const address = generatedAddress(rng);
      const bytes = decodeBase58(address);
      expect(bytes).not.toBeNull();
      expect(bytes?.length).toBe(32);
      expect(encodeBase58(bytes as Uint8Array)).toBe(address);
    }
  });

  it("validates real Solana addresses", () => {
    expect(isValidSolanaAddress("So11111111111111111111111111111111111111112")).toBe(true);
    expect(isValidSolanaAddress("11111111111111111111111111111111")).toBe(true);
    expect(decodeAddress("So11111111111111111111111111111111111111112")?.length).toBe(32);
  });

  it("rejects bad input", () => {
    expect(isValidSolanaAddress("")).toBe(false);
    expect(isValidSolanaAddress("not-an-address")).toBe(false);
    expect(isValidSolanaAddress("0OIl")).toBe(false);
    expect(isValidSolanaAddress("So1111111111111111111111111111111111111111")).toBe(false);
  });

  it("normalizes solana pay urls and whitespace", () => {
    const raw = "  solana:So11111111111111111111111111111111111111112?amount=1  ";
    expect(normalizeAddress(raw)).toBe("So11111111111111111111111111111111111111112");
  });

  it("shortens addresses", () => {
    expect(shortAddress("So11111111111111111111111111111111111111112", 4)).toBe("So11…1112");
  });
});

describe("similarity", () => {
  it("counts common prefix and suffix", () => {
    expect(commonPrefixLength("abcdef", "abczzz")).toBe(3);
    expect(commonSuffixLength("abcdef", "zzzdef")).toBe(3);
    expect(commonPrefixLength("abc", "abc")).toBe(3);
    expect(commonSuffixLength("abc", "abc", 0)).toBe(0);
  });

  it("does not double-count the shared prefix in the suffix", () => {
    const diff = diffAgainst("abc", "abc");
    expect(diff.prefix).toBe(3);
    expect(diff.suffix).toBe(0);
  });

  it("masks only the differing middle", () => {
    const reference = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosg9AsU";
    const candidate = "7xKXAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9AsU";
    const diff = diffAgainst(candidate, reference);
    expect(diff.prefix).toBe(4);
    expect(diff.suffix).toBe(4);
    expect(diff.candidateMask.slice(0, 4).every(Boolean)).toBe(true);
    expect(diff.candidateMask.slice(-4).every(Boolean)).toBe(true);
    expect(diff.candidateMask[10]).toBe(false);
  });
});

describe("risk engine", () => {
  const rng = mulberry32(42);
  const real = generatedAddress(rng);
  const poison = makeLookalike(real, rng, 4, 4);
  const known = [{ address: real, interactions: 12, lastSeen: 1_700_000_000 }];

  it("flags a 4-and-4 lookalike as high risk", () => {
    const report = evaluateAddress(poison, known);
    expect(isValidSolanaAddress(poison)).toBe(true);
    expect(report.verdict).toBe("high-risk");
    expect(report.best?.address).toBe(real);
    expect(report.best?.prefix).toBeGreaterThanOrEqual(4);
    expect(report.best?.suffix).toBeGreaterThanOrEqual(4);
    expect(report.score).toBeGreaterThanOrEqual(88);
  });

  it("treats the real address as an exact match, not a threat", () => {
    const report = evaluateAddress(real, known);
    expect(report.verdict).toBe("exact");
    expect(report.score).toBe(0);
  });

  it("detects sending to yourself", () => {
    const report = evaluateAddress(real, known, real);
    expect(report.verdict).toBe("self");
  });

  it("rejects invalid addresses", () => {
    expect(evaluateAddress("", known).verdict).toBe("invalid");
    expect(evaluateAddress("0OIl0OIl", known).verdict).toBe("invalid");
  });

  it("stays safe for an unrelated address", () => {
    const unrelated = generatedAddress(mulberry32(999));
    const report = evaluateAddress(unrelated, known);
    expect(report.verdict).toBe("safe");
    expect(report.score).toBeLessThan(40);
  });

  it("never reports a 3-and-3 lookalike as safe", () => {
    let report = null as ReturnType<typeof evaluateAddress> | null;
    for (let attempt = 0; attempt < 80 && !report; attempt += 1) {
      const candidate = makeLookalike(real, rng, 3, 3);
      if (candidate === real) continue;
      const next = evaluateAddress(candidate, known);
      if (next.verdict === "suspicious") report = next;
    }
    expect(report).not.toBeNull();
    expect(report?.verdict).toBe("suspicious");
    expect(report?.best?.prefix).toBeGreaterThanOrEqual(3);
    expect(report?.best?.suffix).toBeGreaterThanOrEqual(3);
  });

  it("explains why a lookalike is dangerous", () => {
    const report = evaluateAddress(poison, known);
    expect(report.reasons.length).toBeGreaterThanOrEqual(3);
    expect(report.reasons.join(" ")).toContain("first");
    expect(report.reasons.join(" ")).toContain("last");
  });

  it("refuses to clear an address with no history to compare", () => {
    const report = evaluateAddress(poison, []);
    expect(report.verdict).toBe("unknown");
    expect(report.comparedAgainst).toBe(0);
  });

  it("treats an address known only for dust as suspicious", () => {
    const dust = generatedAddress(mulberry32(77));
    const report = evaluateAddress(dust, [
      {
        address: dust,
        interactions: 1,
        lastSeen: 1_700_000_000,
        creditLamports: 1000,
        dustOnly: true,
      },
    ]);
    expect(report.verdict).toBe("suspicious");
    expect(report.reasons.join(" ")).toContain("dust");
  });
});

describe("poisoning inside your own history", () => {
  const rng = mulberry32(2024);
  const genuine = generatedAddress(rng);
  const twin = makeLookalike(genuine, rng, 4, 4);
  const known = [
    { address: genuine, interactions: 11, lastSeen: 1_700_000_000 },
    { address: twin, interactions: 1, lastSeen: 1_700_005_000 },
  ];

  it("finds the lookalike pair in history", () => {
    const pairs = findHistoryLookalikes(known);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].reference.address).toBe(genuine);
    expect(pairs[0].suspect.address).toBe(twin);
    expect(pairs[0].prefix).toBeGreaterThanOrEqual(4);
    expect(pairs[0].suffix).toBeGreaterThanOrEqual(4);
  });

  it("warns when the few-interaction twin is pasted, even though it is in history", () => {
    const report = evaluateAddress(twin, known);
    expect(report.verdict).toBe("high-risk");
    expect(report.headline).toContain("poisoned twin");
  });

  it("still accepts the genuinely used address", () => {
    expect(evaluateAddress(genuine, known).verdict).toBe("exact");
  });

  it("does not invent pairs when nothing matches", () => {
    expect(
      findHistoryLookalikes([{ address: genuine, interactions: 2, lastSeen: null }]),
    ).toHaveLength(0);
  });
});

describe("demo bundle", () => {
  it("gives the demo four distinct, working targets", () => {
    const bundle = getDemoBundle();
    const known = bundle.snapshot.counterparties;

    expect(isValidSolanaAddress(bundle.real)).toBe(true);
    expect(isValidSolanaAddress(bundle.lookalike)).toBe(true);
    expect(isValidSolanaAddress(bundle.suspicious)).toBe(true);
    expect(isValidSolanaAddress(bundle.unrelated)).toBe(true);

    expect(evaluateAddress(bundle.lookalike, known).verdict).toBe("high-risk");
    expect(evaluateAddress(bundle.real, known).verdict).toBe("exact");
    expect(evaluateAddress(bundle.suspicious, known).verdict).toBe("suspicious");
    expect(evaluateAddress(bundle.unrelated, known).verdict).toBe("safe");
  });

  it("is deterministic across calls", () => {
    expect(getDemoBundle().lookalike).toBe(getDemoBundle().lookalike);
    expect(getDemoBundle().real).toBe(getDemoBundle().real);
  });

  it("lists the real address as a known counterparty, never the poison", () => {
    const bundle = getDemoBundle();
    const addresses = bundle.snapshot.counterparties.map((entry) => entry.address);
    expect(addresses).toContain(bundle.real);
    expect(addresses).not.toContain(bundle.lookalike);
  });

  it("contains a dust-sender pair so the history alert has something to show", () => {
    const bundle = getDemoBundle();
    const pairs = findHistoryLookalikes(bundle.snapshot.counterparties);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(pairs[0].suspect.interactions).toBeLessThan(pairs[0].reference.interactions);
  });
});

describe("counterparty extraction", () => {
  const wallet = "Wallet111111111111111111111111111111111111";
  const recipient = "Recipient11111111111111111111111111111111";
  const tokenOwner = "TokenOwner1111111111111111111111111111111";

  function tx(overrides: Partial<ParsedTxLike> = {}): ParsedTxLike {
    return {
      blockTime: 1_700_000_100,
      transaction: {
        signatures: ["sig"],
        message: {
          accountKeys: [
            { pubkey: wallet, signer: true },
            { pubkey: recipient, signer: false },
            { pubkey: SYSTEM_PROGRAM, signer: false },
            { pubkey: "TokenAcct11111111111111111111111111111111", signer: false },
          ],
        },
      },
      meta: {
        err: null,
        preBalances: [10_000, 0, 0, 0],
        postBalances: [9_000, 1_000, 0, 0],
        preTokenBalances: [],
        postTokenBalances: [
          {
            accountIndex: 3,
            mint: "Mint1111111111111111111111111111111111111",
            owner: tokenOwner,
            uiTokenAmount: { amount: "500" },
          },
        ],
      },
      ...overrides,
    };
  }

  it("finds SOL recipients and token owners", () => {
    const result = extractCounterparties([tx()], wallet);
    const addresses = result.map((entry) => entry.address);
    expect(addresses).toContain(recipient);
    expect(addresses).toContain(tokenOwner);
    expect(addresses).not.toContain(wallet);
    expect(addresses).not.toContain(SYSTEM_PROGRAM);
    expect(PROGRAM_IDS.has(SYSTEM_PROGRAM)).toBe(true);
  });

  it("aggregates interactions and keeps the latest timestamp", () => {
    const older = tx({ blockTime: 1_700_000_000 });
    const newer = tx({ blockTime: 1_700_009_999 });
    const result = extractCounterparties([older, newer], wallet);
    const entry = result.find((item) => item.address === recipient);
    expect(entry?.interactions).toBe(2);
    expect(entry?.lastSeen).toBe(1_700_009_999);
  });

  it("captures the signer when the wallet receives dust", () => {
    const dustSender = "DustSender111111111111111111111111111111";
    const received: ParsedTxLike = {
      blockTime: 1_700_003_000,
      transaction: {
        signatures: ["dust"],
        message: {
          accountKeys: [
            { pubkey: dustSender, signer: true },
            { pubkey: wallet, signer: false },
          ],
        },
      },
      meta: {
        err: null,
        preBalances: [10_000_000, 1_000],
        postBalances: [8_999_000, 1_001_000],
        preTokenBalances: [],
        postTokenBalances: [],
      },
    };

    const result = extractCounterparties([received], wallet);
    const entry = result.find((item) => item.address === dustSender);
    expect(entry).toBeDefined();
    expect(entry?.interactions).toBe(1);
    expect(entry?.creditLamports).toBe(1_000_000);
    expect(entry?.debitLamports).toBe(0);
    expect(entry?.dustOnly).toBe(true);
  });

  it("does not mark a counterparty the wallet paid as dust", () => {
    const result = extractCounterparties([tx()], wallet);
    const entry = result.find((item) => item.address === recipient);
    expect(entry?.debitLamports).toBe(1_000);
    expect(entry?.creditLamports).toBe(0);
    expect(entry?.dustOnly).toBe(false);
  });

  it("keeps dust visible when formatting SOL", () => {
    expect(formatSolPrecise(1000)).toBe("0.000001 SOL");
    expect(formatSolPrecise(1_000_000)).toBe("0.001 SOL");
    expect(formatSolPrecise(5_240_000_000)).toBe("5.24 SOL");
  });

  it("ignores failed transactions", () => {
    const failed = tx({
      meta: {
        err: { InstructionError: [0, "Custom"] },
        preBalances: [10_000, 0, 0, 0],
        postBalances: [9_000, 1_000, 0, 0],
        preTokenBalances: [],
        postTokenBalances: [],
      },
    });
    expect(extractCounterparties([failed], wallet)).toHaveLength(0);
  });

  it("skips program accounts", () => {
    const result = extractCounterparties([tx()], wallet);
    for (const entry of result) {
      expect(PROGRAM_IDS.has(entry.address)).toBe(false);
    }
  });
});
