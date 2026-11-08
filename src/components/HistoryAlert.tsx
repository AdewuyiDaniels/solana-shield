"use client";

import { shortAddress } from "@/lib/address";
import { timeAgo } from "@/lib/format";
import type { HistoryLookalike } from "@/lib/risk";
import { diffAgainst } from "@/lib/similarity";
import { CopyGuard } from "./CopyGuard";

function Highlighted({
  value,
  mask,
  danger,
}: {
  value: string;
  mask: boolean[];
  danger: boolean;
}) {
  return (
    <code className="mono block break-all text-[12px] leading-6">
      {value.split("").map((char, index) =>
        mask[index] ? (
          <span key={index} className="text-slate-300">
            {char}
          </span>
        ) : (
          <span
            key={index}
            className={`rounded-[3px] px-[2px] font-bold ${
              danger ? "bg-danger/20 text-danger" : "bg-safe/20 text-safe"
            }`}
          >
            {char}
          </span>
        ),
      )}
    </code>
  );
}

export function HistoryAlert({ pairs }: { pairs: HistoryLookalike[] }) {
  if (pairs.length === 0) return null;

  return (
    <div className="animate-rise mt-8 rounded-2xl border border-danger/40 bg-danger/[0.07] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/15 text-base font-black text-danger">
          !
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-danger">
            Poisoning already sitting in this history
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            {pairs.length === 1
              ? "Two addresses in your history share the same start and end characters."
              : `${pairs.length} pairs of addresses in your history share the same start and end characters.`}{" "}
            One of each pair was almost certainly sent to you as dust to poison
            your clipboard.
          </p>

          <div className="mt-4 space-y-3">
            {pairs.slice(0, 2).map((pair) => {
              const diff = diffAgainst(pair.suspect.address, pair.reference.address);
              return (
                <div
                  key={`${pair.suspect.address}-${pair.reference.address}`}
                  className="rounded-xl border border-line bg-black/30 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="label text-danger">Likely attacker (fewer interactions)</p>
                    <span className="text-[11px] text-mute">
                      {pair.suspect.interactions} interaction
                      {pair.suspect.interactions === 1 ? "" : "s"} ·{" "}
                      {timeAgo(pair.suspect.lastSeen)}
                    </span>
                  </div>
                  <Highlighted
                    value={pair.suspect.address}
                    mask={diff.candidateMask}
                    danger
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="label text-safe">Address you actually use</p>
                    <span className="text-[11px] text-mute">
                      {pair.reference.interactions} interactions ·{" "}
                      {timeAgo(pair.reference.lastSeen)}
                    </span>
                  </div>
                  <Highlighted
                    value={pair.reference.address}
                    mask={diff.referenceMask}
                    danger={false}
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="chip border-danger/30 text-danger">
                      {pair.prefix} start · {pair.suffix} end match
                    </span>
                    <CopyGuard
                      value={pair.reference.address}
                      risky={false}
                      label="Copy the verified address"
                    />
                    <span className="text-[11px] text-mute">
                      {shortAddress(pair.suspect.address, 6)} is not the same wallet.
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] leading-5 text-mute">
            Remove the dust transfer from your history view if your wallet allows
            it, and never copy an address from a shortened display.
          </p>
        </div>
      </div>
    </div>
  );
}
