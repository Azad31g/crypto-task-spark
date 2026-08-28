# Forensic report — AZOX wallet connection flow (read-only)

No files were modified. This is analysis plus a proposed minimal fix awaiting your approval.

## 0. Git history availability (honest answer)

The original repository history is **not** available in this Lovable project. `git log --all` shows exactly 8 commits, starting from the Lovable template commit `0f401e5`, then `36b9149 Imported AZOX repo into Lovable`. `src/lib/appkit-runtime.tsx` was first added in `f46e3d6`. Commit `2d3e7f8` and everything before/around it do not exist here — the import was a snapshot, not a history clone. So the "why it worked before" section below is reasoning from the current code and from how AppKit/Telegram behave, not from a diff against the pre-`2d3e7f8` tree.

Current state confirms `toUniversalLink()` and wallet-specific URL mappings are gone: no match for `toUniversalLink` anywhere in `src/`.

## 1. Execution flow as currently coded

1. `src/routes/__root.tsx` renders `QueryClientProvider` → `ClientOnly` → `Suspense` → lazy `AppKitWagmiProvider`. Both the ClientOnly fallback and the Suspense fallback render `<AppContent />` wrapped in `WagmiProvider config={getSsrWagmiConfig()}` — a **connector-free** config.
2. When the lazy chunk resolves, `src/lib/appkit-runtime.tsx` executes at module scope: `patchTelegramWindowOpen()` → `new WagmiAdapter({ ssr: true, storage: createStorage({ storage: cookieStorage }) })` → `createAppKit({...})`.
3. `AppKitButton` (rendered via `WalletButton` in `airdrop-page.tsx`) opens the AppKit modal. Selecting a wallet makes AppKit build a WalletConnect pairing URI (`wc:...@2?relay-protocol=...&symKey=...`) and then hand it to `ConnectionController` → `CoreHelperUtil.openHref(deeplink, '_blank')`, which calls `window.open(...)`. Depending on the wallet entry AppKit uses either the wallet's registry `mobile_link` **native scheme** (`metamask://wc?uri=...`, `okx://main/wc?uri=...`) or its **universal link** (`https://metamask.app.link/wc?uri=...`).
4. Your patched `window.open` routes: `t.me`/`tg://` → `tg.openTelegramLink`, anything starting with `http` → `tg.openLink`, **everything else → `window.location.href = href`**.
5. After approval the wallet returns the user via `metadata.redirect.universal` = `https://t.me/AZOX_Airdrop_bot?startapp`, which **cold-reopens the Mini App** — a full page load, new JS context.
6. On connect, `airdrop-page.tsx` `useEffect([isConnected, address])` fires `handleRegister(true)` on the disconnected→connected transition, which immediately does `switchChainAsync` then `sendTransactionAsync` (0.0006 ETH).

## 2. Root causes (three distinct defects)

### A. LAUNCH problem — custom schemes crash the Telegram WebView
`src/lib/appkit-runtime.tsx:39-41`. For `metamask://`, `okx://`, `trust://` etc. the patch does `window.location.href = href`. Android's Telegram WebView does not resolve unknown URL schemes from a top-level navigation → **`ERR_UNKNOWN_URL_SCHEME`**, and the Mini App itself shows the error page. This is the exact symptom you report. Telegram's own API (`WebApp.openLink`) also only accepts http/https; native schemes must be handed to Telegram, on Android typically through an `intent://` URL or by leaving the original `window.open` to the WebView's intent handling — never a same-frame `location.href`.

### B. LAUNCH problem — https wallet links open Telegram's in-app browser
Same file, line 37: every `http(s)` deeplink is sent to `tg.openLink(href)`, which by default opens Telegram's **internal browser**, not an external app-link handler. A wallet universal link rendered inside Telegram's in-app browser does not hand off to the installed app; it loads the wallet's web page. For OKX (`https://www.okx.com/download?deeplink=...`) that web page frequently 404s or shows a download page — **exactly your "OKX opens browser / 404"**. `openLink` supports `{ try_instant_view:false }`; the correct call for app hand-off is `openLink(url, { try_browser: true })` (external browser, which then triggers the OS app-link) or bypassing the patch for wallet links entirely.

### C. SESSION/CALLBACK problem — the pairing is lost on return, so `isConnected` never flips
Three compounding factors, all after wallet approval:

