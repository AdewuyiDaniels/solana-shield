# Solana Shield

**Stop address poisoning before you send.**

Paste a Solana address, and Solana Shield diffs it against every counterparty in
your recent transaction history. If the address copies the opening and closing
characters of an address you already use — the signature of an address-poisoning
attack — it is flagged **High Risk** before you sign anything.

Built for the Solana × MLH Hackathon, November 2026.

---

## What it does

1. Connects Phantom or Solflare (or runs entirely on a simulated demo wallet).
2. Reads the last 40 signatures of the connected wallet.
3. Extracts counterparties from SOL balance increases and token transfers.
4. Diffs the pasted address against each counterparty.
5. Returns one of six verdicts with a character-level diff:

| Verdict | Meaning |
|---|---|
| `high-risk` | Shares first **4+** and last **4+** characters with a known address, but is not that address. Classic poison. |
| `suspicious` | Strong partial anchor match (3+3, or a 5+ character prefix/suffix). Verify manually. |
| `safe` | No anchor pattern found. Not a guarantee of legitimacy. |
| `exact` | The pasted address is literally in your history. |
| `self` | You are about to send to your own wallet. |
| `invalid` | Not a base58-encoded 32-byte public key. |

Everything is computed in the browser. No backend. No private keys. No address
ever leaves the page.

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

The app boots in **Demo** mode with a deterministic simulated wallet history, so
it works with no wallet and no RPC call. Flip the header toggle to **Live** and
connect Phantom or Solflare to scan your own history.

### Environment

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

The public endpoint is aggressively rate limited. For a reliable live demo, use a
free Helius / QuickNode mainnet URL. If the RPC fails, the UI explains what
happened and demo mode still works.

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
    VerdictCard.tsx   # verdict, score ring, character diff, reasons
    HistoryPanel.tsx  # scan stats + counterparties (match highlighted)
    CopyGuard.tsx     # interception modal for copying risky addresses
    Education.tsx     # "how address poisoning works" explainer
  lib/
    address.ts        # normalize / validate / shorten
    base58.ts         # dependency-free base58 encode + decode
    similarity.ts     # anchored prefix/suffix diff
    risk.ts           # scoring engine + verdicts
    counterparties.ts # extract recipients from parsed transactions
    history.ts        # RPC scan (signatures -> parsed txs -> counterparties)
    demo.ts           # deterministic demo wallet + poison fixtures
    types.ts          # shared types
    shield.test.ts    # engine tests
```

---

## Demo tips (for the pitch)

Use **Demo** mode. It never depends on the judges' wallets or on RPC limits.

1. Click **Poisoned lookalike** → red **High Risk**, first 4 / last 4 highlighted,
   the middle characters called out.
2. Click **Copy (guarded)** → interception modal offers the *real* address instead.
3. Click **Real address** → exact match, green.
4. Click **Unknown address** → safe, with the explicit "not a guarantee" caveat.
5. Flip to **Live** and connect a wallet to prove it is real.

---

## Limitations (be honest on stage)

- Compares against your own recent counterparties only, not global chain history.
- Keyed off the last 40 signatures; older relationships are not covered yet.
- A first-time payment has no anchor to compare against — it is reported safe with
  a warning, not endorsed.
- Some wallets re-derive counterparties differently (token accounts vs owners);
  the extractor prefers balance increases to minimise noise.

Roadmap: browser extension, wallet-level transaction interception, global
poisoner reporting, and an API for dApps.
