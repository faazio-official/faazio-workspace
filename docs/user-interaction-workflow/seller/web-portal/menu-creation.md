# Seller creates and publishes a restaurant dish

**App / route(s):** seller web portal · `/seller/menus` (FOOD shops only)
**Status:** Shipped
**Trigger:** A FOOD seller taps **Add dish** in the Menu page (or **Edit** on an existing dish).

## Steps

1. The page scopes to the seller's active shop (`useSellerScope().storeId`) and lists the shop's dishes
   with `useMenus({ sellerId, venueId: storeId, status })` → `GET /seller/menus?venueId=`. Rows are
   grouped **section → sub-category** (using the `sectionName` / `subCategoryName` the gateway resolves
   from the taxonomy tree), matching how the customer app lays out the menu. A Mart/Pharmacy shop that
   reaches this URL gets a guard, not a form (menus are FOOD-only).
2. **Add dish** opens a drawer. The seller fills:
   - **Dish photo** — a drag-and-drop / tap dropzone. The picked file is previewed locally and uploaded
     only on save (so an abandoned form leaves no orphan asset). Upload goes through the shared media
     registry (`POST /media/upload-url` → presigned PUT → `POST /media/confirm`, owner type `MENU`),
     yielding an `r2:<key>` reference. The seller never pastes a URL.
   - **Dish name** (required) and an optional **English description**.
   - **Menu section** — the parent category (a section header). **Sub-category** — the leaf; only leaves
     are selectable and a dish can never be filed on a parent. The options come from the superadmin
     taxonomy (`GET /categories?app=FOOD`, parent = header, child = leaf). A section with no
     sub-categories shows an inline "ask the superadmin to add one" note.
   - **Dish details & filter tags** (contextual, optional) — the moment a sub-category is picked the
     form fetches that leaf's facet groups (`GET /categories/{id}/attribute-groups`) and renders them
     as pill chips. Burger shows Patty / Patty Type / Cheese Type / Dressing / Bun; Ice Cream shows
     Flavour / Type; Shake shows Flavour / Type / Additive; Rolls shows Ingredient / Sauce / Base /
     Region / Cuisine Origin (`0145` splits Sauce out of Ingredient). Every other FOOD leaf (Dosa, Fried Rice, Chicken, Paratha, Rice, Fries,
     …) shows the global **Dietary Preference** group only. Every group is optional (never blocks
     publishing), `single_select` groups behave like a radio row and `multi_select` groups accept
     several picks; long lists get an in-card search. The dish name **auto-tags**: matching each
     option's label + `keywords` against the typed name pre-selects chips with an *"Auto-detected —
     tap to adjust"* badge (a chip the seller removes is suppressed until re-picked). These tags are
     the customer filter facets, not sub-categories. The leaf's `priceTierSet` (`standard` /
     `premium` / `snack`, `0143`) tells the customer price filter which bucket thresholds to derive
     from the dish's base price. Under the picked leaf the form also shows its one-line cuisine
     mapping (`atomicCategory · atomicSubcategory`, `0145`), e.g. Dosa → South Indian · Tamil Tiffin.
   - **Cuisine** (free text with suggestions), **Dietary type** (Veg / Non-veg / Egg).
   - **Price (₹)** (required, ≥ 0) and optional **MRP (₹)**; MRP must be ≥ price, and the inline
     discount % appears when it is higher.
   - **Tamil translation** (collapsible, optional): Tamil name + Tamil description. Validation is
     relaxed — Tamil letters, digits and light punctuation (`tamilFieldError`); blank means the app
     falls back to the English copy. A non-Tamil character blocks save with a toast.
   - **Add-ons** (collapsible, optional): tick existing add-ons to attach to this dish, or create a new
     one inline (name, group, price, veg flag) — see [addons.md](./addons.md).
3. The seller picks an explicit intent:
   - **Save as Draft** → the dish is written and left unpublished (`DRAFT`).
   - **Publish Dish** → the dish is written (the gateway always inserts new dishes as `DRAFT`) and then
     immediately moved to `ACTIVE` via `setMenuStatus`.
   There are no typed **venue id** or **dish id** fields: the venue comes from the active shop and the
   gateway derives a readable, collision-free dish id from the name (`slugDishId`).
