import {
  Connection,
  PublicKey,
  type Commitment,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { extractCounterparties, type ParsedTxLike } from "./counterparties";
import { hostOf } from "./format";
import type {
  HistorySnapshot,
  ScanProgress,
  TxSummary,
} from "./types";

export const FALLBACK_ENDPOINTS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

const TX_CONCURRENCY = 10;
const MAX_ENDPOINT_FAILURES = 12;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_SIGNATURES_PER_CALL = 1000;
const CACHE_TTL_SECONDS = 10 * 60;
const CACHE_PREFIX = "solana-shield:scan:v2:";

export interface FetchHistoryOptions {
  depth?: number;
  onProgress?: (progress: ScanProgress) => void;
  onPartial?: (snapshot: HistorySnapshot) => void;
  signal?: AbortSignal;
}

export function resolveRpcEndpoints(primary: string): string[] {
  const list = [primary, ...FALLBACK_ENDPOINTS]
    .map((endpoint) => endpoint.trim())
    .filter(Boolean);
  return [...new Set(list)];
}

function abortError(): Error {
  const error = new Error("Scan stopped");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("RPC request timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
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
      const delta = (this.failures.get(a) ?? 0) - (this.failures.get(b) ?? 0);
      if (delta !== 0) return delta;
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
        const result = await withTimeout(operation(connection));
        this.failures.set(endpoint, 0);
        this.lastGood = endpoint;
        return result;
      } catch (cause) {
        this.failures.set(
          endpoint,
          (this.failures.get(endpoint) ?? 0) + 1,
        );
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

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    },
  );

  await Promise.all(runners);
  return results;
}

export function toTxLike(tx: ParsedTransactionWithMeta): ParsedTxLike {
  const message = tx.transaction.message as unknown as {
    accountKeys: {
      pubkey: { toBase58(): string };
      signer?: boolean;
      writable?: boolean;
    }[];
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

function summarize(
  tx: ParsedTxLike,
  wallet: string,
  signature: string,
): TxSummary {
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

function isVersionError(cause: unknown): boolean {
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === "object" && cause !== null && "message" in cause
        ? String((cause as { message: unknown }).message)
        : String(cause);
  return /version/i.test(message);
}

/**
 * Solana mainnet now carries transaction version 1. Asking only for version 0
 * makes the RPC drop roughly a fifth of recent transactions, which silently
 * shrinks the counterparty set. Try 1 first, fall back for old providers.
 */
type ParsedTxConfig = NonNullable<
  Parameters<Connection["getParsedTransaction"]>[1]
>;

function txConfig(version: 0 | 1): ParsedTxConfig {
  return {
    commitment: "confirmed",
    maxSupportedTransactionVersion: version,
    // Instructions are irrelevant here; accounts plus balances keep payloads small.
    transactionDetails: "accounts",
  } as unknown as ParsedTxConfig;
}

async function getParsedTransaction(
  connection: Connection,
  signature: string,
): Promise<ParsedTransactionWithMeta | null> {
  try {
    return await connection.getParsedTransaction(signature, txConfig(1));
  } catch (cause) {
    if (!isVersionError(cause)) throw cause;
    return connection.getParsedTransaction(signature, txConfig(0));
  }
}

interface CollectedSignature {
  signature: string;
  blockTime: number | null;
  err: unknown;
}

async function collectSignatures(
  pool: EndpointPool,
  owner: PublicKey,
  depth: number,
  signal: AbortSignal | undefined,
  onProgress: FetchHistoryOptions["onProgress"],
): Promise<CollectedSignature[]> {
  const collected: CollectedSignature[] = [];
  let before: string | undefined;

  while (collected.length < depth) {
    throwIfAborted(signal);
    const remaining = depth - collected.length;
    const pageLimit = Math.min(MAX_SIGNATURES_PER_CALL, remaining);

    const page = await pool.call((connection) =>
      connection.getSignaturesForAddress(
        owner,
        { limit: pageLimit, before },
        "confirmed",
      ),
    );

    for (const entry of page) {
      collected.push({
        signature: entry.signature,
        blockTime: entry.blockTime ?? null,
        err: entry.err,
      });
    }

    onProgress?.({
      phase: "signatures",
      done: collected.length,
      total: depth,
    });

    if (page.length < pageLimit) break;
    const last = page[page.length - 1];
    if (!last) break;
    before = last.signature;
  }

  return collected;
}

function buildSnapshot(input: {
  wallet: string;
  depth: number;
  rpcHost: string;
  observed: number;
  skipped: number;
  failed: number;
  elapsedMs: number;
  hasMore: boolean;
  windowStart: number | null;
  windowEnd: number | null;
  txLikes: ParsedTxLike[];
  summaries: TxSummary[];
  cached?: boolean;
}): HistorySnapshot {
  return {
    wallet: input.wallet,
    mode: "live",
    counterparties: extractCounterparties(input.txLikes, input.wallet),
    transactions: input.summaries,
    scanned: input.txLikes.length,
    observed: input.observed,
    skipped: input.skipped,
    failed: input.failed,
    depth: input.depth,
    truncated: input.hasMore,
    hasMore: input.hasMore,
    fetchedAt: Math.floor(Date.now() / 1000),
    elapsedMs: input.elapsedMs,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    rpcHost: input.rpcHost,
    cached: input.cached,
  };
}

function cacheKey(wallet: string, depth: number): string {
  return `${CACHE_PREFIX}${wallet}:${depth}`;
}

export function readCachedSnapshot(
  wallet: string,
  depth: number,
): HistorySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(wallet, depth));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt: number;
      snapshot: HistorySnapshot;
    };
    if (!parsed?.snapshot?.counterparties) return null;
    if (Date.now() / 1000 - parsed.savedAt > CACHE_TTL_SECONDS) return null;
    return { ...parsed.snapshot, cached: true, mode: "live" };
  } catch {
    return null;
  }
}

