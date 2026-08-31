# AZOX Hybrid Wallet Layer — Verified State and Remaining Work

## What the inspection found (verified in the current code)

Most of the requested hybrid wallet layer already exists in the project and passes typecheck, lint, tests and build. Verified by reading the files:

- `src/lib/appkit-runtime.tsx` — browser-only module. Creates exactly one `UniversalProvider` (with full metadata incl. `redirect.universal` = `TELEGRAM_APP_URL`), then exactly one `WagmiAdapter` (shared `cookieStorage`), then exactly one `createAppKit` that receives that same provider. Exposes one `WagmiProvider` (`reconnectOnMount`) and the `WalletButton`.
- Telegram bridge: `window.open` is captured natively; only `https://t.me/...` and `tg://...` go through `Telegram.WebApp.openTelegramLink`. All wallet/WalletConnect URLs pass through unchanged — no URI parsing or rewriting anywhere.
- Session recovery: restored `eip155` accounts are parsed into numeric chain IDs and written to `walletConnect.requestedChains` only, before adapter creation, preventing `isAuthorized()` from destroying a restored session.
- `src/lib/azox-wallet-layer.ts` — SSR-safe, pure detection: `resolveWalletEnvironment` (`web` | `telegram-android` | `telegram-other`), `primaryWalletTransport`, labels, and an explicit `openAzoxInExternalBrowser` that opens only the current AZOX HTTPS URL.
- `src/lib/telegram.ts` — `isTelegramMiniApp()` requires the webview proxy, `tgWebApp*` launch params, `initData`/user, or a concrete non-`unknown` platform. Ordinary Chrome/Firefox/Samsung Internet cannot pass.
- `src/lib/metamask-connect-connector.ts` — official MetaMask wagmi connector pattern on `@metamask/connect-evm` 2.1.1: type-only module imports plus dynamic runtime import, `id: metaMaskSDK`, official rdns, `isReconnecting` restore-first, 1013/`ResourceUnavailableRpcError` transient guard, 4001 preserved, `getAccounts`/`getChainId` fallbacks, retry+timeout `isAuthorized()`, `switchChain` with the existing 46630 / `0xb626` config, `skipAutoAnnounce: true`.
- `src/components/azox/wallet-connect-panel.tsx` — Telegram Android shows an explicit MetaMask button plus AppKit "Other Wallets" and an explicit browser fallback; every other environment shows the unchanged AppKit button. Nothing auto-opens, nothing auto-transacts.
- `src/routes/__root.tsx` — one SSR read-only `WagmiProvider` (connector-free config from `wagmi-config.ts`) and one lazily loaded browser `AppKitWagmiProvider`, never both.
- `src/lib/azox-wallet-layer.test.ts` — 7 passing tests covering Telegram Android → MetaMask, Telegram iOS/desktop → AppKit, ordinary Android browser → AppKit, SSR → web-safe.
- Diagnostics: `src/lib/wc-diagnostics.ts` and `wc-diagnostics-probe.tsx` no longer exist and have zero references.
- `package.json`: `@metamask/connect-evm` exactly `2.1.1`, no deprecated `@metamask/sdk`.
- Airdrop, contract, ABI, fee 0.0006 ETH, chain 46630, Supabase sync, games/tasks/points/referrals/rankings/profile: untouched.

So the answers to the plan questions are already realised in code; the gap is a small amount of hardening plus device verification.

## Remaining work (the actual change set)

### 1. `src/lib/telegram.ts` — remove noisy console logging
`isTelegram()` and `initTelegram()` log Telegram objects (including `initDataUnsafe`) to the browser console on every load. In production this is both noise and a mild data-exposure smell. Remove those `console.log` calls; keep the detection logic byte-identical.

### 2. `src/lib/azox-wallet-layer.ts` — MetaMask availability signal
Add a small pure helper `metaMaskConnectAvailable(env)` (true only for `telegram-android`) so the panel does not have to infer availability from the connector list. This makes the "MetaMask Connect is not available" branch deterministic and testable.

### 3. `src/components/azox/wallet-connect-panel.tsx` — failure-path polish
- Surface the browser fallback automatically as a secondary action after a MetaMask connect failure that is not a user rejection (4001), instead of only inside the generic error block.
- Suppress the error banner for user rejections (they are not errors).
No auto-open, no auto-transaction, no change to the primary path.

### 4. `src/lib/azox-wallet-layer.test.ts` — extend coverage
Add cases for `metaMaskConnectAvailable`, `android_x` platform, `platform: "unknown"` with an Android UA inside a Mini App, and launch-param-only detection.

### 5. Validation
`bunx tsgo --noEmit`, focused prettier + eslint on the changed files, `bunx vitest run src/lib/azox-wallet-layer.test.ts`, `bun run build`. Re-confirm: one `WagmiProvider` per runtime path, one `WagmiAdapter`, one `UniversalProvider`, `@metamask/connect-evm` still 2.1.1.

## Behavioural answers

**Wallet selection / launch.** Normal browser and Telegram iOS/desktop: AppKit modal, WalletConnect transport, unchanged. Telegram Android: explicit MetaMask button drives the MetaMask Connect EVM connector (MetaMask's own link flow, not WalletConnect deep-linking); "Other Wallets" still opens AppKit for Trust, Coinbase, Phantom and any generic WalletConnect wallet.

**Return into wagmi.** MetaMask Connect is registered as an extra `CreateConnectorFn` on the single `WagmiAdapter`, so it feeds the same wagmi config. `useAccount`/`useBalance`/`useSendTransaction`/`useSwitchChain` in the Airdrop page keep working with no changes.

**External-browser fallback.** Explicit user action only; calls `Telegram.WebApp.openLink` with the current AZOX HTTPS URL, never a wallet URI or WalletConnect payload.

**Android Telegram detection.** Strict Mini App gate first, then Telegram's reported platform, then `tgWebAppPlatform`, then Android UA as last resort — a plain Android browser can never reach `telegram-android`.

**Persistence / reconnect.** `cookieStorage` survives Telegram WebView storage resets; `reconnectOnMount` plus the `requestedChains` recovery write restores WalletConnect sessions; MetaMask Connect restores its own session through the restore-first `isReconnecting` path.

**Listeners / races.** Single module-scope async init promise consumed via React `use()`; connectors are created once; MetaMask event handlers are bound once inside the lazy singleton client.

## Risks

- The Telegram Android + MetaMask physical handshake and real Telegram platform reporting remain unverified — only a device test can confirm them.
- `@metamask/connect-evm` 2.1.1 is young; its event/type surface may shift on upgrade.
- All changes above are additive/cosmetic and revert cleanly by file.
