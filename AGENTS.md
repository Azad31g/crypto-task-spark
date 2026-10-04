<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AZOX rewards and account writes use azox-secure.functions.ts; Stories engagement uses stories.functions.ts; both identify the user only from server-verified Telegram initData; why: browser-supplied identities cannot be trusted.
- Server code imports reward/rank values only from pure files (src/lib/ranks.ts, src/lib/rewards.ts, src/lib/social-tasks.ts); why: azox-data.ts pulls in images.
- Stories use dedicated stories.functions.ts wrappers and stories.server.ts helpers with verified Telegram identity for engagement and server-only admin authorization; why: the existing story tables are service-role-only and audience data must never reach ordinary users.
