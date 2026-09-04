# Telegram Android Wallet Launch — Root Cause and Minimal Repair Plan

## Findings

### 1. Immediate `ERR_UNKNOWN_URL_SCHEME` — confirmed, highest confidence

The failure occurs before WalletConnect settlement. In `src/lib/appkit-runtime.tsx:34-47`, the global `window.open` bridge sends every non-HTTP custom scheme to `window.location.href`. AppKit 1.8.23 selects custom wallet deep links by default, so Telegram Android’s WebView receives values such as `metamask://…`, `trust://…`, `cbwallet://…`, or similar and renders `net::ERR_UNKNOWN_URL_SCHEME`.

Installed-source trace:

```text
AppKit wallet selection
→ ConnectionControllerUtil.onConnectMobile()
→ CoreHelperUtil.formatNativeUrl(...)
→ experimental_preferUniversalLinks defaults to false
→ custom-scheme deepLink selected
→ CoreHelperUtil.openHref()
→ patched window.open()
→ window.location.href = custom-scheme
→ Telegram Android WebView: ERR_UNKNOWN_URL_SCHEME
```

Relevant installed locations:
- `@reown/appkit-controllers/.../ConnectionControllerUtil.js:62-82`
- `@reown/appkit-controllers/.../CoreHelperUtil.js:111-175`
- `@reown/appkit-controllers/.../OptionsController.js:14` (`experimental_preferUniversalLinks: false`)
- `@reown/appkit-controllers/.../MobileWallet.js:78-146` for AppKit’s wallet-specific generated links

AppKit 1.8.23 has no `mobileWalletConnectUri` or `walletConnectOptions` option. Its supported switch is `experimental_preferUniversalLinks`.

### 2. Wallet return metadata is dropped by AppKit 1.8.23 — confirmed, affects the next stage

`src/lib/appkit-runtime.tsx:66-77` supplies `metadata.redirect.universal`, but AppKit 1.8.23 reconstructs metadata before `UniversalProvider.init()` using only `name`, `description`, `url`, and `icons`. It omits `redirect` entirely at `node_modules/@reown/appkit/dist/esm/src/client/appkit-base-client.js:1491-1503`.

The installed WalletConnect metadata type genuinely supports:

```text
redirect: { native?: string; universal?: string; linkMode?: boolean }
```

Therefore the current cast is accepted by the app but the return metadata does not reach the internally-created UniversalProvider. This does not cause the immediate scheme error, but it can prevent the wallet from returning to the Mini App after approval. This source behavior is sufficient proof that AppKit 1.8.23 requires one explicitly supplied UniversalProvider if the Telegram return metadata must be retained.

### 3. Current Telegram Mini App URL is correct — high confidence

`src/lib/wagmi-config.ts:32` currently uses:

```text
https://t.me/AZOX_Airdrop_bot/AZOX_Airdrop
```

Telegram resolves it to:

```text
tg://resolve?domain=AZOX_Airdrop_bot&appname=AZOX_Airdrop
```

That is the direct-link form for the named Mini App. The August reference used `https://t.me/AZOX_Airdrop_bot?startapp`, which resolves without an `appname`; it is not a better replacement for this named Mini App. Keep the current `/AZOX_Airdrop` value.

### 4. Existing singleton/provider architecture is correct

Current source contains one module-scope `WagmiAdapter`, one `createAppKit()`, one browser `WagmiProvider`, and one lazy `AppKitButton` entry. The root route’s connector-free provider is confined to the server fallback; the browser loading fallback mounts no second provider. No environment or MetaMask-specific branch exists.

### 5. Package and bundling observations

- Direct versions are aligned: AppKit and its Wagmi adapter are both `1.8.23`; UniversalProvider is `2.23.7`.
- The client-only AppKit import boundary and SSR stubs remain necessary.
- The `events` alias protects WalletConnect’s browser EventEmitter import; the `buffer` alias is harmless and can remain.
- `@metamask/sdk` appears only transitively through AppKit/Wagmi connector dependencies in the lockfile, not as a direct dependency or custom AZOX connector. Removing it would require changing upstream dependency resolution and is not part of the minimal fix.
- A stale Vite comment/matcher mentioning `@metamask/connect-evm` is not on the active connection path; it should not be changed as part of this repair.

