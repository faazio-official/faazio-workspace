/**
 * Full seller-journey walkthrough script for `/tutorial`.
 *
 * Chapter 1 reuses `SELLER_TOUR_STEPS` from `seller-onboarding.ts` unchanged so
 * the application walkthrough stays pinned to
 * `docs/user-interaction-workflow/seller/onboarding/`. The remaining chapters
 * mirror the shipped seller portal flows; every action maps to a real route or
 * endpoint in `docs/user-interaction-workflow/seller/` (the audit map lives in
 * that folder's `tutorial.md`).
 *
 * The walkthrough is illustrative: the stage is decorative and submits nothing.
 * Keep it in step with the workflow docs; if a seller flow changes, change this
 * file in the same PR.
 */

import { SELLER_TOUR_STEPS, type SellerTourScreen } from "./seller-onboarding";

export type SellerJourneyScreen =
  | SellerTourScreen
  | "store"
  | "store-create"
  | "catalog-add"
  | "catalog-edit"
  | "catalog-trash"
  | "pricing"
  | "inventory"
  | "menus"
  | "offers"
  | "addons"
  | "orders-board"
  | "orders-detail"
  | "pickup-qr"
  | "notifications"
  | "payouts"
  | "settings"
  | "returns"
  | "ads"
  | "analytics"
  | "reviews"
  | "prescriptions"
  | "explore"
  | "hub"
  | "outlet-info"
  | "restaurant-status"
  | "rush-hour"
  | "support"
  | "invite-accept";

export type SellerJourneyAction = "tap" | "type" | "scan" | "swipe";

export type SellerJourneyStep = {
  /** Stable anchor id, also used as the React key (`#step-<id>`). */
  id: string;
  screen: SellerJourneyScreen;
  /** Must match a `data-tour-target` in the matching screen. */
  target: string;
  action: SellerJourneyAction;
  title: string;
  detail: string;
  /** Dwell time in Watch mode, after the tap. */
  holdMs: number;
};

export type SellerJourneyChapter = {
  id: string;
  title: string;
  subtitle: string;
  steps: readonly SellerJourneyStep[];
};

