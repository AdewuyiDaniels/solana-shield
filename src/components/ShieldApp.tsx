"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { normalizeAddress, shortAddress } from "@/lib/address";
import { getDemoBundle } from "@/lib/demo";
import { hostOf } from "@/lib/format";
import { fetchHistorySnapshot } from "@/lib/history";
import { evaluateAddress } from "@/lib/risk";
import type { DataMode, HistorySnapshot } from "@/lib/types";
import { Education } from "./Education";
import { HistoryPanel } from "./HistoryPanel";
import { VerdictCard } from "./VerdictCard";

type ScanStatus = "idle" | "loading" | "ready" | "error";

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden>
      <defs>
        <linearGradient id="shield-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9945ff" />
          <stop offset="100%" stopColor="#14f195" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5 27 6.5v9.2c0 6.6-4.4 11.6-11 13.8-6.6-2.2-11-7.2-11-13.8V6.5L16 2.5Z"
        fill="url(#shield-gradient)"
        opacity="0.16"
      />
      <path
        d="M16 2.5 27 6.5v9.2c0 6.6-4.4 11.6-11 13.8-6.6-2.2-11-7.2-11-13.8V6.5L16 2.5Z"
        fill="none"
        stroke="url(#shield-gradient)"
        strokeWidth="1.6"
      />
      <path
        d="m11 16.4 3.2 3.2L21 12.8"
        fill="none"
        stroke="#14f195"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: DataMode;
  onChange: (mode: DataMode) => void;
}) {
  return (
    <div className="flex rounded-xl border border-line bg-black/30 p-0.5 text-xs font-semibold">
      {(["demo", "live"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-[10px] px-3 py-1.5 transition ${
            mode === option
              ? "bg-white/10 text-white"
              : "text-mute hover:text-slate-200"
          }`}
        >
          {option === "demo" ? "Demo" : "Live"}
        </button>
      ))}
    </div>
  );
}

const STEPS = [
  { title: "Paste", body: "Drop any Solana address into the box." },
  { title: "Compare", body: "We diff it against your recent counterparties." },
  { title: "Decide", body: "Safe, suspicious, or likely poisoned — before you sign." },
];

export default function ShieldApp() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const demo = useMemo(() => getDemoBundle(), []);
  const rpcHost = useMemo(
    () =>
      hostOf(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
          "https://api.mainnet-beta.solana.com",
      ),
    [],
  );

  const [mode, setMode] = useState<DataMode>("demo");
  const [snapshot, setSnapshot] = useState<HistorySnapshot | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [candidate, setCandidate] = useState("");

  const loadDemo = useCallback(() => {
    setSnapshot(demo.snapshot);
    setStatus("ready");
    setError(null);
    setProgress(null);
  }, [demo]);

  const loadLive = useCallback(
    async (address: string) => {
      setStatus("loading");
      setError(null);
      setProgress({ done: 0, total: 0 });
      setSnapshot(null);
      try {
        const result = await fetchHistorySnapshot(connection, address, {
          limit: 40,
          onProgress: (done, total) => setProgress({ done, total }),
        });
        setSnapshot(result);
        setStatus("ready");
      } catch (cause) {
        setStatus("error");
        setError(
          cause instanceof Error
            ? cause.message
            : "The RPC request failed before any history could be read.",
        );
      }
    },
    [connection],
  );

  useEffect(() => {
    if (mode === "demo") loadDemo();
  }, [mode, loadDemo]);

  useEffect(() => {
    if (mode === "live" && connected && publicKey) {
      void loadLive(publicKey.toBase58());
    }
  }, [mode, connected, publicKey, loadLive]);

  useEffect(() => {
    if (mode === "live" && !connected) {
      setSnapshot(null);
      setStatus("idle");
      setError(null);
      setProgress(null);
    }
  }, [mode, connected]);

  const known = useMemo(() => snapshot?.counterparties ?? [], [snapshot]);
  const ownWallet = mode === "live" ? (publicKey?.toBase58() ?? null) : (snapshot?.wallet ?? null);

  const report = useMemo(
    () => (candidate.trim() ? evaluateAddress(candidate, known, ownWallet) : null),
    [candidate, known, ownWallet],
  );

  const switchMode = useCallback((next: DataMode) => {
    setMode(next);
    setCandidate("");
    setError(null);
    setProgress(null);
    setSnapshot(null);
    setStatus("idle");
  }, []);

  const refresh = useCallback(() => {
    if (mode === "demo") {
      loadDemo();
      return;
    }
    if (publicKey) void loadLive(publicKey.toBase58());
  }, [mode, publicKey, loadDemo, loadLive]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setCandidate(normalizeAddress(text));
    } catch {
      return;
    }
  }, []);

  const focusResult = useCallback(() => {
    document.getElementById("verdict")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="text-base font-bold leading-tight text-white">Solana Shield</p>
            <p className="text-[11px] text-mute">Address-poisoning firewall</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[11px] text-mute sm:inline-flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                mode === "demo"
                  ? "bg-sol"
                  : connected
                    ? "bg-safe"
                    : "bg-mute"
              }`}
            />
            {mode === "demo" ? "Demo data" : connected ? rpcHost : "Not connected"}
          </span>
          <ModeSwitch mode={mode} onChange={switchMode} />
          <WalletMultiButton />
        </div>
      </header>

      <section className="mt-10">
        <span className="chip border-sol/30 text-sol">Solana × MLH Hackathon · 2026</span>
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl">
          Stop address poisoning
          <span className="block bg-gradient-to-r from-sol to-safe bg-clip-text text-transparent">
            before you send.
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-mute sm:text-base">
          Paste the destination address. Solana Shield diffs it against every
          counterparty in your recent history and catches the lookalikes that
          copy the first and last characters of an address you already trust.
        </p>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="card p-5 shadow-glow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label">Destination address</p>
            {snapshot ? (
              <span className="chip">
                diffed against {known.length} address{known.length === 1 ? "" : "es"}
              </span>
            ) : (
              <span className="chip">
                {mode === "demo" ? "simulated history" : "waiting for history"}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                value={candidate}
                onChange={(event) => setCandidate(event.target.value)}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                aria-label="Solana address to check"
                placeholder="Paste a Solana address (base58)"
                className="mono w-full rounded-xl border border-line bg-black/40 px-4 py-3.5 pr-24 text-sm text-slate-100 outline-none transition placeholder:text-mute/60 focus:border-sol/60"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handlePaste()}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-mute transition hover:bg-white/5 hover:text-slate-200"
                >
                  Paste
                </button>
                {candidate ? (
                  <button
                    type="button"
                    onClick={() => setCandidate("")}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-mute transition hover:bg-white/5 hover:text-slate-200"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={focusResult}
              disabled={!candidate.trim() || status === "loading"}
              className="btn-primary sm:w-auto"
            >
              Check address
            </button>
          </div>

          <p className="mt-2 text-[11px] text-mute">
            Analysis is instant and local. Your address never leaves this browser.
          </p>

          {mode === "demo" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-mute">Demo targets:</span>
              <button
                type="button"
                onClick={() => setCandidate(demo.lookalike)}
                className="chip border-danger/40 text-danger transition hover:bg-danger/10"
              >
                Poisoned lookalike
              </button>
              <button
                type="button"
                onClick={() => setCandidate(demo.real)}
                className="chip border-safe/35 text-safe transition hover:bg-safe/10"
              >
                Real address
              </button>
              <button
                type="button"
                onClick={() => setCandidate(demo.suspicious)}
                className="chip border-warn/35 text-warn transition hover:bg-warn/10"
              >
                Weak lookalike
              </button>
              <button
                type="button"
                onClick={() => setCandidate(demo.unrelated)}
                className="chip transition hover:text-slate-200"
              >
                Unknown address
              </button>
            </div>
          ) : null}

          {mode === "live" && !connected ? (
            <div className="mt-4 rounded-xl border border-warn/25 bg-warn/5 p-3 text-[12px] leading-5 text-warn">
              Connect Phantom or Solflare with the button above to scan your own
              history. Prefer not to? Switch to{" "}
              <span className="font-semibold">Demo</span> — it needs no wallet.
            </div>
          ) : null}

          <div id="verdict" className="mt-5 scroll-mt-6">
            {report ? (
              <VerdictCard report={report} />
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-white/[0.015] p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  {STEPS.map((step, index) => (
                    <div key={step.title} className="flex gap-3">
                      <span className="mono mt-0.5 text-[11px] font-bold text-sol">
                        0{index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          {step.title}
                        </p>
                        <p className="mt-1 text-[12px] leading-5 text-mute">
                          {step.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 border-t border-line pt-3 text-[11px] text-mute">
                  {snapshot
                    ? `Ready — ${known.length} counterparties in context. Paste an address to see the verdict.`
                    : "Waiting for history…"}
                </p>
              </div>
            )}
          </div>
        </section>

        <HistoryPanel
          snapshot={snapshot}
          mode={mode}
          status={status}
          progress={progress}
          error={error}
          highlight={report?.best?.address ?? null}
          connected={connected}
          onRefresh={refresh}
        />
      </div>

      <Education />

      <footer className="mt-14 border-t border-line pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-[11px] leading-5 text-mute">
            Solana Shield is a hackathon MVP. It compares an address against your
            own recent counterparties only — it is a strong warning system, not a
            guarantee. Always confirm the full address out-of-band before sending
            funds.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip">Next.js 14</span>
            <span className="chip">@solana/web3.js</span>
            <span className="chip">Client-side only</span>
            <span className="chip">No keys, ever</span>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-mute/70">
          Built for the Solana × MLH Hackathon, November 2026. Current context:{" "}
          {shortAddress(snapshot?.wallet ?? "no wallet", 6)} ·{" "}
          {mode === "demo" ? "simulated data" : rpcHost}.
        </p>
      </footer>
    </div>
  );
}
