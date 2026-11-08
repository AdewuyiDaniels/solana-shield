import { isValidSolanaAddress } from "./address";
import { encodeBase58 } from "./base58";
import { commonPrefixLength, commonSuffixLength } from "./similarity";
import type { Counterparty, HistorySnapshot, TxSummary } from "./types";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generatedAddress(rng: () => number): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) bytes[i] = Math.floor(rng() * 256);
  if (bytes[0] === 0) bytes[0] = 1 + Math.floor(rng() * 255);
  return encodeBase58(bytes);
}

export function makeLookalike(
  target: string,
  rng: () => number,
  prefix = 4,
  suffix = 4,
): string {
  const middleLength = Math.max(1, target.length - prefix - suffix);
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    let middle = "";
    for (let i = 0; i < middleLength; i += 1) {
      middle += B58[Math.floor(rng() * B58.length)];
    }
    const candidate = target.slice(0, prefix) + middle + target.slice(-suffix);
    if (candidate === target) continue;
    if (!isValidSolanaAddress(candidate)) continue;
    const p = commonPrefixLength(candidate, target);
    const s = commonSuffixLength(
      candidate,
      target,
      Math.min(candidate.length, target.length) - p,
    );
    if (p >= prefix && s >= suffix) return candidate;
  }
  return target;
}

function fakeSignature(rng: () => number): string {
  let out = "";
  for (let i = 0; i < 88; i += 1) out += B58[Math.floor(rng() * B58.length)];
  return out;
}

export interface DemoBundle {
  snapshot: HistorySnapshot;
  real: string;
  lookalike: string;
  suspicious: string;
  unrelated: string;
}

let cached: DemoBundle | null = null;

export function getDemoBundle(): DemoBundle {
  if (cached) return cached;

  const rng = mulberry32(0x5eed1234);
  const now = Math.floor(Date.now() / 1000);

  const wallet = generatedAddress(rng);
  const real = generatedAddress(rng);
  const lookalike = makeLookalike(real, rng, 4, 4);

  let suspicious = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = makeLookalike(real, rng, 3, 3);
    const p = commonPrefixLength(candidate, real);
    const s = commonSuffixLength(
      candidate,
      real,
      Math.min(candidate.length, real.length) - p,
    );
    if (p >= 3 && s >= 3 && !(p >= 4 && s >= 4)) {
      suspicious = candidate;
      break;
    }
  }
  if (!suspicious) suspicious = makeLookalike(real, rng, 3, 3);

  const unrelated = generatedAddress(rng);
  const treasury = generatedAddress(rng);
  const dca = generatedAddress(rng);
  const cold = generatedAddress(rng);
  const dust = makeLookalike(treasury, rng, 4, 4);

  const counterparties: Counterparty[] = [
    {
      address: real,
      interactions: 14,
      lastSeen: now - 60 * 60 * 3,
      firstSeen: now - 60 * 60 * 24 * 96,
      debitLamports: 5_240_000_000,
      creditLamports: 1_100_000_000,
      label: "Alex · friend (verified)",
    },
    {
      address: treasury,
      interactions: 9,
      lastSeen: now - 60 * 60 * 26,
      firstSeen: now - 60 * 60 * 24 * 140,
      debitLamports: 12_000_000_000,
      creditLamports: 2_000_000_000,
      label: "Treasury · ops",
    },
    {
      address: dca,
      interactions: 6,
      lastSeen: now - 60 * 60 * 24 * 2,
      firstSeen: now - 60 * 60 * 24 * 60,
      creditLamports: 900_000_000,
      label: "DCA bot",
    },
    {
      address: cold,
      interactions: 3,
      lastSeen: now - 60 * 60 * 24 * 6,
      firstSeen: now - 60 * 60 * 24 * 300,
      debitLamports: 10_000_000_000,
      label: "Cold storage",
    },
    {
      address: dust,
      interactions: 1,
      lastSeen: now - 60 * 60 * 11,
      firstSeen: now - 60 * 60 * 11,
      creditLamports: 1000,
      debitLamports: 0,
      dustOnly: true,
      label: "Unknown · dust sender",
    },
  ];

  const transactions: TxSummary[] = [
    { signature: fakeSignature(rng), blockTime: now - 60 * 60 * 3, counterparties: [real], direction: "sent" },
    { signature: fakeSignature(rng), blockTime: now - 60 * 60 * 5, counterparties: [treasury], direction: "sent" },
    { signature: fakeSignature(rng), blockTime: now - 60 * 60 * 26, counterparties: [dca], direction: "received" },
    { signature: fakeSignature(rng), blockTime: now - 60 * 60 * 30, counterparties: [real], direction: "sent" },
    { signature: fakeSignature(rng), blockTime: now - 60 * 60 * 24 * 2, counterparties: [dca, real], direction: "mixed" },
    { signature: fakeSignature(rng), blockTime: now - 60 * 60 * 24 * 4, counterparties: [cold], direction: "sent" },
    { signature: fakeSignature(rng), blockTime: now - 60 * 60 * 24 * 6, counterparties: [treasury], direction: "received" },
    { signature: fakeSignature(rng), blockTime: now - 60 * 60 * 11, counterparties: [dust], direction: "received" },
    { signature: fakeSignature(rng), blockTime: now - 60 * 60 * 24 * 8, counterparties: [real], direction: "sent" },
  ];

  const snapshot: HistorySnapshot = {
    wallet,
    mode: "demo",
    counterparties,
    transactions,
    scanned: 62,
  observed: 64,
  skipped: 2,
  failed: 0,
    depth: 64,
    truncated: false,
    hasMore: false,
    fetchedAt: now,
    elapsedMs: 1840,
    windowStart: now - 60 * 60 * 24 * 21,
    windowEnd: now - 60 * 60 * 3,
    rpcHost: "sample fixture",
  };

  cached = { snapshot, real, lookalike, suspicious, unrelated };
  return cached;
}

