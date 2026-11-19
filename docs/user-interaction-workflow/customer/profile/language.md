# Language (English / Tamil)

**Status:** Shipped.
**Routes:** `MainTabs` → `You` / pushed `You` → `Language` (`features/profile/LanguageScreen.tsx`)
**Trigger:** My Account → **Preferences → Language**.

## Flow

1. **Entry.** `AccountView` renders a client-side **Preferences → Language** row directly under the
   **Appearance** row, after the server-driven `GET /account-nav` groups (the server catalog is not
   modified). Its subtitle shows the current choice — `English` or `தமிழ் (Tamil)`.
2. **Tap.** The row navigates to the typed root-stack route `Language`.
3. **Select.** `LanguageScreen` shows the two shipped languages as radio rows (from
   `src/lib/languages.ts`, the single list shared with onboarding), the current one checked. Choosing
   the other language writes the store and returns to Account.
4. **Persist.** `setLanguage(id)` updates `languageStore` and writes AsyncStorage key
   `faazio:selectedLanguage`. No gateway call.
5. **Apply.** Every consumer reads the store, so the switch is immediate — no restart:
   - `AppText`/`AppTextInput` re-resolve the font family (`theme/fonts.ts`) — the bundled Hind Madurai
     face for Tamil, the platform family for English — and `App.tsx` rebuilds the navigation chrome
     fonts.
   - The localized copy helpers (`lib/localizedText.ts`) re-read it, so product/category names,
     Food dish and add-on copy, and store/venue names switch to the seller-authored Tamil text.
   - Search matches Tamil in both directions (client predicates + the `search_vec` built by `0108`).
6. **Fallback.** A translation the seller/admin never authored renders the English canonical value;
   the app never shows a blank label. Cart lines and order copy keep the English item name
   (`addToCart(id, product.name, …)`) so order identity never depends on the UI language.

## State

- `useLanguageStore` — `language` (`'en'` default, `'ta'`), `hydrated`, `setLanguage`, `hydrate`.
- Hydration runs in the startup gate (`App.tsx` `Promise.all` with auth/theme/onboarding) so a
  persisted choice is applied before the splash ends.
- `src/lib/languages.ts` — `LANGUAGES` / `DEFAULT_LANGUAGE` / `languageLabel()`; onboarding's
  `LanguageSelectionScreen` and this screen both read it, so the list cannot drift.

## Data path

- **None.** The choice is device-local (`AsyncStorage` `faazio:selectedLanguage`); it is not sent to
  the gateway and has no Supabase table. The Tamil copy itself is server data
  (`catalog.products`, `taxonomy.categories`, `directory.*` `_ta` columns — see
  `docs/architecture/db-schema.md`).

## Success / error / empty

- **Success:** the selected language is saved, applied immediately across copy and fonts, and
  survives a cold start.
- **Error:** an AsyncStorage read/write failure is non-fatal — the app stays on English; a failed
  write is best-effort and does not block the UI.
- **Empty:** no stored preference = English.

## Known gaps

- Category Tamil copy is not searched (only products carry a Tamil FTS vector) — see
  [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).
- No UI-chrome strings are translated: the app's own labels stay English, only seller/admin-authored
  catalog and directory copy switches.

## Linked docs

- `docs/architecture/mobile-app.md` → Localization — English + Tamil
- [`theme.md`](./theme.md) — the sibling device-local preference (Appearance)
- [`../onboarding/index.md`](../onboarding/index.md) — the first-run picker that sets the same store