export const SELLER_JOURNEY_CHAPTERS: readonly SellerJourneyChapter[] = [
  {
    id: "onboarding",
    title: "Apply to sell",
    subtitle: "From Sell with us to Pending review, in the Faazio app.",
    steps: SELLER_TOUR_STEPS,
  },
  {
    id: "store",
    title: "Set up your store",
    subtitle: "Create the vendor your products and orders belong to.",
    steps: [
      {
        id: "store-open",
        screen: "store",
        target: "store-list",
        action: "tap",
        title: "Open Stores in the portal",
        detail: "Stores lists every vendor you own and the one the console is currently using.",
        holdMs: 1500,
      },
      {
        id: "store-create",
        screen: "store",
        target: "new-store",
        action: "tap",
        title: "Create a vendor",
        detail: "A store is the shop customers see: its name, address, category and hours.",
        holdMs: 1700,
      },
      {
        id: "store-details",
        screen: "store-create",
        target: "store-name",
        action: "type",
        title: "Name, address and contact",
        detail: "Pick the app the shop sells in, then add its address, phone and opening hours.",
        holdMs: 2100,
      },
      {
        id: "store-licence",
        screen: "store-create",
        target: "store-licence",
        action: "type",
        title: "Add the shop's licence",
        detail: "Food shops record FSSAI details; pharmacy shops record a drug licence.",
        holdMs: 2000,
      },
      {
        id: "store-submit",
        screen: "store-create",
        target: "store-save",
        action: "tap",
        title: "Save the store",
        detail: "The vendor is created. Flip it live when the outlet is ready to take orders.",
        holdMs: 2200,
      },
    ],
  },
  {
    id: "catalog-add",
    title: "Add a product",
    subtitle: "One listing, from store and category to photo and review.",
    steps: [
      {
        id: "product-store",
        screen: "catalog-add",
        target: "product-store",
        action: "tap",
        title: "Choose the store",
        detail: "Products belong to a store, so pick the vendor this listing is sold from.",
        holdMs: 1500,
      },
      {
        id: "product-category",
        screen: "catalog-add",
        target: "product-category",
        action: "tap",
        title: "Pick the category leaf",
        detail:
          "Choose the active category leaf for the store's app so the listing is discoverable.",
        holdMs: 1900,
      },
      {
        id: "product-gst",
        screen: "catalog-add",
        target: "product-gst",
        action: "tap",
        title: "Confirm the GST bucket",
        detail: "The matching tax bucket is pre-selected; change it only when the item needs it.",
        holdMs: 1700,
      },
      {
        id: "product-name",
        screen: "catalog-add",
        target: "product-name",
        action: "type",
        title: "Name, price and unit",
        detail: "Add a clear name, the selling price and the unit customers receive.",
        holdMs: 2100,
      },
      {
        id: "product-image",
        screen: "catalog-add",
        target: "product-image",
        action: "tap",
        title: "Add a photo",
        detail: "Upload a photo through the media pipeline so the listing has a real image.",
        holdMs: 1900,
      },
      {
        id: "product-save",
        screen: "catalog-add",
        target: "product-save",
        action: "tap",
        title: "Save — it goes to review",
        detail:
          "Saving creates the listing and its stock row as Pending review; nothing is live yet.",
        holdMs: 2300,
      },
    ],
  },
  {
    id: "catalog-maintain",
    title: "Maintain your catalog",
    subtitle: "Edit, reprice, restock, delete and restore a listing.",
    steps: [
      {
        id: "catalog-open",
        screen: "catalog-edit",
        target: "edit-row",
        action: "tap",
        title: "Open a listing to edit",
        detail: "Your product list opens the edit screen with the listing already loaded.",
        holdMs: 1700,
      },
      {
        id: "catalog-edit",
        screen: "catalog-edit",
        target: "edit-description",
        action: "type",
        title: "Fix the description",
        detail: "Name, description, category and photo are saved in one edit.",
        holdMs: 2100,
      },
      {
        id: "catalog-price",
        screen: "pricing",
        target: "price-input",
        action: "type",
        title: "Change the price",
        detail: "Pricing lists your products; a new price is saved for that product only.",
        holdMs: 2100,
      },
      {
        id: "catalog-stock",
        screen: "inventory",
        target: "stock-qty",
        action: "type",
        title: "Set stock and ETA",
        detail: "Inventory keeps quantity and the restock ETA customers see.",
        holdMs: 2100,
      },
      {
        id: "catalog-delete",
        screen: "catalog-edit",
        target: "delete-listing",
        action: "tap",
        title: "Delete a listing",
        detail: "Deleting hides the item from shoppers immediately and asks for a reason.",
        holdMs: 2000,
      },
      {
        id: "catalog-restore",
        screen: "catalog-trash",
        target: "restore-listing",
        action: "tap",
        title: "Restore it from Trash",
        detail: "Deleted listings stay restorable for seven days before they are removed.",
        holdMs: 2200,
      },
    ],
  },
  {
    id: "menus-offers-addons",
    title: "Menus, offers and add-ons",
    subtitle: "Food dishes, festival discounts and order extras.",
    steps: [
      {
        id: "menu-dish",
        screen: "menus",
        target: "menu-dish",
        action: "tap",
        title: "Open a dish",
        detail: "Food stores author dishes in Menu; Mart and Pharmacy stores see Offers instead.",
        holdMs: 1700,
      },
      {
        id: "menu-price",
        screen: "menus",
        target: "menu-price",
        action: "type",
        title: "Update price and MRP",
        detail: "An optional MRP must be at least the selling price; active dishes go live.",
        holdMs: 2000,
      },
      {
        id: "offer-campaign",
        screen: "offers",
        target: "offer-campaign",
        action: "tap",
        title: "Pick the live campaign",
        detail: "Offers shows the district's live or scheduled festival campaign and its cap.",
        holdMs: 1900,
      },
      {
        id: "offer-percent",
        screen: "offers",
        target: "offer-percent",
        action: "type",
        title: "Enter the discount",
        detail: "Use a whole percent within the sector cap; the live price previews beside it.",
        holdMs: 2100,
      },
      {
        id: "offer-optin",
        screen: "offers",
        target: "offer-optin",
        action: "tap",
        title: "Opt in",
        detail: "Opting in returns the product to Pending until a district admin approves it.",
        holdMs: 2100,
      },
      {
        id: "addon-create",
        screen: "addons",
        target: "addon-create",
        action: "tap",
        title: "Create an add-on",
        detail: "Inventory → Add-ons creates extras such as raita; new add-ons start as Draft.",
        holdMs: 1900,
      },
      {
        id: "addon-link",
        screen: "addons",
        target: "addon-link",
        action: "tap",
        title: "Link it to a dish",
        detail: "Link or unlink an add-on on a dish without changing the add-on's own status.",
        holdMs: 2000,
      },
      {
        id: "addon-submit",
        screen: "addons",
        target: "addon-submit",
        action: "tap",
        title: "Submit for review",
        detail: "Admin approval is required before customers can see and order the add-on.",
        holdMs: 2200,
      },
    ],
  },
  {
    id: "orders",
    title: "Take and fulfil orders",
    subtitle: "Accept, hand over with the pickup QR, and close the order.",
    steps: [
      {
        id: "orders-board",
        screen: "orders-board",
        target: "order-row",
        action: "tap",
        title: "Open the order board",
        detail: "Orders lists new, packed and shipped orders for the store you are using.",
        holdMs: 1600,
      },
      {
        id: "orders-open",
        screen: "orders-board",
        target: "order-card",
        action: "tap",
        title: "Open a new order",
        detail: "Each card shows the items, the amount and whether payment is captured.",
        holdMs: 1800,
      },
      {
        id: "orders-accept",
        screen: "orders-detail",
        target: "order-accept",
        action: "tap",
        title: "Accept the order",
        detail: "Accepting moves NEW to PACKED and dispatches a rider. Unpaid orders are blocked.",
        holdMs: 2200,
      },
      {
        id: "orders-qr",
        screen: "pickup-qr",
        target: "pickup-qr",
        action: "tap",
        title: "Show the pickup QR",
        detail: "A packed order gets a short-lived QR for the rider collecting it.",
        holdMs: 2000,
      },
      {
        id: "orders-scan",
        screen: "pickup-qr",
        target: "qr-code",
        action: "scan",
        title: "The rider scans it",
        detail: "The scan completes the pickup; the code expires after two hours.",
        holdMs: 2100,
      },
      {
        id: "orders-advance",
        screen: "orders-detail",
        target: "order-status",
        action: "tap",
        title: "Advance the status",
        detail: "Packed, shipped and delivered follow in order and the customer sees each change.",
        holdMs: 2100,
      },
      {
        id: "orders-reject",
        screen: "orders-detail",
        target: "order-reject",
        action: "tap",
        title: "Reject if you can't fulfil",
        detail: "Rejecting a new order refunds a captured payment and notifies the customer.",
        holdMs: 2100,
      },
      {
        id: "orders-returns",
        screen: "returns",
        target: "return-row",
        action: "tap",
        title: "Handle a return",
        detail: "Returns and cancellations appear in Returns and advance with the order.",
        holdMs: 2000,
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    subtitle: "Every seller alert, with a link straight to the right screen.",
    steps: [
      {
        id: "notif-bell",
        screen: "notifications",
        target: "notif-bell",
        action: "tap",
        title: "Open the bell",
        detail: "The console header shows how many alerts are unread for your login.",
        holdMs: 1600,
      },
      {
        id: "notif-row",
        screen: "notifications",
        target: "notif-row",
        action: "tap",
        title: "Open the newest alert",
        detail: "Rows are newest first, and opening one marks it read.",
        holdMs: 1900,
      },
      {
        id: "notif-deeplink",
        screen: "notifications",
        target: "notif-deeplink",
        action: "tap",
        title: "Follow the deep link",
        detail: "An alert links to its order, product or prescription when it has one.",
        holdMs: 2000,
      },
      {
        id: "notif-readall",
        screen: "notifications",
        target: "notif-readall",
        action: "tap",
        title: "Mark everything read",
        detail: "Mark all read clears the unread count; it is disabled when nothing is unread.",
        holdMs: 2000,
      },
    ],
  },
  {
    id: "payouts",
    title: "Payouts",
    subtitle: "Read the ledger, get the invoice, and know how payment is marked.",
    steps: [
      {
        id: "payout-open",
        screen: "payouts",
        target: "payout-cycle",
        action: "tap",
        title: "Open Payments",
        detail: "Payments shows your settlement cycles and the net amount for each one.",
        holdMs: 1700,
      },
      {
        id: "payout-ledger",
        screen: "payouts",
        target: "payout-ledger",
        action: "tap",
        title: "Read the ledger",
        detail: "The ledger derives from delivered orders, not from a stored estimate.",
        holdMs: 2000,
      },
      {
        id: "payout-invoice",
        screen: "payouts",
        target: "payout-invoice",
        action: "tap",
        title: "Get the invoice",
        detail: "Each payout has a seller-scoped invoice; the PDF may lag behind the JSON.",
        holdMs: 2100,
      },
      {
        id: "payout-paid",
        screen: "payouts",
        target: "payout-status",
        action: "tap",
        title: "Payouts are marked by hand",
        detail:
          "There is no automatic transfer today: an admin marks the payout paid after the bank transfer.",
        holdMs: 2400,
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    subtitle: "Profile, bank, alerts, appearance, your team and sign-in.",
    steps: [
      {
        id: "settings-profile",
        screen: "settings",
        target: "settings-profile",
        action: "tap",
        title: "Edit your profile",
        detail: "Profile edits open inline and save only the fields you actually changed.",
        holdMs: 1800,
      },
      {
        id: "settings-save",
        screen: "settings",
        target: "profile-save",
        action: "tap",
        title: "Save the changes",
        detail: "A change to PAN, GSTIN or address sends the account back for re-verification.",
        holdMs: 2100,
      },
      {
        id: "settings-bank",
        screen: "settings",
        target: "settings-bank",
        action: "tap",
        title: "Add the payout account",
        detail: "Only the masked tail of the account number is stored after you save it.",
        holdMs: 2000,
      },
      {
        id: "settings-notify",
        screen: "settings",
        target: "settings-notify",
        action: "tap",
        title: "Choose your alerts",
        detail: "New-order and SLA alerts are live; each toggle is saved to your seller account.",
        holdMs: 2000,
      },
      {
        id: "settings-theme",
        screen: "settings",
        target: "settings-theme",
        action: "tap",
        title: "Match the theme",
        detail:
          "Appearance follows the browser's light or dark preference and stays on this device.",
        holdMs: 1900,
      },
      {
        id: "settings-subusers",
        screen: "settings",
        target: "settings-subusers",
        action: "tap",
        title: "Invite your team",
        detail: "Staff and Viewer logins are scoped to your seller; only the owner manages them.",
        holdMs: 2000,
      },
      {
        id: "settings-invite",
        screen: "settings",
        target: "invite-link",
        action: "tap",
        title: "Copy the one-time link",
        detail:
          "The invite link is valid for seven days and is shared by you — no email is sent yet.",
        holdMs: 2200,
      },
      {
        id: "settings-security",
        screen: "settings",
        target: "settings-security",
        action: "tap",
        title: "Rotate your sign-in",
        detail: "Change your email or password here; every other session is signed out.",
        holdMs: 2100,
      },
    ],
  },
  {
    id: "more",
    title: "The rest of the console",
    subtitle: "Home, Explore, ads, analytics, reviews and the honest local-only tools.",
    steps: [
      {
        id: "more-hub",
        screen: "hub",
        target: "hub-checklist",
        action: "tap",
        title: "Work the daily checklist",
        detail: "Home gathers the day's tasks; the checklist itself is local-only for now.",
        holdMs: 2000,
      },
      {
        id: "more-explore",
        screen: "explore",
        target: "explore-grid",
        action: "tap",
        title: "Find any surface in Explore",
        detail: "Explore is the map of the console: orders, stock, ads, payments and settings.",
        holdMs: 1900,
      },
      {
        id: "more-ads",
        screen: "ads",
        target: "ad-campaign",
        action: "tap",
        title: "Run an ad campaign",
        detail: "Ads creates slot-based campaigns for the store; there is no tracking pixel.",
        holdMs: 2000,
      },
      {
        id: "more-analytics",
        screen: "analytics",
        target: "analytics-series",
        action: "tap",
        title: "Read your sales series",
        detail: "Analytics charts orders and sales for the range you pick.",
        holdMs: 2100,
      },
      {
        id: "more-reviews",
        screen: "reviews",
        target: "review-row",
        action: "tap",
        title: "Read your reviews",
        detail: "Reviews lists customer ratings for the store; it is read-only today.",
        holdMs: 2100,
      },
      {
        id: "more-prescriptions",
        screen: "prescriptions",
        target: "rx-row",
        action: "tap",
        title: "Open a prescription",
        detail: "Pharmacy stores receive prescription requests here and send a quote back.",
        holdMs: 2100,
      },
      {
        id: "more-outlet",
        screen: "outlet-info",
        target: "outlet-hours",
        action: "type",
        title: "Update outlet hours",
        detail: "Outlet info keeps the shop's hours and contact details current.",
        holdMs: 2000,
      },
      {
        id: "more-status",
        screen: "restaurant-status",
        target: "status-toggle",
        action: "tap",
        title: "Restaurant status — local today",
        detail:
          "The accepting-orders switch is client-local in this release; it is not saved to your account.",
        holdMs: 2300,
      },
      {
        id: "more-rush",
        screen: "rush-hour",
        target: "rush-window",
        action: "type",
        title: "Rush hour — local today",
        detail: "The prep window is client-local in this release; it is not saved to your account.",
        holdMs: 2200,
      },
      {
        id: "more-support",
        screen: "support",
        target: "support-new",
        action: "tap",
        title: "Support — local today",
        detail:
          "New support tickets stay on this device in this release; they are not sent to Faazio yet.",
        holdMs: 2300,
      },
      {
        id: "more-invite",
        screen: "invite-accept",
        target: "accept-submit",
        action: "tap",
        title: "A teammate accepts the invite",
        detail: "The invitee opens the link, chooses a password and signs in with their own email.",
        holdMs: 2200,
      },
    ],
  },
];
