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

export type SellerTourStep = {
  /** Stable anchor id, also used as the accordion value (`#step-entry`). */
  id: string;
  screen: SellerTourScreen;
  /** Must match a `data-tour-target` in the matching screen. */
  target: string;
  title: string;
  detail: string;
  /** Shown under the animation, inside the same dropdown. */
  requirements: readonly string[];
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
    title: "Open My Account and tap Sell with us",
    detail: "In the Faazio app, Sell with us sits under Earn with us in your account menu.",
    requirements: ["The Faazio app, signed in with your account"],
  },
  {
    id: "business",
    screen: "business",
    target: "business-name",
    title: "Add your business and payout details",
    detail:
      "Business name, owner, PAN, an optional GSTIN, your address and the bank account for payouts.",
    requirements: [
      "Business name, owner name and PAN — GSTIN is optional",
      "Business address, contact phone and email",
      "Bank account, IFSC and a passbook photo",
    ],
  },
  {
    id: "shops",
    screen: "shops",
    target: "add-shop",
    title: "Add each shop you sell from",
    detail:
      "Every shop needs an address, a category and its licence — FSSAI for food, a drug licence for pharmacy.",
    requirements: [
      "Each shop's name, address, category and its own pin",
      "FSSAI details for food, or a drug licence for pharmacy",
    ],
  },
  {
    id: "contract",
    screen: "contract",
    target: "contract-tier",
    title: "Review the contract tier and agreements",
    detail:
      "Faazio shows the commission and payout terms from its own rate card. You then accept the terms and the content licence.",
    requirements: [
      "Faazio's commission and payout rate card",
      "The seller agreement and content licence",
    ],
  },
  {
    id: "verify",
    screen: "verify",
    target: "otp",
    title: "Verify your phone and submit for review",
    detail:
      "A one-time code signs the application. It reaches Faazio as Pending review — nothing is approved automatically.",
    requirements: ["A phone that can receive the one-time code"],
  },
];
