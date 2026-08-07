# Pending Work

Scoped, dated backlog entries for features intentionally deferred until their
dependencies exist. Do not build the backend/seller flows until told to.

---

## Store Offers — seller-managed (future backend)

**Status:** 🟡 Static seed in production UI. Backend-dependent.

**Feature:** The Home **Store Offers** section (`features/home/sections/StoreOffersSection.tsx`)
currently reads a static seed array from `data/home/storeOffers.ts`.

**Future:** Must be backed by seller/store-owner dashboard writes — a store owner
creates/edits/expires their own offer, which flows into this Home section per-store,
geofenced/ranked by relevance. This will likely be served by the Go Chi backend in
`server/` (currently a placeholder per `AGENTS.md`).

**Blocked by:**
- `server/` backend (not yet built).
- Auth/roles for store owners.
- An admin/seller app or web portal (out of scope for `client/mobile/`).

**Interim contract:** Keep the `StoreOffer` data shape (`data/types.ts`) stable. The
section's `profileFor` mapping is the only boundary that touches the data; swapping the
static array for an API call should be a one-file change inside
`StoreOffersSection.tsx`.

**Date:** 2026-08-01

---

## Nearby Offers — product-level, from nearby stores (live geo)

**Status:** 🟡 Static seed. Data shape stable.

**Feature:** The Home **Nearby Offers** section (`features/home/sections/NearbyOffersSection.tsx`)
shows product-level deals (`NearbyOffer` in `data/types.ts`) surfaced from stores physically
near the user. Currently seeded statically in `data/home/nearbyOffers.ts`.

**Future:** Rank/geofence by live user location and per-store availability once the backend
exists.

**Interim contract:** `NearbyOffer extends Product` + `distance`. Keep the shape stable so
swapping in a geo-ranked API response is a data-layer change only.

**Date:** 2026-08-01
