import {
  Connection,
  PublicKey,
  type Commitment,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { extractCounterparties, type ParsedTxLike } from "./counterparties";
import { hostOf } from "./format";
import type { HistorySnapshot, TxSummary } from "./types";

export interface FetchHistoryOptions {
  limit?: number;
  onProgress?: (done: number, total: number) => void;
}

export const FALLBACK_ENDPOINTS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

const TX_CONCURRENCY = 5;
const MAX_ENDPOINT_FAILURES = 4;

export function resolveRpcEndpoints(primary: string): string[] {
  const list = [primary, ...FALLBACK_ENDPOINTS]
    .map((endpoint) => endpoint.trim())
    .filter(Boolean);
  return [...new Set(list)];
}

class EndpointPool {
  private readonly endpoints: string[];
  private readonly connections = new Map<string, Connection>();
  private readonly failures = new Map<string, number>();
  private lastGood: string;

  constructor(endpoints: string[], commitment: Commitment = "confirmed") {
    this.endpoints = endpoints.length > 0 ? endpoints : FALLBACK_ENDPOINTS;
    this.lastGood = this.endpoints[0];
    for (const endpoint of this.endpoints) {
      this.connections.set(endpoint, new Connection(endpoint, commitment));
    }
  }

  get endpoint(): string {
    return this.lastGood;
  }

  private ordered(): string[] {
    return [...this.endpoints].sort((a, b) => {
      const failureDelta = (this.failures.get(a) ?? 0) - (this.failures.get(b) ?? 0);
      if (failureDelta !== 0) return failureDelta;
      return this.endpoints.indexOf(a) - this.endpoints.indexOf(b);
    });
  }

  async call<T>(operation: (connection: Connection) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (const endpoint of this.ordered()) {
      if ((this.failures.get(endpoint) ?? 0) >= MAX_ENDPOINT_FAILURES) continue;
      const connection = this.connections.get(endpoint);
      if (!connection) continue;
      try {
        const result = await operation(connection);
        this.failures.set(endpoint, 0);
        this.lastGood = endpoint;
        return result;
      } catch (cause) {
        this.failures.set(endpoint, (this.failures.get(endpoint) ?? 0) + 1);
        lastError = cause;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Every Solana RPC endpoint failed");
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

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

async function scanEndpoint(
  endpoint: string,
  walletAddress: string,
  limit: number,
  options: FetchHistoryOptions,
): Promise<HistorySnapshot> {
  const startedAt = Date.now();
  const owner = new PublicKey(walletAddress);
  const pool = new EndpointPool([endpoint, ...resolveRpcEndpoints(endpoint)]);

  const signatures = await pool.call((connection) =>
    connection.getSignaturesForAddress(owner, { limit }, "confirmed"),
  );
  const usable = signatures.filter((entry) => !entry.err);

  options.onProgress?.(0, usable.length);

  let completed = 0;
  const parsed = await mapWithConcurrency(
    usable,
    TX_CONCURRENCY,
    async (entry) => {
      try {
        return await pool.call((connection) =>
          connection.getParsedTransaction(entry.signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          }),
        );
      } catch {
        return null as ParsedTransactionWithMeta | null;
      } finally {
        completed += 1;
        options.onProgress?.(completed, usable.length);
      }
    },
  );

  const txLikes: ParsedTxLike[] = [];
  const summaries: TxSummary[] = [];

  parsed.forEach((tx, index) => {
    if (!tx) return;
    try {
      const like = toTxLike(tx);
      txLikes.push(like);
      summaries.push(summarize(like, walletAddress, usable[index].signature));
    } catch {
      return;
    }
  });

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
    rpcHost: hostOf(pool.endpoint),
  };
}

export async function fetchHistorySnapshot(
  connection: Connection,
  walletAddress: string,
  options: FetchHistoryOptions = {},
): Promise<HistorySnapshot> {
  const limit = options.limit ?? 40;
  const endpoints = resolveRpcEndpoints(connection.rpcEndpoint);
  let lastError: unknown;

  for (const endpoint of endpoints) {
    try {
      return await scanEndpoint(endpoint, walletAddress, limit, options);
    } catch (cause) {
      lastError = cause;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not reach any Solana RPC endpoint");
}
