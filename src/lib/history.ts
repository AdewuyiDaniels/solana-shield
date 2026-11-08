import type { Connection, ParsedTransactionWithMeta } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { extractCounterparties, type ParsedTxLike } from "./counterparties";
import { hostOf } from "./format";
import type { HistorySnapshot, TxSummary } from "./types";

export interface FetchHistoryOptions {
  limit?: number;
  onProgress?: (done: number, total: number) => void;
}

const CHUNK_SIZE = 10;

export function toTxLike(tx: ParsedTransactionWithMeta): ParsedTxLike {
  const message = tx.transaction.message as unknown as {
    accountKeys: { pubkey: { toBase58(): string }; signer?: boolean; writable?: boolean }[];
  };
  return {
    blockTime: tx.blockTime,
    transaction: {
      signatures: tx.transaction.signatures,
      message: {
        accountKeys: (message.accountKeys ?? []).map((key) => ({
          pubkey: key.pubkey.toBase58(),
          signer: key.signer,
          writable: key.writable,
        })),
      },
    },
    meta: tx.meta
      ? {
          err: tx.meta.err,
          preBalances: tx.meta.preBalances,
          postBalances: tx.meta.postBalances,
          preTokenBalances: tx.meta.preTokenBalances,
          postTokenBalances: tx.meta.postTokenBalances,
        }
      : null,
  };
}

function summarize(tx: ParsedTxLike, wallet: string, signature: string): TxSummary {
  const keys = tx.transaction.message.accountKeys;
  const index = keys.findIndex((key) => key.pubkey === wallet);
  let direction: TxSummary["direction"] = "unknown";
  if (index >= 0 && tx.meta) {
    const delta =
      (tx.meta.postBalances[index] ?? 0) - (tx.meta.preBalances[index] ?? 0);
    direction = delta < 0 ? "sent" : delta > 0 ? "received" : "mixed";
  }
  return {
    signature,
    blockTime: tx.blockTime ?? null,
    counterparties: extractCounterparties([tx], wallet).map((entry) => entry.address),
    direction,
  };
}

export async function fetchHistorySnapshot(
  connection: Connection,
  walletAddress: string,
  options: FetchHistoryOptions = {},
): Promise<HistorySnapshot> {
  const startedAt = Date.now();
  const limit = options.limit ?? 40;
  const owner = new PublicKey(walletAddress);

  const signatures = await connection.getSignaturesForAddress(
    owner,
    { limit },
    "confirmed",
  );
  const usable = signatures.filter((entry) => !entry.err);

  const txLikes: ParsedTxLike[] = [];
  const summaries: TxSummary[] = [];

  options.onProgress?.(0, usable.length);

  for (let offset = 0; offset < usable.length; offset += CHUNK_SIZE) {
    const slice = usable.slice(offset, offset + CHUNK_SIZE);
    let parsed: (ParsedTransactionWithMeta | null)[] = [];
    try {
      parsed = await connection.getParsedTransactions(
        slice.map((entry) => entry.signature),
        { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
      );
    } catch {
      parsed = [];
    }

    parsed.forEach((tx, index) => {
      if (!tx) return;
      try {
        const like = toTxLike(tx);
        txLikes.push(like);
        summaries.push(summarize(like, walletAddress, slice[index].signature));
      } catch {
        return;
      }
    });

    options.onProgress?.(Math.min(offset + slice.length, usable.length), usable.length);
  }

  const counterparties = extractCounterparties(txLikes, walletAddress);

  return {
    wallet: walletAddress,
    mode: "live",
    counterparties,
    transactions: summaries,
    scanned: txLikes.length,
    truncated: signatures.length >= limit,
    fetchedAt: Math.floor(Date.now() / 1000),
    elapsedMs: Date.now() - startedAt,
    rpcHost: hostOf(connection.rpcEndpoint),
  };
}
