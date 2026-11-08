import type { Counterparty } from "./types";

export interface TokenAmountLike {
  accountIndex: number;
  mint: string;
  owner?: string | null;
  uiTokenAmount: { amount: string; decimals?: number };
}

export interface ParsedTxLike {
  blockTime?: number | null;
  transaction: {
    signatures: string[];
    message: {
      accountKeys: { pubkey: string; signer?: boolean; writable?: boolean }[];
    };
  };
  meta?: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: TokenAmountLike[] | null;
    postTokenBalances?: TokenAmountLike[] | null;
  } | null;
}

export const PROGRAM_IDS = new Set<string>([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "ComputeBudget111111111111111111111111111111",
  "Vote111111111111111111111111111111111111111",
  "Stake11111111111111111111111111111111111111",
  "Ed25519SigVerify111111111111111111111111111",
  "KeccakSecp256k11111111111111111111111111111",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
  "AddressLookupTab1e1111111111111111111111111",
  "SysvarRent111111111111111111111111111111111",
  "SysvarC1ock11111111111111111111111111111111",
  "SysvarRecentB1ockHashes11111111111111111111",
  "BPFLoaderUpgradeab1e11111111111111111111111",
  "BPFLoader2111111111111111111111111111111111",
]);

/** Anything at or below 0.001 SOL received and never repaid reads as dust. */
export const DUST_LAMPORTS = 1_000_000;

interface Accrual {
  credit: number;
  debit: number;
  credits: number;
  debits: number;
}

function toBigInt(value: string | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function emptyAccrual(): Accrual {
  return { credit: 0, debit: 0, credits: 0, debits: 0 };
}

function accrue(
  map: Map<string, Accrual>,
  address: string,
  kind: "credit" | "debit",
  lamports = 0,
  transfers = 0,
): void {
  const entry = map.get(address) ?? emptyAccrual();
  if (kind === "credit") {
    entry.credit += lamports;
    entry.credits += transfers;
  } else {
    entry.debit += lamports;
    entry.debits += transfers;
  }
  map.set(address, entry);
}

function isAccount(address: string | undefined, wallet: string): boolean {
  return Boolean(address) && address !== wallet && !PROGRAM_IDS.has(address as string);
}

/**
 * Builds wallet-centric counterparties: what the wallet received from an
 * address and what it sent, never the address's own balance changes. That is
 * what makes a dust sender recognisable (credited the wallet, never paid).
 */
export function extractCounterparties(
  transactions: ParsedTxLike[],
  wallet: string,
): Counterparty[] {
  const found = new Map<string, Counterparty>();

  const merge = (address: string, blockTime: number | null, delta: Accrual) => {
    const existing = found.get(address) ?? {
      address,
      interactions: 0,
      lastSeen: null,
      firstSeen: null,
      creditLamports: 0,
      debitLamports: 0,
      creditTransfers: 0,
      debitTransfers: 0,
    };
    existing.interactions += 1;
    existing.creditLamports = (existing.creditLamports ?? 0) + delta.credit;
    existing.debitLamports = (existing.debitLamports ?? 0) + delta.debit;
    existing.creditTransfers = (existing.creditTransfers ?? 0) + delta.credits;
    existing.debitTransfers = (existing.debitTransfers ?? 0) + delta.debits;
    if (blockTime) {
      if (existing.lastSeen === null || blockTime > existing.lastSeen) {
        existing.lastSeen = blockTime;
      }
      const firstSeen = existing.firstSeen ?? null;
      if (firstSeen === null || blockTime < firstSeen) {
        existing.firstSeen = blockTime;
      }
    }
    found.set(address, existing);
  };

  for (const tx of transactions) {
    const meta = tx.meta;
    if (!meta || meta.err) continue;

    const blockTime = tx.blockTime ?? null;
    const keys = tx.transaction.message.accountKeys ?? [];
    const touched = new Map<string, Accrual>();

    const pre = meta.preBalances ?? [];
    const post = meta.postBalances ?? [];
    const walletIndex = keys.findIndex((key) => key.pubkey === wallet);
    const walletSolDelta =
      walletIndex >= 0 ? (post[walletIndex] ?? 0) - (pre[walletIndex] ?? 0) : 0;

    const sender = keys.find(
      (key) => key.signer && isAccount(key.pubkey, wallet),
    );
    let walletReceivedToken = false;

    if (walletSolDelta > 0 && sender) {
      accrue(touched, sender.pubkey, "credit", walletSolDelta, 0);
    }

    if (walletSolDelta < 0) {
      for (let i = 0; i < keys.length; i += 1) {
        const address = keys[i].pubkey;
        if (!isAccount(address, wallet)) continue;
        const delta = (post[i] ?? 0) - (pre[i] ?? 0);
        if (delta > 0) accrue(touched, address, "debit", delta, 0);
      }
    }

    const preToken = new Map<number, { owner: string; amount: bigint }>();
    for (const balance of meta.preTokenBalances ?? []) {
      if (!balance.owner) continue;
      preToken.set(balance.accountIndex, {
        owner: balance.owner,
        amount: toBigInt(balance.uiTokenAmount.amount),
      });
    }
    for (const balance of meta.postTokenBalances ?? []) {
      const owner = balance.owner;
      if (!owner) continue;
      const before = preToken.get(balance.accountIndex)?.amount ?? 0n;
      const after = toBigInt(balance.uiTokenAmount.amount);
      if (after === before) continue;
      if (owner === wallet) {
        if (after > before) walletReceivedToken = true;
        continue;
      }
      accrue(touched, owner, after > before ? "debit" : "credit", 0, 1);
    }

    if (walletReceivedToken && sender) {
      accrue(touched, sender.pubkey, "credit", 0, 1);
    }

    if (touched.size === 0) {
      for (const key of keys) {
        if (!isAccount(key.pubkey, wallet)) continue;
        if (key.signer) continue;
        touched.set(key.pubkey, emptyAccrual());
      }
    }

    for (const [address, delta] of touched) merge(address, blockTime, delta);
  }

  const result = [...found.values()];
  for (const entry of result) {
    const credit = entry.creditLamports ?? 0;
    const debit = entry.debitLamports ?? 0;
    const tokenCredits = entry.creditTransfers ?? 0;
    entry.dustOnly =
      credit > 0 && debit === 0 && tokenCredits === 0 && credit <= DUST_LAMPORTS;
  }

  return result.sort(
    (a, b) =>
      (b.lastSeen ?? 0) - (a.lastSeen ?? 0) ||
      b.interactions - a.interactions,
  );
}
