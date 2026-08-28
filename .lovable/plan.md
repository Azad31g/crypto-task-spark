# Forensic diagnosis — AZOX wallet connect + 0.0006 ETH registration

Read-only inspection. Nothing was modified.

## 1. Root causes, ranked by confidence

### A. HIGH — the Supabase `wallet_registrations` row short-circuits the entire wallet + transaction flow
`src/components/azox/pages/airdrop-page.tsx`

- L163-180: on mount, `fetchWalletRegistration(currentTelegramId())` sets `dbRegistration`.
- L233: `const isRegistered = isEligible === true || dbRegistration !== null;`
- L455 / L497 / L557: the "Airdrop Eligible" panel renders when `isRegistered`, and both the **Connect Wallet** block (`!isConnected && !isRegistered`) and the **Register Now** block (`isConnected && !isWrongNetwork && !isRegistered`) are suppressed.
- L244: `handleRegister` returns immediately when `dbRegistrationRef.current` is set.

Consequence: any user with a legacy/partial row in the external `wallet_registrations` table (rows written before this flow, or written by earlier auto-register attempts) sees a permanently "registered" screen. No connect button, no register button, no on-chain transaction, no 0.0006 ETH request — exactly the reported symptom. This gate did not exist in the last known-good behaviour, where the on-chain `isEligible` read was authoritative.

Also note L390-397 in `src/lib/azox-backend.ts`: the row hard-codes `payment_status: "confirmed"` and `registration_fee: "0.0006"`, so the DB can assert a payment the chain never saw.

### B. HIGH — the auto-registration removal left the button path as the only trigger, but the button is only reachable when A does not fire
`git diff 36b9149..HEAD -- src/components/azox/pages/airdrop-page.tsx` removed the `disconnected → connected` effect that called `handleRegister(true)`. That change is correct per the earlier instruction ("manual only"), but the UI still says "Registration starts automatically" (L624) and labels the button "Retry Registration" (L620), so a user who does reach the connected state is told nothing is required of them. This is a real regression in the *perceived* flow even where the chain path is intact.

### C. MEDIUM — Telegram return target causes a cold relaunch, so `isConnected` never flips
`src/lib/wagmi-config.ts` L32 `TELEGRAM_APP_URL = "https://t.me/AZOX_Airdrop_bot?startapp"`, used at `src/lib/appkit-runtime.tsx` L101 as WalletConnect `metadata.redirect.universal`. On Android the wallet sends the user back to the bot, which starts a fresh Mini App instance; the pending `connect()` promise from the previous instance is gone. Recovery then depends purely on `reconnectOnMount` reading persisted wagmi storage (L72-82, localStorage). If Telegram's WebView clears storage on relaunch, connection is lost — "wallet opens, shows Connect, but the app never connects".

### D. MEDIUM-LOW — client/server wagmi config duality still exists
`src/routes/__root.tsx` L189-201: SSR renders `getSsrWagmiConfig()` (connector-free); the client swaps to the AppKit adapter config after the lazy chunk resolves. The chunk is preloaded at module scope and the Suspense fallback is `null`, so a double *client* mount is unlikely, but the very first client paint can still be the SSR-config tree during hydration. Low probability of causing the reported failure, but it is the remaining architectural wrinkle.

### E. LOW — not a cause: Supabase itself is not blocking wallet code
`src/integrations/external-supabase/client.ts` is a plain client (no session persistence), `AzoxProvider` (`src/components/azox/app-provider.tsx`) does not await any Supabase call before rendering, and `useUser` syncs in the background. No Supabase promise gates the wallet providers.

## 2. Transaction flow verification (current code)

`handleRegister` (airdrop-page.tsx L243-386) is **button-triggered only** (L612). It performs, in order:
1. guards on `dbRegistration` and in-flight ref (L244-246) — see cause A
2. chain check + `switchChainAsync({ chainId: 46630 })`
3. balance refetch, requires fee + 0.0001 ETH gas reserve
4. `isEligible` read; returns silently if already eligible
5. `sendTransactionAsync({ to: AZOX_AIRDROP_ADDRESS, data: registerData, value: REGISTRATION_FEE, chainId: robinhoodTestnet.id })`
6. `waitForTransactionReceipt`, re-read `isEligible`
7. only then `saveWalletRegistration(...)`

Parameters confirmed correct:
- chainId `46630` (`src/lib/wagmi-config.ts` L6)
- contract `0xb87deb7f924adf99d46830fd61e965da06268300` (`src/lib/contracts.ts` L1-2)
- calldata = `encodeFunctionData({ abi, functionName: "register", args: [] })` (airdrop-page L56-60)
- value `600000000000000` wei (`src/lib/contracts.ts` L4)

Supabase is written **after** the receipt succeeds — that ordering is already correct. The problem is the **read** side using Supabase as proof of registration.

## 3. What should change (minimal restoration)

1. **Make the chain authoritative for eligibility.** `isRegistered` should be driven by the on-chain `isEligible` read once an address is connected; a Supabase row may only be a display hint / offline fallback when no wallet is connected. Remove the `dbRegistration` early-return at the top of `handleRegister`.
2. **Always render the wallet controls.** Show the AppKit connect button and, when connected and not on-chain-eligible, the "Register Now — 0.0006 ETH" button, regardless of what the DB says.
3. **Fix the misleading copy**: button label "Register Now — 0.0006 ETH" and drop "Registration starts automatically".
4. **Telegram return target**: use the direct Mini App URL that resumes the current instance rather than a bot `?startapp` cold start, and keep an explicit "I approved in my wallet — resume" affordance so a relaunched instance can re-attempt reconnect.
5. Optionally add a visible reconnect/diagnostic line (chainId, address, connector) on the airdrop page to make the Android test conclusive.

## 4. What must NOT change

- `src/lib/contracts.ts` (address, ABI, 600000000000000 wei)
- chain 46630 definition in `src/lib/wagmi-config.ts`
- the external Supabase project, its schema, its data, or `src/integrations/external-supabase/client.ts`
- the write-after-receipt ordering in `saveWalletRegistration`
- the native-`window.open` shim behaviour (only `t.me` / `tg://` intercepted)
- the `events` / `@walletconnect/universal-provider` polyfills in `vite.config.ts`
- games, tasks, points, referrals, rankings, profile

## 5. Minimal implementation plan (on approval)

1. airdrop-page: derive `isRegistered` from `isEligible === true`; keep `dbRegistration` only for the "registered on" display and for the disconnected state.
2. airdrop-page: delete the `dbRegistrationRef` early return in `handleRegister`.
3. airdrop-page: correct button label and helper text.
4. wagmi-config / appkit-runtime: point the WalletConnect redirect at the Mini App resume URL.
5. Build, then a real Android Telegram test (MetaMask / OKX / Trust) confirming: connect → `isConnected` true → press Register → wallet asks for 0.0006 ETH → receipt → Supabase row written.

No file has been modified.
