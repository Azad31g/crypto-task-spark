# AZOX Wallet + Airdrop — Audit and Restoration Plan

Audit only. No files were modified.

## 1. Last known state before the backend integration

Repository history (`git log`) shows a clean boundary:

```text
36b9149  Imported AZOX repo into Lovable      <- pre-backend baseline (wallet + airdrop as they worked)
45ba52a / b452463  Changes
ae533d2  Enabled Supabase Cloud               <- backend integration starts here
5f6b8c8  Switched back to external Supabase
a6dbb58  Fixed WalletConnect session flow
fede404  Fixed wallet metadata origin
b0647fe  Prefered universal links on TG       <- HEAD
```

Baseline commit to compare against and selectively restore from: **36b9149**.

## 2. Files changed since 36b9149

`git diff --stat 36b9149 HEAD` (src + vite.config.ts):

| File | Related to the regression? |
|---|---|
| src/lib/appkit-runtime.tsx | YES — main cause |
| src/routes/__root.tsx | Partly (provider mounting) |
| src/components/azox/pages/airdrop-page.tsx | YES — auto-registration was introduced |
| src/integrations/external-supabase/client.ts | No — backend, keep |
| src/hooks/useAnnouncements / useGameTasks / useGlobalBest / useSupabaseTasks | No — backend, keep |
| src/lib/azox-backend.ts | No — backend, keep |
| src/integrations/supabase/client.ts, types.ts | No — Cloud generated, keep |

vite.config.ts (events polyfill + universal-provider ESM alias) is unchanged since the baseline and stays as is.

## 3. Architectural difference, old vs current

**Telegram link shim (`appkit-runtime.tsx`)**

- Old (36b9149): every `window.open` went through the Telegram WebApp API — `t.me`/`tg://` via `openTelegramLink`, all `http(s)` via `tg.openLink` (leaves the WebView, so a wallet universal link reaches the wallet app), custom schemes via `location.href`.
- Current: only `t.me`/`tg://` are intercepted; everything else uses native `window.open`. Inside Telegram Android's WebView a native open of `metamask://…` is a WebView navigation → `net::ERR_UNKNOWN_URL_SCHEME`. Even the HTTPS universal links added by `experimental_preferUniversalLinks` now stay inside the WebView instead of being handed to the OS.

This is the root cause of the current error: the shim lost the Telegram escape hatch for wallet URLs, while the current AppKit option only changes which URL is produced, not who opens it.

**Wagmi storage/SSR**: old `ssr: true` + `cookieStorage`; current `ssr: false` + explicit `localStorage`. Current is the correct pairing for a client-only adapter — keep.

**Provider mounting (`__root.tsx`)**: old could fall back to the connector-free SSR config in the browser; current preloads the AppKit chunk and never falls back. Current is better — keep.

**Airdrop flow (`airdrop-page.tsx`)**: old auto-triggered on connect and let a Supabase row block registration; current auto-triggers with on-chain authority. Your new requirement is manual-only, so neither matches — this needs an explicit change.

## 4. Target end state

Wallet layer first, backend strictly as a post-transaction data layer:

```text
Connect Wallet -> AppKit modal -> wallet opens via Telegram-safe launch
-> real WalletConnect session, isConnected = true
-> user presses "Register Now — 0.0006 ETH"
-> register() tx, value 600000000000000 wei, chain 46630
-> receipt confirmed -> on-chain isEligible verified
-> ONLY THEN write wallet_registrations to external Supabase
```

Supabase never gates connecting, never gates paying, never signs anything.

## 5. Restore fully vs merge manually

- Restore-in-spirit (not a blind file revert): the Telegram launch shim block inside `src/lib/appkit-runtime.tsx` — bring back `tg.openLink` routing for non-Telegram HTTP(S) URLs and the custom-scheme path, on top of the current runtime-origin, localStorage and `experimental_preferUniversalLinks` improvements.
- Manual edit only: `src/components/azox/pages/airdrop-page.tsx` (remove auto-registration, keep on-chain authority and diagnostics).
- Do NOT restore: `__root.tsx` (current version is the better architecture), any Supabase/hook/backend file, `wagmi-config.ts`, `contracts.ts`.
- Untouched: games, tasks, points, referrals, rankings, profile, Telegram integration, contract, ABI, fee, chain, vite polyfills.

## 6. Step-by-step implementation plan

1. **`src/lib/appkit-runtime.tsx` — Telegram-safe wallet launch.** Keep the native `window.open` capture, and inside Telegram add: `t.me`/`tg://` → `openTelegramLink`; any other `https://` (wallet universal link) → `tg.openLink(href)`; custom scheme (`metamask://`, `trust://`…) → `tg.openLink` if available, else `location.href`, guarded so it cannot leave the Mini App blank. Outside Telegram, behaviour stays exactly native.
2. Keep `experimental_preferUniversalLinks` for Telegram Android so AppKit prefers the registry HTTPS link for every wallet in the list, not only MetaMask.
3. Keep the existing `[wallet-launch]` diagnostics (wallet name, scheme, universal vs native, telegramAndroid); never log the WalletConnect URI.
4. **`src/components/azox/pages/airdrop-page.tsx` — manual registration.** Remove the auto-register `useEffect`, `autoAttemptedForRef` and `isAutoStarting`; keep `registrationInFlightRef` as the double-submit guard. Primary CTA becomes "Register Now — 0.0006 ETH" only after a real connection, with states Confirm in your wallet → Confirming on chain → Retry after a genuine failure. Remove the "starts automatically" helper text.
5. Keep on-chain authority: `isRegistered` from `isEligible` whenever an address is connected; a Supabase row is a display hint only and never returns early from `handleRegister`.
6. Keep the Supabase write exactly where it is — after receipt success and after on-chain `isEligible` verification.
7. Leave `__root.tsx`, `wagmi-config.ts`, `contracts.ts`, `vite.config.ts` and every backend file untouched.
8. Run `bun run build`, then report changed files and the exact tx parameters.
9. Physical Android Telegram test (MetaMask, OKX, Trust): confirm no `ERR_UNKNOWN_URL_SCHEME`, wallet opens, return to Mini App shows connected, then the manual 0.0006 ETH register prompt.

## Open question

`TELEGRAM_APP_URL` stays exactly as configured in this pass, per your instruction — the wallet return target is tested separately after the launch path is fixed.