4. **Availability** — each dish row carries an Available / Unavailable toggle
   (`setMenuStatus(venueId, dishId, "ACTIVE" | "DELISTED")`) so a kitchen can pull a dish for a shift
   without deleting it. Edit re-opens the same drawer pre-filled; Delete removes the dish.

## State

- Page-local React state in `app/seller/menus/page.client.tsx` (form fields, drawer/tab open flags,
  selected add-ons, add-on draft). The dish list itself is the shared `menus` slice via `useMenus`.
- Facet-tag state in the same page: `attrSelected` (the chips saved with the dish), plus `attrTouched`
  / `attrSuppressed` so the name auto-tagger never overrides a manual pick or re-adds a chip the seller
  removed. `useSubcategoryAttributes(subCategoryId)` supplies the groups; changing the sub-category
  resets the selection and swaps the card.
- Add-ons + dish links are page-local, refreshed with `listAddons` / `listMenuAddons`.

## Data path

- `upsertMenu` → `POST /seller/menus` (create) or `PUT /seller/menus/{venueId}/{dishId}` (edit) →
  `directory.menus`. The gateway resolves the venue from the seller's shop and rejects a venue the
  seller does not own (`SellerOwnsVenue`); it derives the dish id when none is supplied.
- The write validates **leaf-only** placement twice: in the handler (`TaxonomyLeafCategory`) and inside
  the upsert SQL (a `leaf` CTE requires `parent_id is not null and is_active and app = 'FOOD'`). A
  parent category (section header) is rejected with `400`.
- New columns persisted: `description`, `section_id`, `sub_category_id`, `dietary_type` (migration
  `0124_menu_taxonomy_dietary.sql`). `is_veg` stays the veg-mark source of truth and is kept consistent
  with the dietary type on every write.
- Facet tags: the same write carries `attributeOptionIds`, persisted to `directory.menu_item_attributes`
  inside the menu transaction (`0138`). A nil list on an edit leaves existing tags untouched; an
  explicit list (including `[]`) replaces them. Every option must belong to a group whose
  `subcategory_id` equals the dish's sub-category, else the gateway returns `400 invalid_attribute`.
  Both `GET /seller/menus` and the public `GET /venues/{id}/menu` project `attributeOptionIds`.
- `setMenuStatus` → `PUT /seller/menus/{venueId}/{dishId}/status` → `status` (`ACTIVE` / `DELISTED`).
- `deleteMenu` → `DELETE /seller/menus/{venueId}/{dishId}`.
- Image: `POST /media/upload-url` (owner `MENU`) → presigned PUT → `POST /media/confirm`; the stored
  value is an `r2:<key>` object reference.
- Public customer read: `GET /venues/{venueId}/menu` serves `ACTIVE` rows only, now including
  `sectionId` / `subCategoryId` / `sectionName` / `subCategoryName` / `dietaryType`, ordered by the
  taxonomy sort order so the app can group by section → sub-category.

## Success / error / empty

- **Success:** the drawer closes, the toast confirms "published" / "saved as draft" / "updated", and the
  dish appears under its section → sub-category in the grouped list.
- **Error:** a validation toast names the missing field (name, sub-category, price, MRP < price, Tamil
  characters); a gateway rejection surfaces its message and the optimistic row is rolled back.
- **Empty:** "No dishes yet — add a dish under a sub-category, or change the status filter".

## Known gaps

- Publishing is a two-call sequence (create as DRAFT → set ACTIVE). A single create-with-status would
  save a round trip; the current split keeps the gateway's insert contract unchanged.
- The customer mobile app renders the section/sub-category fields only after it adopts them; until then
  it keeps its existing ordering.

## Linked docs

- [addons.md](./addons.md) — add-on creation, linking and moderation.
- [super-admin-categories.md](./super-admin-categories.md) — the taxonomy that defines sections/leaves.
- [../catalog/inventory.md](../catalog/inventory.md) — FOOD inventory (availability + add-ons).
- `docs/architecture/db-schema.md`, `docs/architecture/monolith-breakdown.md` §1.
