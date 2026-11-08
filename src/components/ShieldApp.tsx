"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { isValidSolanaAddress, normalizeAddress } from "@/lib/address";
import { getDemoBundle } from "@/lib/demo";
import { hostOf } from "@/lib/format";
import {
  fetchHistorySnapshot,
  readCachedSnapshot,
  writeCachedSnapshot,
} from "@/lib/history";
import { applyReputation, fetchAddressReputation } from "@/lib/reputation";
import { evaluateAddress, findHistoryLookalikes } from "@/lib/risk";
import {
  DEFAULT_DEPTH,
  type AddressReputation,
  type DataMode,
  type HistorySnapshot,
  type ScanProgress,
} from "@/lib/types";
import { Education } from "./Education";
import { HistoryAlert } from "./HistoryAlert";
import { HistoryPanel } from "./HistoryPanel";
import { VerdictCard } from "./VerdictCard";

type ScanStatus = "idle" | "loading" | "ready" | "error";

const DEPTH_STORAGE_KEY = "solana-shield:depth";

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path
        d="M12 2.8 20 5.8v6c0 4.8-3.2 8.4-8 10-4.8-1.6-8-5.2-8-10v-6L12 2.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="m8.6 12 2.4 2.4 4.5-4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const EMPTY_STEPS = [
  {
    title: "Paste the destination",
    body: "A wallet address, a Solana Pay link, or a copy from another app.",
  },
  {
    title: "Shield diffs it against your history",
    body: "Every counterparty in the scanned window is compared on its opening and closing characters.",
  },
  {
    title: "You see the exact characters that differ",
    body: "High risk, suspicious, exact, or no match — with the evidence behind it.",
  },
];

