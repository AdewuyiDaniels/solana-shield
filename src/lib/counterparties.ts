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

function toBigInt(value: string | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

export function extractCounterparties(
  transactions: ParsedTxLike[],
  wallet: string,
): Counterparty[] {
  const found = new Map<string, Counterparty>();

  const touch = (address: string, blockTime: number | null) => {
    if (!address || address === wallet) return;
    const existing = found.get(address) ?? {
      address,
      interactions: 0,
      lastSeen: null,
    };
    existing.interactions += 1;
    if (blockTime && (existing.lastSeen === null || blockTime > existing.lastSeen)) {
      existing.lastSeen = blockTime;
    }
    found.set(address, existing);
  };

  for (const tx of transactions) {
    const meta = tx.meta;
    if (!meta || meta.err) continue;

    const blockTime = tx.blockTime ?? null;
    const keys = tx.transaction.message.accountKeys ?? [];
    const touched = new Set<string>();

    const pre = meta.preBalances ?? [];
    const post = meta.postBalances ?? [];
    for (let i = 0; i < keys.length; i += 1) {
      const address = keys[i].pubkey;
      if (!address || address === wallet || PROGRAM_IDS.has(address)) continue;
      const delta = (post[i] ?? 0) - (pre[i] ?? 0);
      if (delta > 0) touched.add(address);
    }

    const preToken = new Map<number, bigint>();
    for (const balance of meta.preTokenBalances ?? []) {
      preToken.set(balance.accountIndex, toBigInt(balance.uiTokenAmount.amount));
    }
    for (const balance of meta.postTokenBalances ?? []) {
      const owner = balance.owner;
      if (!owner || owner === wallet) continue;
      const before = preToken.get(balance.accountIndex) ?? 0n;
      const after = toBigInt(balance.uiTokenAmount.amount);
      if (after > before) touched.add(owner);
    }

    if (touched.size === 0) {
      for (const key of keys) {
        if (!key.pubkey || key.pubkey === wallet) continue;
        if (PROGRAM_IDS.has(key.pubkey)) continue;
        if (key.signer) continue;
        touched.add(key.pubkey);
      }
    }

    for (const address of touched) touch(address, blockTime);
  }

  return [...found.values()].sort(
    (a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0),
  );
}
