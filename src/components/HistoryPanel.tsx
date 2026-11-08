"use client";

import { shortAddress } from "@/lib/address";
import { formatDateRange, formatSolPrecise, timeAgo } from "@/lib/format";
import {
  DEPTH_PRESETS,
  type Counterparty,
  type DataMode,
  type HistorySnapshot,
  type ScanProgress,
} from "@/lib/types";

interface HistoryPanelProps {
  snapshot: HistorySnapshot | null;
  mode: DataMode;
  status: "idle" | "loading" | "ready" | "error";
  progress: ScanProgress | null;
  error: string | null;
  highlight: string | null;
  connected: boolean;
  depth: number;
  onDepthChange: (depth: number) => void;
  onRefresh: () => void;
  onStop: () => void;
}

function flow(entry: Counterparty): string {
  const sent = entry.debitLamports ?? 0;
  const received = entry.creditLamports ?? 0;
  const parts: string[] = [];
  if (sent > 0) parts.push(`sent ${formatSolPrecise(sent)}`);
  if (received > 0) parts.push(`received ${formatSolPrecise(received)}`);
  const tokenIn = entry.creditTransfers ?? 0;
  const tokenOut = entry.debitTransfers ?? 0;
  if (tokenIn + tokenOut > 0) {
    parts.push(
      `${tokenIn + tokenOut} token transfer${tokenIn + tokenOut === 1 ? "" : "s"}`,
    );
  }
  if (parts.length === 0) {
    return `${entry.interactions} interaction${entry.interactions === 1 ? "" : "s"}`;
  }
  return parts.join(" · ");
}

