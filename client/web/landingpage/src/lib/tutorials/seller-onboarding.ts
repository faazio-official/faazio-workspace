/**
 * Seller onboarding walkthrough script.
 *
 * This is the single source of truth for chapter 1 of the `/tutorial` page.
 * The steps mirror the real application in the customer app — see
 * `docs/user-interaction-workflow/seller/onboarding/` and
 * `client/mobile/src/features/seller-onboarding/SellerRegistrationScreen.tsx`.
 * That screen is ONE scrolling form (Part 1 business account, Part 2 your
 * shops), not a set of separate screens, so the walkthrough keeps the same
 * screen mounted and moves through its real sections in document order:
 * My Account → business identity → KYC + payout → contract & terms → digital
 * signature → your shops → submit → Pending review.
 *
 * Labels are copied (not imported) because the landing page is a separate
 * deploy and must not depend on `@data/*`.
 *
 * The walkthrough is illustrative: it never submits anything. Keep it in step
 * with the docs; if the mobile flow changes, change this file in the same PR.
 */

export type SellerTourScreen = "account" | "registration" | "review";

export type SellerTourAction = "tap" | "type";

export type SellerTourStep = {
  /** Stable anchor id, also used as the React key (`#step-entry`). */
  id: string;
  screen: SellerTourScreen;
  /** Must match a `data-tour-target` in the matching screen. */
  target: string;
  action: SellerTourAction;
  title: string;
  detail: string;
  /** Dwell time in Watch mode, after the tap. */
  holdMs: number;
};

/**
 * One status line shared with `/partners` so the two pages cannot disagree.
 * The application lives in the mobile app; the landing page is a preview.
 */
export const SELLER_ONBOARDING_STATUS =
  "Starting in Karaikal. Applications open in the Faazio app when partner onboarding launches.";

/**
 * The whole application in document order, exactly as `SellerRegistrationScreen`
 * lays it out: entry → business identity → payout → contract → signature →
 * shops → submit → the Pending-review state the screen swaps to.
 */
export const SELLER_TOUR_STEPS: readonly SellerTourStep[] = [
  {
    id: "entry",
    screen: "account",
    target: "sell-with-us",
    action: "tap",
    title: "Open My Account and tap Sell with us",
    detail:
      "In the Faazio app, Sell with us sits under Earn with us in your account menu, below the FaazioCoins streak card.",
    holdMs: 1500,
  },
  {
    id: "business",
    screen: "registration",
    target: "business-name",
    action: "type",
    title: "Add your business identity",
    detail:
      "Business name, owner name, PAN and an optional GSTIN, plus the address, phone and email the review team contacts.",
    holdMs: 1900,
  },
  {
    id: "payout",
    screen: "registration",
    target: "payout-account",
    action: "type",
    title: "Add the payout account and passbook",
    detail:
      "Bank name, account number, IFSC and beneficiary, with the passbook photo. The full account number goes to the payment provider, never stored by Faazio.",
    holdMs: 1900,
  },
  {
    id: "contract",
    screen: "registration",
    target: "contract-tier",
    action: "tap",
    title: "Pick the contract tier and accept the agreements",
    detail:
      "Faazio's rate card sets the commission and payout days. You then accept the Terms, the Seller / Partner Agreement and the content licence.",
    holdMs: 2200,
  },
  {
    id: "signature",
    screen: "registration",
    target: "otp",
    action: "type",
    title: "Verify your phone — the digital signature",
    detail:
      "A one-time code sent by Firebase signs the application. Editing the phone number invalidates the code.",
    holdMs: 2200,
  },
  {
    id: "shops",
    screen: "registration",
    target: "shop-app",
    action: "tap",
    title: "Add each shop you sell from",
    detail:
      "Every shop picks its app, category, platform fee, licence and map pin. The first pin sets your state and district.",
    holdMs: 2200,
  },
  {
    id: "submit",
    screen: "registration",
    target: "submit-for-review",
    action: "tap",
    title: "Submit for review",
    detail:
      "Submit unlocks only when the OTP, passbook, tier, agreements and each shop's details are complete.",
    holdMs: 2000,
  },
  {
    id: "review",
    screen: "review",
    target: "review-done",
    action: "tap",
    title: "Pending review",
    detail:
      "The application reaches Faazio as Pending review with its application ID, shops, contract and compliance status. Nothing is approved automatically.",
    holdMs: 2400,
  },
];
