export interface Counterparty {
  address: string;
  interactions: number;
  lastSeen: number | null;
  firstSeen?: number | null;
  label?: string;
  /** Lamports this address has sent into the wallet. */
  creditLamports?: number;
  /** Lamports the wallet has sent to this address. */
  debitLamports?: number;
  creditTransfers?: number;
  debitTransfers?: number;
  dustOnly?: boolean;
}

export type DataMode = "demo" | "live";

export interface TxSummary {
  signature: string;
  blockTime: number | null;
  counterparties: string[];
  direction: "sent" | "received" | "mixed" | "unknown";
}

export interface HistorySnapshot {
  wallet: string | null;
  mode: DataMode;
  counterparties: Counterparty[];
  transactions: TxSummary[];
  scanned: number;
  observed: number;
  skipped?: number;
  failed: number;
  depth: number;
  truncated: boolean;
  hasMore: boolean;
  fetchedAt: number;
  elapsedMs: number;
  windowStart: number | null;
  windowEnd: number | null;
  rpcHost?: string;
  cached?: boolean;
}

export type ReputationVerdict =
  | "dust-fanout"
  | "dust-sender"
  | "quiet"
  | "active"
  | "unknown";

export interface AddressReputation {
  address: string;
  verdict: ReputationVerdict;
  summary: string;
  sampled: number;
  outbound: number;
  inbound: number;
  dustOut: number;
  dustShare: number;
  distinctRecipients: number;
  failed: number;
  elapsedMs: number;
  firstSeen: number | null;
  lastSeen: number | null;
}

export type ScanPhase = "signatures" | "parse";

export interface ScanProgress {
  phase: ScanPhase;
  done: number;
  total: number;
}

export const DEPTH_PRESETS = [100, 500, 1000, 2000] as const;
export type ScanDepth = (typeof DEPTH_PRESETS)[number];
export const DEFAULT_DEPTH: ScanDepth = 500;

export const DEPTH_ESTIMATE_SECONDS: Record<ScanDepth, number> = {
  100: 3,
  500: 11,
  1000: 22,
  2000: 45,
};