export function writeCachedSnapshot(snapshot: HistorySnapshot): void {
  if (typeof window === "undefined") return;
  if (snapshot.mode !== "live" || !snapshot.wallet || snapshot.scanned === 0) return;
  try {
    window.localStorage.setItem(
      cacheKey(snapshot.wallet, snapshot.depth),
      JSON.stringify({
        savedAt: Math.floor(Date.now() / 1000),
        snapshot: { ...snapshot, cached: false },
      }),
    );
  } catch {
    // Storage can be full or blocked; the scan itself still worked.
  }
}

export async function fetchHistorySnapshot(
  connection: Connection,
  walletAddress: string,
  options: FetchHistoryOptions = {},
): Promise<HistorySnapshot> {
  const depth = Math.max(1, Math.floor(options.depth ?? 500));
  const startedAt = Date.now();
  const owner = new PublicKey(walletAddress);
  const endpoints = resolveRpcEndpoints(connection.rpcEndpoint);
  const pool = new EndpointPool(endpoints);
  const { signal, onProgress, onPartial } = options;

  const signatures = await collectSignatures(
    pool,
    owner,
    depth,
    signal,
    onProgress,
  );

  const parseable = signatures.filter((entry) => !entry.err);
  const hasMore = signatures.length >= depth;

  let windowStart: number | null = null;
  let windowEnd: number | null = null;
  for (const entry of signatures) {
    if (!entry.blockTime) continue;
    if (windowStart === null || entry.blockTime < windowStart) {
      windowStart = entry.blockTime;
    }
    if (windowEnd === null || entry.blockTime > windowEnd) {
      windowEnd = entry.blockTime;
    }
  }

  const txLikes: ParsedTxLike[] = [];
  const summaries: TxSummary[] = [];
  const skipped = signatures.length - parseable.length;
  let failed = 0;
  let done = 0;
  let lastEmit = 0;

  const snapshotNow = () =>
    buildSnapshot({
      wallet: walletAddress,
      depth,
      rpcHost: hostOf(pool.endpoint),
      observed: signatures.length,
      skipped,
      failed,
      elapsedMs: Date.now() - startedAt,
      hasMore,
      windowStart,
      windowEnd,
      txLikes,
      summaries,
    });

  await mapWithConcurrency(
    parseable,
    TX_CONCURRENCY,
    async (entry) => {
      throwIfAborted(signal);
      let fetched: ParsedTransactionWithMeta | null = null;

      for (let attempt = 0; attempt < 2 && !fetched; attempt += 1) {
        throwIfAborted(signal);
        try {
          fetched = await pool.call((client) =>
            getParsedTransaction(client, entry.signature),
          );
          if (!fetched) await sleep(100);
        } catch (cause) {
          if (cause instanceof Error && cause.name === "AbortError") throw cause;
          if (attempt === 1) break;
          await sleep(120);
        }
      }

      if (!fetched) {
        failed += 1;
      } else {
        try {
          const like = toTxLike(fetched);
          txLikes.push(like);
          summaries.push(summarize(like, walletAddress, entry.signature));
        } catch {
          failed += 1;
        }
      }

      done += 1;
      onProgress?.({ phase: "parse", done, total: parseable.length });

      const now = Date.now();
      if (now - lastEmit > 400) {
        lastEmit = now;
        onPartial?.(snapshotNow());
      }
    },
  );

  return snapshotNow();
}


