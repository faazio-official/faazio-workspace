/**
 * Seller onboarding walkthrough script.
 *
 * This is the single source of truth for the `/tutorial` page. The steps mirror
 * the real application in the customer app — see
 * `docs/user-interaction-workflow/seller/onboarding/` and
 * `client/mobile/src/features/seller-onboarding/SellerRegistrationScreen.tsx`.
 * Labels are copied (not imported) because the landing page is a separate
 * deploy and must not depend on `@data/*`.
 *
 * The walkthrough is illustrative: it never submits anything. Keep it in step
 * with the docs; if the mobile flow changes, change this file in the same PR.
 */

export type SellerTourScreen = "account" | "business" | "shops" | "contract" | "verify";

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
 * Minimum steps that still show the whole application: entry → business
 * details → shops → contract → phone verification and submit.
 */
export const SELLER_TOUR_STEPS: readonly SellerTourStep[] = [
  {
    id: "entry",
    screen: "account",
    target: "sell-with-us",
    action: "tap",
    title: "Open My Account and tap Sell with us",
    detail: "In the Faazio app, Sell with us sits under Earn with us in your account menu.",
    holdMs: 1500,
  },
  {
    id: "business",
    screen: "business",
    target: "business-name",
    action: "type",
    title: "Add your business and payout details",
    detail:
      "Business name, owner, PAN, an optional GSTIN, your address and the bank account for payouts.",
    holdMs: 1900,
  },
  {
    id: "shops",
    screen: "shops",
    target: "add-shop",
    action: "tap",
    title: "Add each shop you sell from",
    detail:
      "Every shop needs an address, a category and its licence — FSSAI for food, a drug licence for pharmacy.",
    holdMs: 1900,
  },
  {
    id: "contract",
    screen: "contract",
    target: "contract-tier",
    action: "tap",
    title: "Review the contract tier and agreements",
    detail:
      "Faazio shows the commission and payout terms from its own rate card. You then accept the terms and the content licence.",
    holdMs: 2200,
  },
  {
    id: "verify",
    screen: "verify",
    target: "otp",
    action: "type",
    title: "Verify your phone and submit for review",
    detail:
      "A one-time code signs the application. It reaches Faazio as Pending review — nothing is approved automatically.",
    holdMs: 2400,
  },
];
