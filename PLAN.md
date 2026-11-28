# PLAN — "Sell with us" single-shop application flow

## Goal and users
A shop owner already signed in to the Faazio customer app taps **Sell with us** in *You → Earn with us*.
Today the screen asks them to build a business account **plus a list of shops** (add/remove cards, each
with app, sub-category, fee, documents, bank override and pin). The owner has one shop, so the form is
rewritten as **one shop, two steps**, matching the paper form they were asked to follow:

- **Step 1 — Business account:** owner name, owner number, shop name, shop number, contact email,
  shop address, category (Mart / Food / Pharma), shop photo, shop location. Then **Next**.
- **Step 2 — Licence, payout and signature:** platform fee, owner PAN, the category licence (label and
  document change per category), beneficiary / bank name / account number / IFSC, bank passbook,
  digital signature, agreements. Then **Complete the required steps**.

"Working" means: a signed-in user can pin one shop, attach a photo, pick a category, choose a real
server-provided platform-fee tier, attach the matching licence, sign by OTP and submit — and gets the
existing *under review* card from `GET /sellers/me` on the next open.

Design brief — for a single-shop owner on a mid-range Android phone; the job of each step is to
collect half a paper application without a second screen of explanation; mood: plain, ledger-like,
honest; direction: **paper ledger** (calm base surface, hairline underline fields, one accent, a large
numeral step rail); memorable moment: the underlined field set that mirrors the printed form.

## Scope
In scope
- Rewrite the form body of `SellerRegistrationScreen` into the two-step wizard (single shop).
- Remove from the UI: business-name / GSTIN / business-address fields, sub-category picker, add/remove
  shop, per-shop bank override, per-shop fee text box.
- Category-specific licence block: Food → FSSAI, Pharma → drug licence, Mart → shop registration
  certificate.
- Keep: OTP signature, clickwrap agreements, contract tiers (server-owned rate card), draft autosave,
  geo derivation from the shop pin, all four existing status cards (loading / under review / rejected /
  active), document capture pipeline and `POST /sellers` submission.

Out of scope
- Server schema or handler changes (the existing `POST /sellers` payload already carries every field).
- The Seller Partner app, the portal's admin review screens, and the post-approval fee-change flow.

## Architecture
| Choice | Why |
| --- | --- |
| Existing Go gateway `POST /sellers` / `GET /sellers/me` | Already live and the only write path; no new endpoint needed |
| Existing `VendorDraft` + `sellerDraft.ts` autosave | Keeps device draft behaviour; single shop is an array of one |
| New `PaperField` in `components/FormControls.tsx` | Underline field style used by both steps, one definition |
| Existing `SelectDropdown`, `DocumentRow`, `SellerLocationPicker`, `ContractTerms` | Reuse over duplication |
| React Native state only (no new store) | Screen-local wizard state; nothing shared |

Data: `sellers.sellers` (account) + `sellers.vendors` (one shop, `shop_phone` added to the draft only —
the server already stores `vendors.phone`). Rules live in the screen's `validate()` (client) and in the
gateway handler (server authority). Banner/hero copy is static UI text, never data.

Auth boundary: the screen is inside the signed-in customer stack; the account phone comes from
`authStore` and is locked when present. Licence mapping for Mart reuses the vendor FSSAI slot because
that is the only generic licence column on `vendors`; documented in the flow page.

## Risks and assumptions
- Assumed the printed "Sub. category" line is intentionally dropped (user's instruction) — the shop's
  category is the three-way Mart / Food / Pharma choice; gateway `category_id` is sent as null.
- Assumed "Platform Fee: 10 / 13 / 15" means a fee choice, so it is the server's contract-tier list
  shown as its real commission percentages (no hardcoded rate card).
- Assumed the boxed line at the bottom of the second sheet is the signature, mapped to the existing OTP
  digital signature.
- Mart shops have no licence requirement server-side; the Mart certificate is optional and stored in the
  FSSAI slot when given.
- Cannot verify on a device here (no Metro/emulator attached); verification is typecheck + boundary
  check + review of the rendered structure.

## Phases

## Phase 1: Two-step single-shop application
Goal: the whole new form, end to end on the existing gateway write path.

- [ ] `PaperField` underline input added to `FormControls`
- [ ] `shopPhone` carried through `VendorDraft`, `newVendorDraft`, and the device draft
- [ ] Step 1 renders the nine business-account rows, category chips, photo and location, gated by Next
- [ ] Step 2 renders fee, PAN, category licence, bank block, signature and submit
- [ ] Validation and payload map the new single-shop fields (`businessName`/`businessAddress` derived
      from the shop, no sub-category)
- [ ] Flow docs and the user flow guide updated

Acceptance: opening *You → Sell with us* shows step 1 only; Next validates and reveals step 2; each
category shows its own licence; submitting sends one shop to `POST /sellers` and the screen shows the
*under review* card on reload.

## Phase 2: Post-submission clarity (later, not now)
Goal: make the waiting state self-service.

- [ ] Show submitted shop summary + licence status on the under-review card
- [ ] Link a rejected applicant to the portal edit path

Acceptance: a rejected applicant can see exactly which field failed and what to change.
