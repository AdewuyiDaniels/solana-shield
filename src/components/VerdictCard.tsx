"use client";

import { shortAddress } from "@/lib/address";
import { timeAgo } from "@/lib/format";
import type { RiskReport, Verdict } from "@/lib/risk";
import { diffAgainst } from "@/lib/similarity";
import { CopyGuard } from "./CopyGuard";

interface Tone {
  label: string;
  color: string;
  chip: string;
}

const TONES: Record<Verdict, Tone> = {
  "high-risk": {
    label: "High risk",
    color: "#ef5f6b",
    chip: "border-danger/40 bg-danger/10 text-danger",
  },
  suspicious: {
    label: "Suspicious",
    color: "#e6b04a",
    chip: "border-warn/40 bg-warn/10 text-warn",
  },
  safe: {
    label: "No match",
    color: "#45d19a",
    chip: "border-safe/35 bg-safe/10 text-safe",
  },
  exact: {
    label: "Exact match",
    color: "#45d19a",
    chip: "border-safe/35 bg-safe/10 text-safe",
  },
  self: {
    label: "Your wallet",
    color: "#99a1ab",
    chip: "border-line2 bg-white/5 text-mute",
  },
  unknown: {
    label: "No history",
    color: "#99a1ab",
    chip: "border-line2 bg-white/5 text-mute",
  },
  invalid: {
    label: "Invalid input",
    color: "#99a1ab",
    chip: "border-line2 bg-white/5 text-mute",
  },
};

function AddressLine({
  value,
  mask,
  highlight,
}: {
  value: string;
  mask?: boolean[];
  highlight: string;
}) {
  return (
    <code className="mono block break-all text-[12.5px] leading-[1.75]">
      {value.split("").map((char, index) => {
        const matched = mask ? mask[index] : true;
        return matched ? (
          <span key={index} className="text-[#c6ccd4]">
            {char}
          </span>
        ) : (
          <span key={index} className={`font-semibold ${highlight}`}>
            {char}
          </span>
        );
      })}
    </code>
  );
}

function DiffRow({
  label,
  value,
  mask,
  highlight,
}: {
  label: string;
  value: string;
  mask?: boolean[];
  highlight: string;
}) {
  return (
    <div className="grid grid-cols-[78px_minmax(0,1fr)] gap-3 px-3 py-2.5 sm:grid-cols-[104px_minmax(0,1fr)]">
      <span className="pt-[3px] text-[10.5px] font-medium uppercase tracking-[0.12em] text-dim">
        {label}
      </span>
      <AddressLine value={value} mask={mask} highlight={highlight} />
    </div>
  );
}

export function VerdictCard({ report }: { report: RiskReport }) {
  const tone = TONES[report.verdict];
  const showDiff =
    Boolean(report.best) &&
    (report.verdict === "high-risk" ||
      report.verdict === "suspicious" ||
      report.verdict === "exact");
  const diff =
    showDiff && report.best ? diffAgainst(report.candidate, report.best.address) : null;
  const risky = report.verdict === "high-risk" || report.verdict === "suspicious";
  const showScore =
    report.verdict === "safe" ||
    report.verdict === "suspicious" ||
    report.verdict === "high-risk";

  const highlight =
    report.verdict === "suspicious" ? "bg-warn/20 text-warn" : "bg-danger/20 text-danger";

  return (
    <div aria-live="polite">
      <div className="h-[2px] w-full" style={{ backgroundColor: tone.color }} />

      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <span
            className="mono text-[10.5px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: tone.color }}
          >
            {tone.label}
          </span>
          <span className="mono text-[11px] text-dim">
            {showScore ? `score ${report.score}/100` : `${report.comparedAgainst} compared`}
          </span>
        </div>

        <h2 className="mt-2 text-[19px] font-semibold leading-snug tracking-tight text-[#f1f2f4]">
          {report.headline}
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-mute">
          {report.summary}
        </p>

        {diff && report.best ? (
          <div className="mt-4 overflow-hidden rounded-md border border-line">
            <DiffRow
              label="Pasted"
              value={diff.candidate}
              mask={diff.candidateMask}
              highlight={highlight}
            />
            <div className="border-t border-line">
              <DiffRow
                label="Your history"
                value={report.best.address}
                mask={diff.referenceMask}
                highlight={highlight}
              />
            </div>
            <div className="mono border-t border-line bg-[#0c0e11] px-3 py-2 text-[11px] text-dim">
              {report.verdict === "exact"
                ? "0 characters differ"
                : `prefix ${report.best.prefix} · suffix ${report.best.suffix} · ${report.best.differingMiddle} of ${Math.max(
                    diff.candidate.length,
                    report.best.address.length,
                  )} characters differ · ${report.best.interactions} interaction${
                    report.best.interactions === 1 ? "" : "s"
                  } · ${timeAgo(report.best.lastSeen)}`}
            </div>
          </div>
        ) : null}

        {report.reasons.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {report.reasons.map((reason) => (
              <li
                key={reason}
                className="grid grid-cols-[12px_minmax(0,1fr)] gap-2 text-[12.5px] leading-5 text-[#b6bdc7]"
              >
                <span aria-hidden className="text-dim">
                  ·
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {risky && report.matches.length > 1 ? (
          <div className="mt-4 border-t border-line pt-3">
            <p className="label mb-2">Matched addresses</p>
            <ul className="space-y-1">
              {report.matches.slice(0, 3).map((match) => (
                <li
                  key={match.address}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11.5px]"
                >
                  <span className="mono text-[#b6bdc7]">
                    {shortAddress(match.address, 9)}
                  </span>
                  <span className="text-dim">
                    {match.label ? `${match.label} · ` : ""}
                    {match.interactions} interaction
                    {match.interactions === 1 ? "" : "s"} · {timeAgo(match.lastSeen)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {risky && report.best ? (
            <CopyGuard
              value={report.best.address}
              risky={false}
              label="Copy verified address"
              variant="primary"
            />
          ) : null}
          <CopyGuard
            value={report.candidate}
            risky={risky}
            reference={report.best?.address}
            variant={risky ? "secondary" : "primary"}
            label={risky ? "Copy pasted address" : "Copy address"}
            warning={
              report.best
                ? `This address shares its first ${report.best.prefix} and last ${report.best.suffix} characters with ${shortAddress(
                    report.best.address,
                    6,
                  )}, an address you have used before.`
                : undefined
            }
          />
          <a
            href={`https://solscan.io/account/${report.candidate}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-[11.5px] text-dim transition-colors hover:text-[#e7e9ec]"
          >
            Solscan ↗
          </a>
        </div>
      </div>
    </div>
  );
}
