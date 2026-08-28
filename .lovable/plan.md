# Read-only audit: wallet connect → register → Supabase lifecycle

No files were changed. Findings only, plus optional follow-ups you can approve later.

## Verdict on the three observed behaviours

1. **MetaMask connects and the 0.0006 ETH registration succeeds.** This is the intended path end to end.
2. **Another wallet connects, returns to the Mini App, and no payment happens until "Register Now" is pressed.** This is **not a bug**. Payment is intentionally manual in the current code: `handleRegister` is only ever called from the button's `onClick`, and the file contains no effect that triggers a transaction on connect. So "connected without payment" is the designed behaviour for every wallet, including MetaMask.
3. **A wallet opens but never establishes a session.** This is the only real failure class, and the code contains one path that can make it wallet-specific (see the launch-path finding below).

## What is app logic vs wallet-specific behaviour

**App logic (identical for all wallets, cannot differ per wallet after approval):**
- Single `WagmiAdapter` created once at module scope in `src/lib/appkit-runtime.tsx`, `ssr:false`, explicit `localStorage` persistence, `reconnectOnMount` on the provider in `src/routes/__root.tsx`. Same restoration for every connector.
- Post-approval flow in `src/components/azox/pages/airdrop-page.tsx` is connector-agnostic: `useAccount` → chain check → `switchChainAsync` → balance refetch → `isEligible` read → `sendTransactionAsync({ to, data, value, chainId })` → `waitForTransactionReceipt` → re-read `isEligible` → Supabase write. No branch anywhere keys off wallet name, connector id, or RDNS.
- Registration truth is on-chain (`isEligible`); Supabase is a display/sync layer and its failure never re-requests payment.

**Wallet-specific by nature (not fixable in app code):**
- Whether the wallet honours `metadata.redirect.universal` and bounces the user back to `t.me/AZOX_Airdrop_bot/AZOX_Airdrop`.
- Whether the wallet supports **chain 46630** at all. `switchChainAsync` will reject or hang on wallets that do not implement `wallet_addEthereumChain` for an unknown testnet — this surfaces as `WRONG_NETWORK` after pressing Register, not at connect time.
- Whether the wallet's registry entry exposes a working HTTPS universal link (needed on Telegram Android) rather than only a custom scheme.
- Whether the wallet keeps the WalletConnect session alive while backgrounded.

## Code paths that can genuinely differ per wallet

1. **`window.open` shim + `experimental_preferUniversalLinks` (Telegram Android only).** Inside Telegram, every launch URL is routed through `Telegram.WebApp.openLink`, and `preferUniversalLinks` makes AppKit pick the registry universal link. A wallet whose registry entry has an empty or stale `mobile.universal` value gets a broken or missing URL here, while custom-scheme-only wallets lose their only working launch route. This is the most likely cause of "opens but never connects" and of any remaining `ERR_UNKNOWN_URL_SCHEME`. Outside Telegram this code is a pass-through and cannot cause it.
2. **Double-encoding repair.** Narrowly scoped: HTTPS only, non-Telegram host, only when the already-decoded `uri` param decodes again into `wc:`. It cannot corrupt a correctly-encoded URI. Low risk, but it only helps wallets launched via HTTPS universal links.
3. **`metadata.redirect` re-injection into the SignClient.** Fires asynchronously after `getUniversalProvider()` resolves. If a user taps Connect within that window, the first proposal can go out **without** the redirect, so that wallet will not bounce back — the session still settles later if the WebView survives. This is a timing race, not a per-wallet rule, but it looks wallet-specific in testing.
4. **`RUNTIME_APP_URL`.** `window.location.origin` on the client. Some wallets validate proposal metadata origin strictly; when the Mini App is served from a preview host, the origin differs from the published one. This can reject a proposal in some wallets and not others.
5. **`reconnectOnMount`.** Uniform across connectors, but its effect differs: injected connectors restore instantly; WalletConnect must re-open the relay socket, so a wallet that terminated the pairing on return shows `isConnected: false` briefly or permanently.

## What is NOT a source of wallet-specific failure

- Transaction request shape: fixed `to`/`data`/`value`/`chainId` for everyone.
- Supabase writes: after receipt, non-blocking, never re-triggers payment.
- Manual registration guard (`registrationInFlightRef`): only prevents double taps.
- The eligibility short-circuit (`eligibility.data === true` → silent return): correct, prevents double payment.

## Optional follow-ups (not implemented)

1. Await the redirect injection before AppKit's modal can open, removing the race in finding 3.
2. Surface an explicit "this wallet does not support Robinhood Chain 46630" message when `switchChainAsync` rejects, instead of a raw `WRONG_NETWORK` string.
3. Log the selected wallet id and the exact launch URL scheme (already partially present) to distinguish registry-link failures from relay failures on real devices.
