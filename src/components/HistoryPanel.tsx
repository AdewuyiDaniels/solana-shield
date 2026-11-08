"use client";

import { shortAddress } from "@/lib/address";
import { timeAgo } from "@/lib/format";
import type { DataMode, HistorySnapshot } from "@/lib/types";

interface HistoryPanelProps {
  snapshot: HistorySnapshot | null;
  mode: DataMode;
  status: "idle" | "loading" | "ready" | "error";
  progress: { done: number; total: number } | null;
  error: string | null;
  highlight: string | null;
  connected: boolean;
  onRefresh: () => void;
}

export function HistoryPanel({
  snapshot,
  mode,
  status,
  progress,
  error,
  highlight,
  connected,
  onRefresh,
}: HistoryPanelProps) {
  const counterparties = snapshot?.counterparties.slice(0, 8) ?? [];
  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : status === "loading"
        ? 15
        : 0;

  return (
    <aside className="card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label">Transaction context</p>
          <p className="mt-1 text-sm font-semibold text-slate-200">
            {mode === "demo" ? "Simulated wallet history" : "Your recent counterparties"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={status === "loading" || (mode === "live" && !connected)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-mute transition hover:bg-white/5 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "loading" ? "Scanning…" : "Refresh"}
        </button>
      </div>

      {snapshot ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip">{snapshot.scanned} txs scanned</span>
          <span className="chip">{snapshot.counterparties.length} addresses</span>
          <span className="chip">{snapshot.elapsedMs} ms</span>
          {snapshot.truncated ? <span className="chip">latest only</span> : null}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sol to-safe transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-mute">
            {mode === "live"
              ? `Reading signatures and parsing transfers… ${progress?.done ?? 0}/${progress?.total ?? 0}`
              : "Loading demo fixture…"}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-3">
          <p className="text-xs font-semibold text-danger">History scan failed</p>
          <p className="mt-1 text-[11px] leading-5 text-mute">{error}</p>
          <p className="mt-2 text-[11px] leading-5 text-mute">
            Public RPC endpoints rate-limit hard. Switch to demo mode for a reliable
            demo, or set a Helius / QuickNode endpoint in{" "}
            <code className="mono text-slate-300">NEXT_PUBLIC_SOLANA_RPC_URL</code>.
          </p>
        </div>
      ) : null}

      {mode === "live" && !connected ? (
        <div className="mt-4 rounded-xl border border-warn/25 bg-warn/5 p-3 text-[11px] leading-5 text-warn">
          Connect a wallet (top right) to scan your own history, or flip the toggle
          to <span className="font-semibold">Demo</span> to explore with simulated data.
        </div>
      ) : null}

      <div className="mt-3 flex-1 space-y-2">
        {status === "loading" && !snapshot
          ? [0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-[52px] animate-pulse rounded-xl border border-line bg-white/[0.02]"
              />
            ))
          : null}

        {snapshot && counterparties.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-line p-4 text-[11px] leading-5 text-mute">
            No counterparties found in the last {snapshot.scanned} transactions. A
            wallet with more activity gives far better protection.
          </div>
        ) : null}

        {counterparties.map((entry) => {
          const isMatch = highlight === entry.address;
          return (
            <div
              key={entry.address}
              className={`rounded-xl border px-3 py-2.5 transition ${
                isMatch
                  ? "border-danger/50 bg-danger/[0.07]"
                  : "border-line bg-white/[0.015]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-slate-200">
                  {entry.label ?? "Unknown"}
                </p>
                {isMatch ? (
                  <span className="shrink-0 rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-bold text-danger">
                    MATCH
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] text-mute">
                    {timeAgo(entry.lastSeen)}
                  </span>
                )}
              </div>
              <code className="mono mt-0.5 block text-[11px] text-mute">
                {shortAddress(entry.address, 10)}
              </code>
              <p className="mt-1 text-[10px] text-mute/80">
                {entry.interactions} interaction{entry.interactions === 1 ? "" : "s"}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-line pt-3 text-[10px] leading-5 text-mute/80">
        Counterparties are derived from SOL balance increases and token transfers in
        your last 40 signatures. Everything is computed in your browser — no private
        keys, no server.
      </p>
    </aside>
  );
}
