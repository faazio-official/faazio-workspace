# User Profile Module

This directory handles the user account surface. The **My Account** screen lives
exclusively on the main root tab bar (`MainTabs` → `You`). Sub-app wrappers
(Mart / Grocery / Pharma / Food) intentionally have **no** Account/Profile tab.

## 📁 Key Files
- `AccountScreen.tsx` / `YouScreen.tsx`: Thin wrappers rendering the shared
  presentational `AccountView`. `AccountScreen` (tab) omits the back arrow;
  `YouScreen` (pushed) wires `onBack`.
- `AccountView.tsx`: Presentational "My Account" page — header, profile card,
  Smart Saver banner, grouped navigation list (incl. **My Orders** row), and
  logout. Reads content from `@data/account/*`.
- `MyOrdersScreen.tsx`: "My Orders" — a **sub-app chip rail** (All / Mart / Food /
  Grocery / Pharma) plus a status **filter sheet**. Orders are filtered by
  sub-app × status (AND). Status counts are derived at runtime from `myOrders`.
- `MyOrdersAppRail.tsx`: Presentational sub-app chip rail (reuses `SECTOR_VISUALS`
  from `@/theme/sectorVisuals`).
- `MyOrdersFilterSheet.tsx`: Bottom sheet (on shared `SlideUpSheet`) to filter by
  order status — single-select, staged then applied.

## 🛠️ Implementation Standards
- **Data-driven**: Screen is presentational; profile / orders / nav content comes
  from `@data/account/*` (`profile.ts`, `orderStatus.ts`, `accountNav.ts`,
  `orders.ts`).
- **Single owner**: Account lives only on the root tab bar — never inside a
  sub-app wrapper. Logout clears the cart store and resets navigation to Login.
- **Responsive**: Uses `hs`/`vs`/`ms` scale helpers and `AppText` throughout.
- **Reuse**: Sub-app visuals come from `@/theme/sectorVisuals` (shared with Home's
  `ExploreSectorsSection`); the status filter sheet reuses `@/components/shared/SlideUpSheet`.
