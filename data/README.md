# Faazio Data (SDUI Source of Truth)

Single source of truth for all product, store, and UI metadata used by the React Native client (`client/mobile/`).

Structure:
- `types.ts` — canonical `Product`, `AppBrand`, `StoreProfile`, `CartItem`, `Review`, etc.
- `schema.ts` — SDUINode discriminated union types
- `home/`, `food/`, `mart/`, `grocery/`, `pharma/`, `cart/`, `account/`, `explore/`, `categories/`, `productMeta/` — domain data as SDUI node trees
- `index.ts` — re-exports

Consumed by `client/mobile/` via Metro watchFolders + `@data/*` TS path alias.
