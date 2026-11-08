export interface Counterparty {
  address: string;
  interactions: number;
  lastSeen: number | null;
  label?: string;
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
  truncated: boolean;
  fetchedAt: number;
  elapsedMs: number;
  rpcHost?: string;
}