export function HistoryPanel({
  snapshot,
  mode,
  status,
  progress,
  error,
  highlight,
  connected,
  depth,
  onDepthChange,
  onRefresh,
  onStop,
}: HistoryPanelProps) {
  const loading = status === "loading";
  const counterparties = snapshot?.counterparties.slice(0, 40) ?? [];
  const observed = snapshot?.observed ?? (progress?.phase === "signatures" ? progress.done : 0);
  const parsed = snapshot?.scanned ?? 0;
  const failed = snapshot?.failed ?? 0;
  const skipped = snapshot?.skipped ?? 0;
  const elapsed = snapshot ? (snapshot.elapsedMs / 1000).toFixed(1) : "0.0";

  const percent = loading
    ? progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 4
    : 0;

  return (
    <aside className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="label">History window</p>
          <p className="mt-1 text-[12.5px] font-medium text-[#d8dbe0]">
            {mode === "demo" ? "Sample wallet" : "Your counterparties"}
          </p>
        </div>
        {loading ? (
          <button type="button" onClick={onStop} className="btn-quiet">
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onRefresh}
            disabled={mode === "live" && !connected}
            className="btn-quiet"
          >
            Rescan
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <span className="label">Depth</span>
        <div className="flex items-center" role="group" aria-label="Scan depth">
          {DEPTH_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onDepthChange(preset)}
              aria-pressed={depth === preset}
              disabled={mode === "demo"}
              title={`Parse up to ${preset} recent transactions`}
              className={`mono h-7 px-2 text-[11px] transition-colors disabled:opacity-40 ${
                depth === preset
                  ? "bg-[#e7e9ec] text-ink"
                  : "text-dim hover:bg-[#171b20] hover:text-[#e7e9ec]"
              }`}
            >
              {preset === 1000 ? "1k" : preset === 2000 ? "2k" : preset}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[2px] w-full bg-line">
          <div
            className="h-full bg-[#d8dbe0] transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 border-b border-line px-4 py-3 text-[11.5px]">
        <div>
          <dt className="text-dim">Signatures</dt>
          <dd className="mono mt-0.5 text-[#d8dbe0]">{observed}</dd>
        </div>
        <div>
          <dt className="text-dim">Parsed</dt>
          <dd className="mono mt-0.5 text-[#d8dbe0]">{parsed}</dd>
        </div>
        <div>
          <dt className="text-dim">Failed</dt>
          <dd className={`mono mt-0.5 ${failed > 0 ? "text-warn" : "text-[#d8dbe0]"}`}>
            {failed}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-dim">Window</dt>
          <dd className="mt-0.5 text-[#b6bdc7]">
            {snapshot
              ? formatDateRange(snapshot.windowStart, snapshot.windowEnd)
              : loading
                ? "reading signatures…"
                : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-dim">Time</dt>
          <dd className="mono mt-0.5 text-[#d8dbe0]">{elapsed}s</dd>
        </div>
        <div className="col-span-3">
          <dt className="text-dim">Endpoint</dt>
          <dd className="mono mt-0.5 truncate text-[11px] text-[#b6bdc7]">
            {snapshot?.rpcHost ?? (mode === "demo" ? "sample fixture" : "publicnode")}
            {snapshot?.cached ? " · cached" : ""}
          </dd>
        </div>
      </dl>

      {skipped > 0 ? (
        <p className="border-b border-line px-4 py-2 text-[10.5px] leading-4 text-dim">
          {skipped} signature{skipped === 1 ? "" : "s"} failed on-chain and were
          excluded from the comparison.
        </p>
      ) : null}

      {error ? (
        <div className="border-b border-line px-4 py-3">
          <p className="border-l-2 border-danger pl-3 text-[11.5px] leading-5 text-[#b6bdc7]">
            <span className="font-medium text-danger">History scan failed. </span>
            {error} Public endpoints rate-limit; lower the depth or set a dedicated
            RPC in <code className="mono text-[#d8dbe0]">NEXT_PUBLIC_SOLANA_RPC_URL</code>.
          </p>
        </div>
      ) : null}

      {mode === "live" && !connected ? (
        <div className="border-b border-line px-4 py-3 text-[11.5px] leading-5 text-dim">
          Connect a wallet to scan real history. The sample wallet is available from
          the mode switch above.
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-4 py-2">
          <span className="label">Address</span>
          <span className="label">Last seen</span>
        </div>

        {loading && !snapshot
          ? [0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="border-b border-line px-4 py-3">
                <div className="h-3 w-2/3 animate-pulse rounded-sm bg-[#1b2026]" />
                <div className="mt-2 h-2.5 w-1/3 animate-pulse rounded-sm bg-[#171b20]" />
              </div>
            ))
          : null}

        {snapshot && counterparties.length === 0 && !loading ? (
          <p className="px-4 py-6 text-[11.5px] leading-5 text-dim">
            No counterparties in this window. Increase the depth, rescan, or use a
            wallet with more activity.
          </p>
        ) : null}

        {counterparties.map((entry) => {
          const isMatch = highlight === entry.address;
          return (
            <div
              key={entry.address}
              className={`flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5 ${
                isMatch ? "bg-danger/[0.07]" : "hover:bg-white/[0.02]"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mono truncate text-[11.5px] text-[#d8dbe0]">
                    {shortAddress(entry.address, 10)}
                  </span>
                  {entry.dustOnly ? (
                    <span className="mono rounded-sm border border-warn/30 px-1 text-[9px] uppercase tracking-[0.1em] text-warn">
                      dust
                    </span>
                  ) : null}
                  {isMatch ? (
                    <span className="mono text-[9px] uppercase tracking-[0.1em] text-danger">
                      match
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[10.5px] text-dim">
                  {entry.label ? `${entry.label} · ` : ""}
                  {flow(entry)}
                </p>
              </div>
              <span className="mono shrink-0 text-[10.5px] text-dim">
                {timeAgo(entry.lastSeen)}
              </span>
            </div>
          );
        })}

        {snapshot && snapshot.counterparties.length > 40 ? (
          <p className="px-4 py-2 text-[10.5px] text-dim">
            Showing 40 of {snapshot.counterparties.length} counterparties.
          </p>
        ) : null}
      </div>

      <p className="border-t border-line px-4 py-3 text-[10.5px] leading-5 text-dim">
        Each transaction is parsed individually, including version 1. Dust means at
        most 0.001 SOL received and nothing ever sent back.
      </p>
    </aside>
  );
}
