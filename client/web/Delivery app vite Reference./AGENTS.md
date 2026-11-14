<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- All mock data lives in `src/mocks/` (typed, re-exported from `index.ts`); app state in `src/lib/partner/store.tsx` reads only from there — swap these for DB calls later.
- App is mobile-only: root renders a max-w-[430px] frame; don't add desktop layouts.
- Delivery transitions are validated in shared pure rules and the partner store, not only by screen controls, so checklist, PIN, and cash requirements cannot be bypassed by another view.
- Mock trip estimates and verification values belong to the mock layer; route graphics are explicitly illustrative rather than live navigation.
- Define partner context in its own non-component module so provider hot updates do not create a different context from the one mounted route consumers read.
- Zone maps use react-zoom-pan-pinch over local illustrative SVG geography with zone data in the mock layer; this keeps touch gestures reliable without presenting mock coordinates as live GPS.

- Partner operations use modular mock records and shared provider state with pure booking/referral validation; new screens never persist or send mock requests externally.
- New content routes share a metadata helper; shared utility actions and active-order access live in the tab shell to preserve navigation across all five tabs.
- Reference gig bookings and voucher checkout use shared provider state plus pure selection and balance validation; this keeps every screen consistent without external mock requests.
- Reference feed snapshots stay separate from the session delivery ledger; static video metrics must not be presented as newly earned money.
- In-app navigation uses a local illustrative gesture-enabled map and a user-started simulation; it never claims live GPS or advances actual delivery status.