- **`cookieStorage` without `cookieToInitialState`** (`appkit-runtime.tsx:71`). `ssr: true` + cookieStorage is designed for a server that reads the cookie and passes `cookieToInitialState(config, cookieHeader)` into `WagmiProvider initialState`. Nothing in `src/routes/__root.tsx` does that. Worse, a WalletConnect wagmi state blob routinely exceeds the ~4 KB per-cookie limit, so the write is silently truncated/dropped. Result: on the cold reload triggered by the Telegram return, wagmi has **no persisted state to rehydrate**, `reconnectOnMount` has nothing to reconnect to, and the app renders disconnected even though the wallet approved the session. Default `localStorage` (the pre-regression behaviour) does not have this limit.
- **Provider swap remount** (`src/routes/__root.tsx:175-193`). `<AppContent />` is rendered under `WagmiProvider config={getSsrWagmiConfig()}` (no connectors) in *both* fallbacks, then re-rendered under `AppKitWagmiProvider` when the lazy chunk loads. React sees a different provider subtree and remounts the whole app; during the pre-hydration window `useAccount()` is bound to a connector-less config, so any `isConnected` reading in that window is `false`, and the auto-register effect's `previousConnectionRef` baseline gets reset.
- **`metadata.url` does not match the deployed origin** (`src/lib/wagmi-config.ts:27`, `APP_URL = https://ear-magic-sparkkk.lovable.app`). The published app is `https://crypto-task-spark.lovable.app` and the preview is a different host again. Several wallets (OKX notably) validate dApp metadata origin against the requesting origin and either refuse the session or drop the redirect. This also breaks `metadata.redirect.universal` semantics for wallets that prefer `url`.

So: **the wallet opening but never producing `isConnected=true` is a return/restore failure, not an approval failure.** The WalletConnect session is created on the relay; the Mini App simply comes back as a fresh document with no rehydratable wagmi state.

### D. UX amplifier — auto-register fires the moment the session restores
`airdrop-page.tsx:381-393` calls `handleRegister(true)` on the disconnected→connected edge. In Telegram this means: the instant a session does restore, the app immediately requests `wallet_switchEthereumChain` and then `eth_sendTransaction` — a second deeplink round-trip out of the Mini App, before the user has seen a connected state. Combined with A/B that second hop hits the same launch bug, so the user perceives "connected but nothing happens" or gets bounced again. It also means the connect button can never be used just to connect.

## 3. Why it worked before (reasoned, history not available)

Pre-regression the app almost certainly used AppKit's own deeplink handling with default `localStorage` wagmi storage and a metadata URL matching the live origin. AppKit's built-in Telegram handling already special-cases the WebView; the hand-rolled `window.open` patch replaced that with a narrower, incorrect mapping (`location.href` for schemes, internal browser for https), and the cookieStorage switch removed the only durable place the session survived the Telegram cold-reopen.

## 4. Minimal safe fix (not applied)

1. `src/lib/appkit-runtime.tsx`
   - Never navigate the top frame to a custom scheme. For non-http schemes on Android, build `intent://…#Intent;scheme=<s>;end` and hand it to the **original** `window.open`, falling back to a hidden `<a target="_blank">` click; on failure do nothing (do not clobber the Mini App document).
   - For wallet http(s) deeplinks call `tg.openLink(href, { try_browser: true })` so Android app-links resolve to the installed wallet instead of Telegram's in-app browser.
   - Keep `t.me`/`tg://` → `openTelegramLink`.
   - Return a truthy stub from the patched `window.open` so AppKit's `if (!popup) throw` paths don't misfire.
2. Replace `createStorage({ storage: cookieStorage })` with the wagmi default (`localStorage`) — or keep cookieStorage *and* wire `cookieToInitialState` in `__root.tsx`. The former is the smaller change and restores the pre-regression persistence.
3. `src/lib/wagmi-config.ts`: set `APP_URL` to the actual deployed origin (`https://crypto-task-spark.lovable.app` or your custom domain) so `metadata.url` matches; keep `redirect.universal` as the `t.me` startapp link.
4. `src/routes/__root.tsx`: render `<AppContent />` once, keeping a stable provider identity (single `WagmiProvider` whose config swaps, or gate only the AppKit modal mount) so the tree does not remount at hydration.
5. `src/components/azox/pages/airdrop-page.tsx`: gate the auto-register effect behind an explicit user action (or a short settle delay + "Register" button) so connecting never immediately triggers a second deeplink. Registration logic, fee, ABI, and contract stay byte-identical.

**Must NOT change:** contract address, ABI, `REGISTRATION_FEE` (0.0006 ETH), the register/eligibility/receipt sequence, chain 46630 definition, Supabase (external `oevefjiajicjtbhqvglk`), games, tasks, points, referrals, rankings, profile, Telegram user/backend sync.

## 5. Android Telegram validation sequence

1. Open the Mini App from `https://t.me/AZOX_Airdrop_bot?startapp` on Android (kill Telegram first for a cold start).
2. Go to Airdrop, tap the AppKit button, pick MetaMask. Expect: MetaMask **app** opens (not a browser, no `ERR_UNKNOWN_URL_SCHEME`).
3. Approve the connection in MetaMask. Expect: return to Telegram Mini App, and `[airdrop] account:state` logs `isConnected: true` with the address.
4. Repeat step 2-3 with OKX Wallet. Expect: OKX app opens, no 404 web page.
5. Verify no transaction prompt appears automatically on connect.
6. Tap Register manually → chain switch to 46630 → 0.0006 ETH tx prompt → approve → return → `TRANSACTION_CONFIRMED` and `REGISTRATION_VERIFIED` in console.
7. Close and reopen the Mini App: the session must still show connected (persistence check).
8. Repeat 2-3 with Trust Wallet and with a wallet **not** installed (expect a graceful modal state, not a WebView error page).
