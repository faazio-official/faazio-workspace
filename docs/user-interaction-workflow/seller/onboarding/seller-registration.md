# Seller registration / application

**App / route:** customer app `SellWithUs` (`features/seller-onboarding/SellerRegistrationScreen.tsx`)
and portal `/seller/onboarding`
**Status:** Shipped
**Trigger:** "Sell with us" entry, or portal seller onboarding.

## Steps

1. Applicant enters account fields (business name, owner, PAN, optional GSTIN) and one or more
   vendor entries (app, category, per-store fee, FSSAI or drug licence, own pin, optional masked
   bank override).
2. Phone verification (Firebase OTP on mobile; portal session on web).
3. KYC documents upload (`uploadSellerDocument`).
4. `gateway.submitSellerApplication(input)` → `POST /sellers` stores `sellers.sellers.user_id` from
   the auth subject and the `vendors[]` payload.
5. `GET /sellers/me` returns the newest application linked by `user_id` (`404` = none).
6. A rejected application can be edited with `POST /sellers/{id}/edit` (REJECTED only).

## State

- `useAuthStore` — applicant identity (mobile).
- Portal `usePortalStore` + HttpOnly portal cookies.
- Local form state.

## Data path

- `gateway.submitSellerApplication` → `POST /sellers` → `sellers.sellers`.
- `gateway.getMySellerApplication` → `GET /sellers/me`.
- `gateway.uploadSellerDocument` → `/media/upload-url` + R2 `PUT` + `/media/confirm` →
  `media.assets`.
- `gateway.resubmitSellerApplication` → `POST /sellers/{id}/edit`.
- No fixture seller rows are presented as live.

## Success / error / empty

- **Success:** application pending review.
- **Error:** inline validation/API error; no fake approval.
- **Empty:** no application → onboarding entry state.

## Known gaps

- Mobile OTP verification is unavailable when Firebase Auth is unconfigured; the screen says so.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (seller onboarding)
- `docs/architecture/web-portal.md`
- `docs/RUNBOOKS/FIREBASE_AUTH.md`
