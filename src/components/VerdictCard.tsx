"use client";

import { shortAddress } from "@/lib/address";
import { timeAgo } from "@/lib/format";
import type { RiskReport, Verdict } from "@/lib/risk";
import { diffAgainst } from "@/lib/similarity";
import { CopyGuard } from "./CopyGuard";

interface Tone {
  color: string;
  text: string;
  border: string;
  soft: string;
  chip: string;
  mismatch: string;
}

const TONES: Record<Verdict, Tone> = {
  "high-risk": {
    color: "#ff3b5c",
    text: "text-danger",
    border: "border-danger/45",
    soft: "bg-danger/[0.07]",
    chip: "border-danger/40 bg-danger/15 text-danger",
    mismatch: "bg-danger/20 text-danger",
  },
  suspicious: {
    color: "#ffb020",
    text: "text-warn",
    border: "border-warn/40",
    soft: "bg-warn/[0.06]",
    chip: "border-warn/40 bg-warn/15 text-warn",
    mismatch: "bg-warn/20 text-warn",
  },
  safe: {
    color: "#14f195",
    text: "text-safe",
    border: "border-safe/35",
    soft: "bg-safe/[0.05]",
    chip: "border-safe/35 bg-safe/15 text-safe",
    mismatch: "bg-safe/20 text-safe",
  },
  exact: {
    color: "#14f195",
    text: "text-safe",
    border: "border-safe/35",
    soft: "bg-safe/[0.05]",
    chip: "border-safe/35 bg-safe/15 text-safe",
    mismatch: "bg-safe/20 text-safe",
  },
  self: {
    color: "#9945ff",
    text: "text-sol",
    border: "border-sol/40",
    soft: "bg-sol/[0.07]",
    chip: "border-sol/40 bg-sol/15 text-sol",
    mismatch: "bg-sol/20 text-sol",
  },
  invalid: {
    color: "#8b97ab",
    text: "text-mute",
    border: "border-line",
    soft: "bg-white/[0.02]",
    chip: "border-line bg-white/5 text-mute",
    mismatch: "bg-white/10 text-mute",
  },
};

function ScoreRing({ score, color }: { score: number; color: string }) {
  const radius = 33;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <svg viewBox="0 0 88 88" className="h-[88px] w-[88px] shrink-0">
      <circle cx="44" cy="44" r={radius} fill="none" stroke="#1b2333" strokeWidth="7" />
      <circle
        cx="44"
        cy="44"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
        style={{ transition: "stroke-dashoffset .6s ease" }}
      />
      <text
        x="44"
        y="46"
        textAnchor="middle"
        fill="#e8edf6"
        fontSize="21"
        fontWeight="800"
        fontFamily="ui-monospace, monospace"
      >
        {score}
      </text>
      <text x="44" y="60" textAnchor="middle" fill="#8b97ab" fontSize="7" letterSpacing="1.4">
        RISK SCORE
      </text>
    </svg>
  );
}

function AddressLine({
  value,
  mask,
  mismatch,
}: {
  value: string;
  mask?: boolean[];
  mismatch: string;
}) {
  return (
    <code className="mono block break-all text-[13px] leading-6">
      {value.split("").map((char, index) => {
        const matched = mask ? mask[index] : true;
        return matched ? (
          <span key={index} className="text-slate-300">
            {char}
          </span>
        ) : (
          <span key={index} className={`rounded-[3px] px-[2px] font-bold ${mismatch}`}>
            {char}
          </span>
        );
      })}
    </code>
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
    report.verdict !== "invalid" && report.verdict !== "self" && report.verdict !== "exact";

  return (
    <div className={`animate-rise rounded-2xl border ${tone.border} ${tone.soft} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-black ${tone.text}`}
            style={{ backgroundColor: `${tone.color}1f` }}
          >
            {report.verdict === "high-risk"
              ? "!"
              : report.verdict === "suspicious"
                ? "?"
                : report.verdict === "safe" || report.verdict === "exact"
                  ? "✓"
                  : "i"}
          </span>
          <div>
            <h2 className={`text-lg font-bold leading-snug ${tone.text}`}>
              {report.headline}
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-300">
              {report.summary}
            </p>
          </div>
        </div>
        {showScore ? <ScoreRing score={report.score} color={tone.color} /> : null}
      </div>

      {diff && report.best ? (
        <div className="mt-5 space-y-2">
          <div className="rounded-xl border border-line bg-black/35 p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="label">You pasted</p>
              <span className={`chip ${tone.chip}`}>
                {report.verdict === "exact"
                  ? "exact match"
                  : `${report.best.prefix} start · ${report.best.suffix} end`}
              </span>
            </div>
            <AddressLine
              value={diff.candidate}
              mask={diff.candidateMask}
              mismatch={tone.mismatch}
            />
          </div>

          <div className="rounded-xl border border-line bg-black/25 p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="label">Counterparty from your history</p>
              <span className="text-[11px] text-mute">
                {report.best.interactions} interactions · {timeAgo(report.best.lastSeen)}
              </span>
            </div>
            <AddressLine
              value={report.best.address}
              mask={diff.referenceMask}
              mismatch={tone.mismatch}
            />
          </div>

          <p className="text-[11px] leading-5 text-mute">
            {report.verdict === "exact"
              ? "No character differences."
              : `Highlighted characters are the only difference — ${report.best.differingMiddle} of ${Math.max(
                  diff.candidate.length,
                  report.best.address.length,
                )}.`}
          </p>
        </div>
      ) : null}

      {report.reasons.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {report.reasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-[13px] leading-5 text-slate-300">
              <span className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${tone.text} bg-current`} />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {risky && report.matches.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {report.matches.map((match) => (
            <div
              key={match.address}
              className="rounded-xl border border-line bg-black/25 px-3 py-2.5"
            >
              <p className="text-[11px] text-slate-300">
                {match.label ?? "Known counterparty"}
              </p>
              <p className="mono mt-0.5 text-[11px] text-mute">
                {shortAddress(match.address, 8)}
              </p>
              <p className="mt-1 text-[11px] text-mute">
                {match.interactions} interactions · {timeAgo(match.lastSeen)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <CopyGuard
          value={report.candidate}
          risky={risky}
          reference={report.best?.address}
          warning={
            report.best
              ? `This address shares its first ${report.best.prefix} and last ${report.best.suffix} characters with ${shortAddress(report.best.address, 6)} — an address you have used before. That is the signature of an address-poisoning attack.`
              : undefined
          }
        />
        {risky && report.best ? (
          <CopyGuard
            value={report.best.address}
            risky={false}
            label="Copy the real address instead"
          />
        ) : null}
        <a
          href={`https://solscan.io/account/${report.candidate}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[11px] text-mute underline-offset-4 transition hover:text-slate-200 hover:underline"
        >
          View on Solscan ↗
        </a>
      </div>
    </div>
  );
}