### 6. Airdrop/backend separation is already correct

The current Airdrop path derives wallet state from Wagmi and on-chain eligibility. Backend reads do not determine whether WalletConnect is connected, and backend synchronization runs only after on-chain confirmation. No Airdrop, contract, fee, chain, or backend file needs modification.

## Exact implementation strategy

### `src/lib/appkit-runtime.tsx`

1. Keep one unified AppKit/WalletConnect path for every EVM wallet.
2. Add `experimental_preferUniversalLinks: true` to the single `createAppKit()` call. This makes AppKit choose its generated HTTPS universal wallet link instead of its generated custom-scheme deep link whenever the wallet listing provides both.
3. Keep the bridge installed before AppKit initialization:
   - `https://t.me/...` and `tg://...` → `Telegram.WebApp.openTelegramLink()`
   - other `http://` / `https://` wallet universal links → `Telegram.WebApp.openLink()`
   - do not assign custom schemes to `window.location.href`; pass unsupported/non-HTTP values unchanged to the captured native `window.open` only as a defensive fallback. Do not parse, rebuild, or encode any WalletConnect URI.
4. Create exactly one explicit UniversalProvider before the adapter/AppKit initialization, using the existing project ID and the complete current metadata including `redirect.universal = TELEGRAM_APP_URL || APP_URL`.
5. Pass that same provider instance into the single AppKit/Wagmi wiring so AppKit does not create a second provider. Do not add requested-chain storage writes, session mutation, diagnostics, wallet filtering, or wallet-specific behavior.
6. Keep the one live browser `WagmiProvider`, `cookieStorage`, and `reconnectOnMount` behavior unchanged. Gate rendering only as required for the one asynchronous provider initialization; do not mount a temporary second browser Wagmi config.

No changes are proposed for `src/lib/wagmi-config.ts`, `src/components/azox/wallet-connect-panel.tsx`, `src/routes/__root.tsx`, `src/components/azox/pages/airdrop-page.tsx`, `vite.config.ts`, package versions, the lockfile, or backend files unless validation exposes a direct compile error caused by the runtime edit.

## Validation

Run:

```text
bunx tsgo --noEmit
bun run lint
bunx vitest run
bun run build
```

Static checks:
1. One `WagmiAdapter`.
2. One `createAppKit()`.
3. One UniversalProvider instance shared by AppKit and the Wagmi adapter.
4. One live browser `WagmiProvider`.
5. One AppKit button entry.
6. No MetaMask-specific dependency, connector, button, or branch.
7. No WalletConnect URI parsing/rewrite.
8. No requested-chain recovery write or post-init provider mutation.
9. No browser fallback requirement.
10. No backend/Supabase import in the wallet connection path.
11. Airdrop fee remains exactly `0.0006 ETH` on chain `46630`.
12. Backend synchronization remains after confirmed on-chain registration.

These checks prove compilation, package compatibility, singleton structure, and preservation of application logic. They cannot prove Android intent dispatch, wallet approval, Telegram return, relay delivery, or Wagmi session settlement.

## Required physical verification

A real Telegram Android device must still verify:

```text
Telegram Mini App
→ Connect Wallet
→ AppKit wallet list
→ select each wallet
→ wallet app opens without ERR_UNKNOWN_URL_SCHEME
→ approve
→ return to the named AZOX Mini App
→ Wagmi exposes the approved address
→ Airdrop shows the same address
→ manual Register prompts for 0.0006 ETH + gas on chain 46630
→ receipt confirms
→ on-chain eligibility verifies
→ backend mirror runs afterward
```

No implementation result should be described as a confirmed Telegram Android fix until this device flow passes.
