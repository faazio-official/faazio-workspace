# User Profile Module

This directory handles the user account surface. The **My Account** screen lives
exclusively on the main root tab bar (`MainTabs` → `Account`). Sub-app wrappers
(Mart / Grocery / Pharma / Food) intentionally have **no** Account/Profile tab.

## 📁 Key Files
- `AccountScreen.tsx`: The pixel-perfect "My Account" screen — header, profile
  card, Smart Saver banner, My Orders status grid, grouped navigation list, and
  logout. Reads all content from `@data/account/*`.

## 🛠️ Implementation Standards
- **Data-driven**: Screen is presentational; profile / orders / nav content comes
  from `@data/account/*` (`profile.ts`, `orderStatus.ts`, `accountNav.ts`).
- **Single owner**: Account lives only on the root tab bar — never inside a
  sub-app wrapper. Logout clears the cart store and resets navigation to Login.
- **Responsive**: Uses `hs`/`vs`/`ms` scale helpers and `AppText` throughout.
