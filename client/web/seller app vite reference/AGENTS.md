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

## Architecture
- All mock data lives in `src/mocks/*` (one module per domain); screens read via `src/services/api.ts` and the in-memory store `src/store/app-store.ts` so a real DB can replace mocks without UI changes.
- App is mobile-only: every screen renders inside `MobileFrame` (max 430px); Orders-mode screens use `OrdersShell`, Business Hub screens use `HubShell`.
