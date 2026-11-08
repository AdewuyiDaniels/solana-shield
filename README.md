# Solana Shield

**Stop address poisoning before you send.**

Paste a Solana address, and Solana Shield diffs it against every counterparty in
your recent transaction history. If the address copies the opening and closing
characters of an address you already use — the signature of an address-poisoning
attack — it is flagged **High Risk** before you sign anything.

Built for the Solana × MLH Hackathon, November 2026.

---

## What it does

1. Connects Phantom, Solflare, Backpack, or any Wallet Standard wallet.
2. Reads the last 100, 500, 1,000, or 2,000 signatures of the connected wallet
   (default 500). Signatures are paginated; transactions are then fetched
   individually with concurrency 10, because batched `getTransaction` is rejected
   by many public endpoints.
3. Extracts counterparties from SOL/token balance changes, including dust
   senders who paid the fee.
4. Diffs the pasted address against each counterparty.
5. Audits your own history for two counterparties that share the same visible
   start and end — i.e. a poisoning attempt that already reached you.
6. Profiles the pasted address's **own** public history (100 signatures, 80
   parsed): how many transfers it sent, how many were dust, and how many
   distinct wallets it dusted. A one-way dust fan-out raises the verdict even
   when the address has never touched your wallet.
7. Returns one of seven verdicts with a character-level diff:

| Verdict | Meaning |
|---|---|
| `high-risk` | Shares first **4+** and last **4+** characters with a known address, but is not that address. Classic poison. |
| `suspicious` | Strong partial anchor match (3+3, or a 5+ character prefix/suffix). Verify manually. |
| `safe` | No anchor pattern found. Not a guarantee of legitimacy. |
| `exact` | The pasted address is literally in your history and you have sent it funds. |
| `self` | You are about to send to your own wallet. |
| `unknown` | No history to compare against yet — connect a wallet or raise the depth. |
| `invalid` | Not a base58-encoded 32-byte public key. |

Addresses that only ever dusted you are never treated as exact matches; they are
reported as `suspicious` with "known only from a dust transfer".

Everything is computed in the browser. No backend. No private keys. No address
ever leaves the page.

### Beyond your own history

There is no public list of Solana poisoners, so Shield does not pretend to have
one. Instead it reads the pasted address's **own** recent signatures and scores
its behaviour: dust transfers, distinct recipients, and inflows. An address that
sent 40 dust transfers to 38 wallets and received almost nothing back is flagged
as a **dust fan-out** even if you have never transacted with it. The lookup uses
the same free public RPC, adds no account or API key, and is cached per address
for the session.

This is behavioural evidence, not a global index. The roadmap is an indexer that
clusters dust senders across the chain; the scanner already exposes the signal
that indexer would use.

---

## Why this beats the naive PRD algorithm

The original spec called for Levenshtein distance and a `>70% similarity`
threshold. That does **not** catch real poisoning: an attacker's address is
random in the middle and only matches on the visible ends, so whole-string
similarity is close to zero.

Solana Shield scores the **anchored regions** instead:

- `commonPrefixLength(candidate, known)`
- `commonSuffixLength(candidate, known)` (computed after the prefix so it never
  double-counts)
- `differingMiddle` — the number of characters that differ between the anchors

The rule is: **`prefix >= 4 && suffix >= 4 && candidate !== known` → high risk.**
Two independent random base58 addresses share 4 leading *and* 4 trailing
characters with probability around `58^-8` (about 1 in 128 trillion), so a match
is effectively proof of intent, not chance. That makes the 4-and-4 rule both
extremely sensitive and nearly false-positive free.

---

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- `@solana/web3.js` 1.x
- `@solana/wallet-adapter-react` / `-react-ui` / `-phantom` / `-solflare`
- Vitest for the detection engine

No backend, no database, no API keys.

---

## Run locally

```bash
npm install
cp .env.example .env.local   # optional, see below
npm run dev                  # http://localhost:3000
```

The app boots in **Live** mode — connect a wallet and it scans real mainnet
history. **Demo** mode uses a deterministic simulated history and needs no
wallet, which is useful as a fallback if the venue wifi or the RPC misbehaves.

### Environment

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-rpc.publicnode.com
```

`publicnode` needs no key, allows CORS, and works from the browser. For heavy
use, put a free Helius / QuickNode mainnet URL here instead. The scanner also
fails over between the configured endpoint and two public fallbacks, and fetches
transactions one-by-one with concurrency 10 — never as a batch.

---

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm test           # vitest run (engine + extraction)
```

---

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import it in Vercel — the Next.js preset needs no configuration.
3. Add `NEXT_PUBLIC_SOLANA_RPC_URL` in Project → Settings → Environment
   Variables (use a Helius/QuickNode URL, not the public one, for the demo).
4. Deploy.

---

## Project layout

```
src/
  app/
    layout.tsx        # metadata + dark shell
    page.tsx          # mounts the wallet providers
    providers.tsx     # ConnectionProvider + WalletProvider + modal
    globals.css       # theme + wallet-adapter overrides
  components/
    ShieldApp.tsx     # layout, mode toggle, input, orchestration
    VerdictCard.tsx   # verdict, character diff, reasons
    HistoryPanel.tsx  # scan stats + counterparties (match highlighted)
    CopyGuard.tsx     # interception modal for copying risky addresses
    Education.tsx     # "how address poisoning works" explainer
  lib/
    address.ts        # normalize / validate / shorten
    base58.ts         # dependency-free base58 encode + decode
    similarity.ts     # anchored prefix/suffix diff
    risk.ts           # scoring engine + verdicts
    reputation.ts     # on-demand dust-fan-out profile from an address's history
    counterparties.ts # extract recipients from parsed transactions
    history.ts        # RPC scan (signatures -> parsed txs -> counterparties)
    demo.ts           # deterministic demo wallet + poison fixtures
    types.ts          # shared types
    shield.test.ts    # engine tests
```

---

## Demo tips (for the pitch)

Lead with **Live**: connect a wallet that has real history, then show the
"Poisoning already sitting in this history" banner if one is present. Fall back
to **Demo** only if the RPC or wifi fails.

1. Click **Poisoned lookalike** → red **High Risk**, first 4 / last 4 highlighted,
   the middle characters called out.
2. Click **Copy (guarded)** → interception modal offers the *real* address instead.
3. Click **Real address** → exact match, green.
4. Click **Unknown address** → safe, with the explicit "not a guarantee" caveat.
5. Show the history alert: the dust sender and the address it impersonates, with
   the interaction counts that expose which one is real.

---

## Limitations (be honest on stage)

- Compares against your own recent counterparties only, not global chain history.
- Keyed off the last 100–2,000 signatures; older relationships are not covered.
- A first-time payment has no anchor to compare against. It is reported `safe`
  only when there is history to compare, and `unknown` when there is not.
- Some wallets re-derive counterparties differently (token accounts vs owners);
  the extractor prefers balance increases to minimise noise.

Roadmap: browser extension, wallet-level transaction interception, global
poisoner reporting, and an API for dApps.


