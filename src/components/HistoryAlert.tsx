"use client";

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
    <code className="mono block break-all text-[12px] leading-[1.75]">
      {value.split("").map((char, index) =>
        mask[index] ? (
          <span key={index} className="text-[#c6ccd4]">
            {char}
          </span>
        ) : (
          <span
            key={index}
            className={`font-semibold ${
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
    <section className="mt-6 border-l-2 border-danger bg-danger/[0.04] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-danger">
          Detected in your history
        </p>
        <span className="mono text-[10.5px] text-dim">
          {pairs.length} lookalike pair{pairs.length === 1 ? "" : "s"}
        </span>
      </div>

      <h2 className="mt-2 text-[17px] font-semibold leading-snug text-[#f1f2f4]">
        Another address is impersonating one you already use
      </h2>
      <p className="mt-1.5 max-w-3xl text-[12.5px] leading-6 text-mute">
        {pairs.length === 1 ? "Two addresses" : `${pairs.length} pairs of addresses`}{" "}
        here share the same opening and closing characters. At most one of each pair
        can be the real counterparty; the other arrived by dust and is built to be
        copied by mistake.
      </p>

      <div className="mt-3">
        {pairs.slice(0, 2).map((pair) => {
          const diff = diffAgainst(pair.suspect.address, pair.reference.address);
          return (
            <div
              key={`${pair.suspect.address}-${pair.reference.address}`}
              className="border-t border-line py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-danger">
                  Likely attacker
                </span>
                <span className="mono text-[10.5px] text-dim">
                  {pair.suspect.dustOnly ? "dust only · " : ""}
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

              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                <span className="mono text-[10px] font-medium uppercase tracking-[0.14em] text-safe">
                  Address you use
                </span>
                <span className="mono text-[10.5px] text-dim">
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
                <span className="mono text-[10.5px] text-dim">
                  first {pair.prefix} · last {pair.suffix} · middle differs
                </span>
                <CopyGuard
                  value={pair.reference.address}
                  risky={false}
                  label="Copy verified address"
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-line pt-3 text-[11px] leading-5 text-dim">
        Delete the dust transfer if your wallet allows it, and never copy an address
        from a shortened display.
      </p>
    </section>
  );
}