export default function ShieldApp() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const demo = useMemo(() => getDemoBundle(), []);
  const rpcHost = useMemo(
    () =>
      hostOf(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
          "https://solana-rpc.publicnode.com",
      ),
    [],
  );

  const [mode, setMode] = useState<DataMode>("live");
  const [depth, setDepth] = useState<number>(DEFAULT_DEPTH);
  const [snapshot, setSnapshot] = useState<HistorySnapshot | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [candidate, setCandidate] = useState("");
  const [network, setNetwork] = useState<{
    address: string;
    reputation: AddressReputation;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reputationCache = useRef(new Map<string, AddressReputation>());

  useEffect(() => {
    const stored = window.localStorage.getItem(DEPTH_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if ([100, 500, 1000, 2000].includes(parsed)) setDepth(parsed);
  }, []);

  const changeDepth = useCallback((next: number) => {
    setDepth(next);
    try {
      window.localStorage.setItem(DEPTH_STORAGE_KEY, String(next));
    } catch {
      // Private mode can block storage; depth still applies to this session.
    }
  }, []);

  const loadLive = useCallback(
    async (address: string, options: { force?: boolean } = {}) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!options.force) {
        const cached = readCachedSnapshot(address, depth);
        if (cached) {
          setSnapshot(cached);
          setStatus("ready");
          setError(null);
          setProgress(null);
          return;
        }
      }

      setStatus("loading");
      setError(null);
      setSnapshot(null);
      setProgress({ phase: "signatures", done: 0, total: depth });

      try {
        const result = await fetchHistorySnapshot(connection, address, {
          depth,
          signal: controller.signal,
          onProgress: setProgress,
          onPartial: (partial) => {
            if (!controller.signal.aborted) setSnapshot(partial);
          },
        });
        if (controller.signal.aborted) return;
        writeCachedSnapshot(result);
        setSnapshot(result);
        setStatus("ready");
        setProgress(null);
      } catch (cause) {
        if (
          controller.signal.aborted ||
          (cause instanceof Error && cause.name === "AbortError")
        ) {
          return;
        }
        setStatus("error");
        setProgress(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "The RPC request failed before any history could be read.",
        );
      }
    },
    [connection, depth],
  );

  const loadDemo = useCallback(() => {
    abortRef.current?.abort();
    setSnapshot(demo.snapshot);
    setStatus("ready");
    setError(null);
    setProgress(null);
  }, [demo]);

  useEffect(() => {
    if (mode === "demo") {
      loadDemo();
      return;
    }
    if (!connected || !walletAddress) {
      setSnapshot(null);
      setStatus("idle");
      setError(null);
      setProgress(null);
      return;
    }
    void loadLive(walletAddress);
  }, [mode, connected, walletAddress, depth, loadDemo, loadLive]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const known = useMemo(() => snapshot?.counterparties ?? [], [snapshot]);
  const ownWallet = mode === "live" ? walletAddress : (snapshot?.wallet ?? null);

  useEffect(() => {
    setNetwork(null);
    const address = normalizeAddress(candidate);
    if (mode !== "live" || !isValidSolanaAddress(address)) return;

    const cached = reputationCache.current.get(address);
    if (cached) {
      setNetwork({ address, reputation: cached });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchAddressReputation(connection, address, {
        signal: controller.signal,
      })
        .then((reputation) => {
          if (controller.signal.aborted) return;
          reputationCache.current.set(address, reputation);
          setNetwork({ address, reputation });
        })
        .catch(() => {
          // The local history verdict still stands; network lookup is optional.
        });
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [candidate, mode, connection]);

  const report = useMemo(() => {
    if (!candidate.trim()) return null;
    const base = evaluateAddress(candidate, known, ownWallet);
    const reputation =
      network && network.address === normalizeAddress(candidate)
        ? network.reputation
        : null;
    return applyReputation(base, reputation);
  }, [candidate, known, ownWallet, network]);

  const historyLookalikes = useMemo(() => findHistoryLookalikes(known), [known]);

  const switchMode = useCallback((next: DataMode) => {
    if (next === mode) return;
    abortRef.current?.abort();
    setMode(next);
    setCandidate("");
    setError(null);
    setProgress(null);
    setSnapshot(null);
    setStatus("idle");
  }, [mode]);

  const rescan = useCallback(() => {
    if (mode === "demo") {
      loadDemo();
      return;
    }
    if (walletAddress) void loadLive(walletAddress, { force: true });
  }, [mode, walletAddress, loadDemo, loadLive]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setProgress(null);
    setStatus(snapshot ? "ready" : "idle");
  }, [snapshot]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setCandidate(normalizeAddress(text));
    } catch {
      // Clipboard permission denied: the input is still editable by hand.
    }
  }, []);

  const focusResult = useCallback(() => {
    if (window.innerWidth >= 1024) return;
    document.getElementById("verdict")?.scrollIntoView({ block: "nearest" });
  }, []);

  const statusText =
    mode === "demo"
      ? "sample wallet"
      : connected
        ? rpcHost
        : "wallet not connected";

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-[1160px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="text-[#e7e9ec]">
              <Mark />
            </span>
            <span className="text-[14px] font-semibold tracking-tight text-[#f1f2f4]">
              Solana Shield
            </span>
            <span className="mono hidden text-[10.5px] text-dim sm:inline">
              {statusText}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex h-8 items-center rounded-md border border-line"
              role="group"
              aria-label="Data source"
            >
              {(["live", "demo"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => switchMode(option)}
                  aria-pressed={mode === option}
                  className={`h-full px-2.5 text-[11.5px] font-medium transition-colors ${
                    mode === option
                      ? "bg-[#1a1f25] text-[#f1f2f4]"
                      : "text-dim hover:text-[#d8dbe0]"
                  }`}
                >
                  {option === "live" ? "Live" : "Sample"}
                </button>
              ))}
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1160px] px-4 pb-10 sm:px-6">
        <section className="py-7 sm:py-9">
          <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-dim">
            Solana mainnet · client-side
          </p>
          <h1 className="mt-2.5 max-w-3xl text-[26px] font-semibold leading-[1.15] tracking-tight text-[#f4f5f7] sm:text-[32px]">
            Check an address against your own history.
          </h1>
          <p className="mt-2.5 max-w-2xl text-[13px] leading-6 text-mute">
            Address poisoning hides a fake wallet behind the same first and last
            characters as one you already pay. Paste a destination and Shield diffs
            it against the counterparties in your recent transactions — on this
            device, with no keys and no server.
          </p>
        </section>

        <HistoryAlert pairs={historyLookalikes} />

        <section className="panel mt-5 overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="min-w-0 lg:border-r lg:border-line">
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label htmlFor="candidate" className="label">
                    Destination address
                  </label>
                  <span className="mono text-[10.5px] text-dim">
                    {snapshot
                      ? `${known.length} addresses in context`
                      : mode === "live" && !connected
                        ? "wallet not connected"
                        : "waiting for history"}
                  </span>
                </div>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <input
                      id="candidate"
                      value={candidate}
                      onChange={(event) => setCandidate(event.target.value)}
                      spellCheck={false}
                      autoComplete="off"
                      autoCapitalize="off"
                      aria-label="Solana address to check"
                      placeholder="Base58 address or solana: link"
                      className="field mono pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePaste()}
                      className="absolute right-1 top-1 h-9 px-2 text-[11px] font-medium text-dim transition-colors hover:text-[#e7e9ec]"
                    >
                      Paste
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={focusResult}
                    disabled={!candidate.trim()}
                    className="btn-primary h-11 sm:w-28"
                  >
                    Check
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-dim">
                    Analysis is local and instant. Your address is never transmitted.
                  </p>
                  {candidate ? (
                    <button
                      type="button"
                      onClick={() => setCandidate("")}
                      className="text-[11px] text-dim hover:text-[#e7e9ec]"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                {mode === "demo" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[10.5px] text-dim">Try:</span>
                    <button
                      type="button"
                      onClick={() => setCandidate(demo.lookalike)}
                      className="text-[11px] text-danger hover:underline hover:underline-offset-4"
                    >
                      Poisoned lookalike
                    </button>
                    <button
                      type="button"
                      onClick={() => setCandidate(demo.real)}
                      className="text-[11px] text-safe hover:underline hover:underline-offset-4"
                    >
                      Real address
                    </button>
                    <button
                      type="button"
                      onClick={() => setCandidate(demo.suspicious)}
                      className="text-[11px] text-warn hover:underline hover:underline-offset-4"
                    >
                      Weak lookalike
                    </button>
                    <button
                      type="button"
                      onClick={() => setCandidate(demo.unrelated)}
                      className="text-[11px] text-mute hover:text-[#e7e9ec] hover:underline hover:underline-offset-4"
                    >
                      Unknown address
                    </button>
                  </div>
                ) : null}

                {mode === "live" && !connected ? (
                  <p className="mt-3 text-[11.5px] leading-5 text-dim">
                    Connect a wallet to read your own history, or open the{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("demo")}
                      className="text-[#d8dbe0] underline underline-offset-4 hover:text-white"
                    >
                      sample wallet
                    </button>{" "}
                    to see the checks.
                  </p>
                ) : null}
              </div>

              <div id="verdict" className="border-t border-line">
                {report ? (
                  <VerdictCard report={report} />
                ) : (
                  <div className="px-4 py-5 sm:px-5">
                    <ol className="space-y-2">
                      {EMPTY_STEPS.map((step, index) => (
                        <li
                          key={step.title}
                          className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-[12px] leading-5"
                        >
                          <span className="mono text-[10.5px] text-dim">
                            0{index + 1}
                          </span>
                          <span>
                            <span className="font-medium text-[#d8dbe0]">
                              {step.title}.
                            </span>{" "}
                            <span className="text-mute">{step.body}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-4 border-t border-line pt-3 text-[11px] text-dim">
                      {snapshot
                        ? `Ready — ${known.length} counterpart${known.length === 1 ? "y" : "ies"} loaded. Paste an address to see the verdict.`
                        : mode === "live" && !connected
                          ? "Connect a wallet to scan, or open the sample wallet."
                          : "Reading history…"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <HistoryPanel
              snapshot={snapshot}
              mode={mode}
              status={status}
              progress={progress}
              error={error}
              highlight={report?.best?.address ?? null}
              connected={connected}
              depth={depth}
              onDepthChange={changeDepth}
              onRefresh={rescan}
              onStop={stop}
            />
          </div>
        </section>

        <Education />

        <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[11px] text-dim">
          <p className="max-w-xl leading-5">
            Hackathon build. It compares only the scanned window and is a warning,
            not a guarantee. Confirm the full address out-of-band before sending.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/AdewuyiDaniels/solana-shield"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-[#e7e9ec]"
            >
              Source
            </a>
            <span className="mono">Solana × MLH 2026</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
