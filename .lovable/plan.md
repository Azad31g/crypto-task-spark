# Security gate audit — commit 091a8c3 (read-only, no changes)

Audit of all browser/client reads of `users`, `wallet_registrations`, `user_tasks`, `referrals`, `game_scores` ahead of revoking anon SELECT.

## Browser reads of `users` — 2, both limited to the 9 public columns

1. `src/lib/azox-backend.ts` → `fetchUser()` (line ~91): browser fallback when no Telegram initData. Selects `PUBLIC_USER_COLUMNS` from `src/lib/public-user.ts` = exactly `telegram_id, username, first_name, last_name, photo_url, points, tasks_done, referral_count, rank`. OK.
2. `src/lib/azox-backend.ts` → `fetchLeaderboard()` (line ~255): selects the literal string `telegram_id, username, first_name, last_name, points, tasks_done, referral_count, rank, photo_url` — the same 9 columns. OK.

No `select("*")` or full-row `users` read exists in any browser file.

## Restricted tables — no browser reads

- `wallet_registrations`, `user_tasks`, `game_scores`: every `from(...)` hit is inside `src/lib/azox-secure.functions.ts` (server functions; handlers run server-side via the admin client, dynamically imported). Browser files only mention these names in comments, types, or UI labels (`useTasks.ts`, `useGameTasks.ts`, `daily-batch.ts`, `referral.ts`, `profile-page.tsx`, `airdrop-page.tsx`, etc.) — no queries.
- `referrals`: no table read anywhere; remaining matches are demo data in `azox-data.ts`, UI copy, and route names.
- Verified server-function reads (initData-verified): `profile.server.ts` (`readMyUser`, `readMyWalletRegistration`, `readMyTaskCount`, `readReferredUsers`) and `azox-secure.server.ts`/`azox-secure.functions.ts` handlers.

## `select("*")` occurrences — 2, both acceptable

1. `src/lib/azox-secure.functions.ts:137` — server-side read of the caller's own `users` row after `upsert_user` (admin client, verified identity). Not a browser read.
2. `src/hooks/useAnnouncements.ts:71` — `select("*")` on `announcements`, which is intentionally anon-readable. Not one of the restricted tables. Note: if `announcements.is_private` filtering relies on server-side logic, this read returns all columns of all rows to anon — flagged for awareness, not a blocker for the 5-table lockdown.

## Verdict

Gate passed for the five tables: revoking anon SELECT on `wallet_registrations`, `user_tasks`, `referrals`, `game_scores` breaks nothing in the browser. `users` anon SELECT can be narrowed to the 9 public columns (or kept as-is) without breaking `fetchUser` or `fetchLeaderboard`. One awareness item: `announcements` is read with `select("*")` by anon — confirm that is intended before any future lockdown of that table.

No files changed.
