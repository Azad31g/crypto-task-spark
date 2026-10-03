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

- All AZOX database writes go through server functions in src/lib/azox-secure.functions.ts that identify the user only from server-verified Telegram initData; why: browser-supplied ids and amounts cannot be trusted.
- Server code imports reward/rank values only from pure files (src/lib/ranks.ts, src/lib/rewards.ts, src/lib/social-tasks.ts); why: azox-data.ts pulls in images.
