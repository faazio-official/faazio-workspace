/**
 * Full seller-journey walkthrough script for `/help-centre`.
 *
 * Chapter 1 reuses `SELLER_TOUR_STEPS` from `seller-onboarding.ts` unchanged so
 * the application walkthrough stays pinned to
 * `docs/user-interaction-workflow/seller/onboarding/`. The remaining chapters
 * mirror the shipped seller portal flows; every action maps to a real route or
 * endpoint in `docs/user-interaction-workflow/seller/` (the audit map lives in
 * that folder's `help-centre.md`).
 *
 * Chapters 2+ replay the seller portal's own mobile-web pages, because the
 * seller app is a WebView over that portal. Step targets therefore name the
 * real console element the action lands on (`Add` in the products header, the
 * `Continue` rail of the listing wizard, `Accept order` in the fixed bar), and
 * the screens in `screens-journey.tsx` draw those pages. `control` names the
 * exact visible label the animation presses, so the stage always says which
 * button is being used.
 *
 * The walkthrough is illustrative: the stage is decorative and submits nothing.
 * Keep it in step with the workflow docs; if a seller flow changes, change this
 * file in the same PR.
 */

import { SELLER_TOUR_STEPS, type SellerTourScreen } from "./seller-onboarding";

export type SellerJourneyScreen =
  | SellerTourScreen
  | "store-login"
  | "store-orders"
  | "store-products"
  | "store"
  | "store-create"
  | "store-switcher"
  | "catalog-list"
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
  | "orders-reject"
  | "order-history"
  | "pickup-qr"
  | "notifications"
  | "payouts"
  | "settings"
  | "returns"
  | "ads"
  | "ads-wizard"
  | "analytics"
  | "reviews"
  | "prescriptions"
  | "rx-detail"
  | "explore"
  | "hub"
  | "outlet-info"
  | "restaurant-status"
  | "status-offline"
  | "rush-hour"
  | "support"
  | "fee-request"
  | "invite-accept";

export type SellerJourneyAction = "tap" | "type" | "scan" | "swipe";

export type SellerJourneyStep = {
  /** Stable anchor id, also used as the React key (`#step-<id>`). */
  id: string;
  screen: SellerJourneyScreen;
  /** Must match a `data-tour-target` in the matching screen. */
  target: string;
  action: SellerJourneyAction;
  /**
   * The exact visible label the step presses (a button, tab, row or field).
   * Rendered in the on-stage callout and read out in the caption, so the
   * animation never leaves the viewer guessing which control it used.
   */
  control: string;
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
    subtitle: "From the app's first paint to a second shop, exactly as the console does it.",
    steps: [
      {
        id: "store-open-app",
        screen: "store-login",
        target: "store-login",
        action: "tap",
        control: "Sign in",
        title: "Open the Faazio Seller Partner app",
        detail:
          "The seller app is a web shell over the portal, so its first paint is Faazio's sign-in. Use the seller email and password a superadmin issued when your application was approved.",
        holdMs: 2200,
      },
      {
        id: "store-orders",
        screen: "store-orders",
        target: "store-orders",
        action: "tap",
        control: "Your shop",
        title: "Land on Orders",
        detail:
          "Signing in drops you on Orders. The shop-name bar at the top left is your switcher; the Online chip beside it only opens the outlet status. A brand-new account has no shop yet.",
        holdMs: 1900,
      },
      {
        id: "store-create-first",
        screen: "store-products",
        target: "store-create-shop",
        action: "tap",
        control: "Create a shop",
        title: "Create your first shop",
        detail:
          "Products → List a new product explains that a listing belongs to a shop, and its Create a shop button opens the vendor form.",
        holdMs: 2100,
      },
      {
        id: "store-create",
        screen: "store-create",
        target: "new-store",
        action: "tap",
        control: "Add a vendor",
        title: "Open Add a vendor",
        detail:
          "Add a vendor is the create form. A vendor is one shop in one app, and your account can own several.",
        holdMs: 1900,
      },
      {
        id: "store-details",
        screen: "store-create",
        target: "store-name",
        action: "type",
        control: "Vendor name",
        title: "Name, address and contact",
        detail:
          "Pick the app the shop sells in, then add its state, address, phone and opening hours. Publish now makes it live immediately.",
        holdMs: 2300,
      },
      {
        id: "store-licence",
        screen: "store-create",
        target: "store-licence",
        action: "type",
        control: "FSSAI number",
        title: "Add the shop's licence",
        detail:
          "Food shops record FSSAI details; pharmacy shops record a drug licence. Both are optional here and can be added later.",
        holdMs: 2000,
      },
      {
        id: "store-submit",
        screen: "store-create",
        target: "store-save",
        action: "tap",
        control: "Create vendor",
        title: "Create the vendor",
        detail:
          "Create vendor saves the shop and makes it the active vendor. Flip it live from Stores whenever the outlet is ready.",
        holdMs: 2200,
      },
      {
        id: "store-list",
        screen: "store",
        target: "store-list",
        action: "tap",
        control: "Sharma Mart",
        title: "Your shop is in Stores",
        detail:
          "Stores lists every vendor you own with its live switch, veg mark and opening hours. Each card saves its own profile.",
        holdMs: 1900,
      },
      {
        id: "store-add-another",
        screen: "store",
        target: "store-add",
        action: "tap",
        control: "Add shop",
        title: "Add another shop",
        detail:
          "The Add shop button in the Stores header opens the same form, so a second vendor is one tap away — one shop in one app.",
        holdMs: 2000,
      },
      {
        id: "store-switcher",
        screen: "store-switcher",
        target: "store-switcher-list",
        action: "tap",
        control: "Sharma Kitchen",
        title: "Switch between your shops",
        detail:
          "Your shop name in any console header opens the switcher. Picking a shop re-scopes products, orders and payouts to it.",
        holdMs: 2400,
      },
    ],
  },
  {
    id: "catalog-add",
    title: "Add a product",
    subtitle: "The five-step listing wizard, from Add to Pending review.",
    steps: [
      {
        id: "product-open",
        screen: "catalog-list",
        target: "product-add",
        action: "tap",
        control: "Add",
        title: "Open Products and tap Add",
        detail:
          "Products (Catalog) lists your listings with search and filters. Add opens the wizard; Trash sits beside it.",
        holdMs: 1900,
      },
      {
        id: "product-store",
        screen: "catalog-add",
        target: "product-store",
        action: "tap",
        control: "Store",
        title: "Choose the store",
        detail:
          "A listing belongs to one store, so the wizard starts there. The store's sector is fixed by your registration and decides the category list.",
        holdMs: 2000,
      },
      {
        id: "product-category",
        screen: "catalog-add",
        target: "product-category",
        action: "tap",
        control: "Category",
        title: "Pick the category leaf",
        detail:
          "Category is the app-scoped taxonomy leaf the home rail and category drill-in read. No leaves means an admin has not configured that app yet.",
        holdMs: 2100,
      },
      {
        id: "product-gst",
        screen: "catalog-add",
        target: "product-gst",
        action: "tap",
        control: "GST category",
        title: "Confirm the GST category",
        detail:
          "The matching tax bucket is pre-selected from the category name; change it only when the item really needs another rate.",
        holdMs: 1900,
      },
      {
        id: "product-name",
        screen: "catalog-add",
        target: "product-name",
        action: "type",
        control: "Product name",
        title: "Name, description and unit",
        detail:
          "Name, description and unit are what the customer reads. The wizard will not continue without them plus at least one photo.",
        holdMs: 2200,
      },
      {
        id: "product-image",
        screen: "catalog-add",
        target: "product-image",
        action: "tap",
        control: "Add photo",
        title: "Add a photo",
        detail:
          "Photos go through the media pipeline (upload URL → PUT → confirm). A listing with no photo cannot go live.",
        holdMs: 2000,
      },
      {
        id: "product-price",
        screen: "catalog-add",
        target: "product-price",
        action: "type",
        control: "Selling price",
        title: "Set the selling price",
        detail:
          "The price is GST-inclusive. The card previews what you keep per unit: product GST, platform fee, GST on that fee, TCS 1% and TDS 0.1%.",
        holdMs: 2400,
      },
      {
        id: "product-stock",
        screen: "catalog-add",
        target: "product-stock",
        action: "type",
        control: "Stock quantity",
        title: "Stock quantity",
        detail:
          "Enter the units you have. The delivery ETA is platform-owned — 30 minutes by default.",
        holdMs: 2000,
      },
      {
        id: "product-review",
        screen: "catalog-add",
        target: "product-review",
        action: "tap",
        control: "Review",
        title: "Review the listing",
        detail:
          "Review repeats every field and the payout split, with the status it will carry: PENDING_REVIEW.",
        holdMs: 2300,
      },
      {
        id: "product-submit",
        screen: "catalog-add",
        target: "product-submit",
        action: "tap",
        control: "Submit for review",
        title: "Submit for review",
        detail:
          "Submitting creates the listing and its stock row as Pending review. Nothing is visible to shoppers until a district admin approves it.",
        holdMs: 2400,
      },
      {
        id: "product-pending",
        screen: "catalog-list",
        target: "product-pending",
        action: "tap",
        control: "Toor dal 1 kg",
        title: "It waits in the list as Pending review",
        detail:
          "Back on Products the new row shows the PENDING REVIEW pill. A rejected listing shows the admin's reason on the row itself.",
        holdMs: 2400,
      },
    ],
  },
  {
    id: "catalog-maintain",
    title: "Maintain your catalog",
    subtitle: "Fix a listing's details, delete it, and restore it from Trash.",
    steps: [
      {
        id: "catalog-open",
        screen: "catalog-list",
        target: "catalog-row",
        action: "tap",
        control: "Amul butter 500 g",
        title: "Open a listing",
        detail: "Each row opens Edit product with the listing already loaded.",
        holdMs: 1800,
      },
      {
        id: "catalog-edit",
        screen: "catalog-edit",
        target: "edit-description",
        action: "type",
        control: "Description",
        title: "Fix the description",
        detail:
          "Photos, name, description and price save together. GST comes from the platform category master, not from you.",
        holdMs: 2100,
      },
      {
        id: "catalog-save",
        screen: "catalog-edit",
        target: "edit-save",
        action: "tap",
        control: "Save changes",
        title: "Save changes",
        detail: "Save writes the listing; edits to a live listing stay visible while they save.",
        holdMs: 2000,
      },
      {
        id: "catalog-delete",
        screen: "catalog-edit",
        target: "delete-listing",
        action: "tap",
        control: "Delete",
        title: "Delete a listing",
        detail:
          "Delete sits beside Save in the fixed bar. It hides the item from shoppers immediately and writes the action to the audit log.",
        holdMs: 2100,
      },
      {
        id: "catalog-confirm",
        screen: "catalog-edit",
        target: "delete-confirm",
        action: "tap",
        control: "Delete",
        title: "Confirm — it moves to Trash",
        detail:
          "The confirm sheet spells out the trade: gone from the app now, restorable for 7 days, then permanently removed.",
        holdMs: 2200,
      },
      {
        id: "catalog-restore",
        screen: "catalog-trash",
        target: "restore-listing",
        action: "tap",
        control: "Restore listing",
        title: "Restore it from Trash",
        detail:
          "Trash lists deleted listings with the days left before purge. Restore brings the listing back in one tap.",
        holdMs: 2300,
      },
    ],
  },
  {
    id: "catalog-price-stock",
    title: "Reprice and restock",
    subtitle: "Bulk price cuts on Pricing, stock switches on Inventory.",
    steps: [
      {
        id: "catalog-price",
        screen: "pricing",
        target: "price-input",
        action: "type",
        control: "Mass cut %",
        title: "Change the price",
        detail:
          "Pricing lists each product with its own price field and a bar against your median. The header's mass cut applies a % to every product at once.",
        holdMs: 2200,
      },
      {
        id: "catalog-stock",
        screen: "inventory",
        target: "stock-toggle",
        action: "tap",
        control: "Basmati rice 5 kg",
        title: "Restock from Inventory",
        detail:
          "Stock groups this shop's items by category. Turning an item back on writes 10 units and a 30-minute restock ETA; turning it off asks when it returns.",
        holdMs: 2300,
      },
    ],
  },

  {
    id: "menus-offers-addons",
    title: "Menus, offers and add-ons",
    subtitle: "Food dishes, festival discounts and order extras.",
    steps: [
      {
        id: "menu-add",
        screen: "menus",
        target: "menu-add",
        action: "tap",
        control: "Add dish",
        title: "Add a dish",
        detail:
          "A Food shop authors dishes in Menu; Mart and Pharmacy shops get the same surface with items instead. Add dish opens the editor sheet.",
        holdMs: 1900,
      },
      {
        id: "menu-dish",
        screen: "menus",
        target: "menu-dish",
        action: "tap",
        control: "Chicken biryani",
        title: "Open an existing dish",
        detail:
          "Each card carries the veg mark, cuisine, dish id, price and status — with Submit, Delist and Edit underneath.",
        holdMs: 1900,
      },
      {
        id: "menu-price",
        screen: "menus",
        target: "menu-price",
        action: "type",
        control: "MRP (₹, optional)",
        title: "Price and MRP",
        detail:
          "A blank MRP means no strike-through offer; an MRP below the selling price is rejected with a toast.",
        holdMs: 2200,
      },
      {
        id: "offer-campaign",
        screen: "offers",
        target: "offer-campaign",
        action: "tap",
        control: "Pongal festival",
        title: "Pick the live campaign",
        detail:
          "Offers (Growth) lists products first, then joins a district festival campaign. The picker shows its dates, scope and LIVE/SCHEDULED state.",
        holdMs: 2100,
      },
      {
        id: "offer-percent",
        screen: "offers",
        target: "offer-percent",
        action: "type",
        control: "Your discount (%)",
        title: "Enter the discount",
        detail:
          "Use a whole percent inside the sector cap shown above. The opt-in is rejected above the cap rather than silently trimmed.",
        holdMs: 2200,
      },
      {
        id: "offer-optin",
        screen: "offers",
        target: "offer-optin",
        action: "tap",
        control: "Opt in",
        title: "Opt in",
        detail:
          "Opting in returns the product to PENDING until a district admin approves it; only then does the live price change.",
        holdMs: 2200,
      },
      {
        id: "addon-create",
        screen: "addons",
        target: "addon-create",
        action: "tap",
        control: "Create",
        title: "Create an add-on",
        detail:
          "Inventory → Add-ons holds the extras customers can attach to a dish. New add-ons start as DRAFT.",
        holdMs: 2000,
      },
      {
        id: "addon-link",
        screen: "addons",
        target: "addon-link",
        action: "tap",
        control: "Add add-on",
        title: "Link it to a dish",
        detail:
          "Add-ons per dish lists each dish with its linked extras and a toggle per link, so linking never changes the add-on's own status.",
        holdMs: 2100,
      },
      {
        id: "addon-submit",
        screen: "addons",
        target: "addon-submit",
        action: "tap",
        control: "Submit for review",
        title: "Submit for review",
        detail: "An admin must approve the add-on before customers can see and order it.",
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
        target: "order-tab-new",
        action: "tap",
        control: "Preparing",
        title: "The order board",
        detail:
          "Orders groups work into Preparing / Ready / Out for delivery / Delivered for a Food shop — New / Packed / Shipped / Delivered elsewhere. Counts sit on the tabs.",
        holdMs: 2100,
      },
      {
        id: "orders-open",
        screen: "orders-board",
        target: "order-card",
        action: "tap",
        control: "#FAZ10428",
        title: "Open a new order",
        detail:
          "Each card shows the sector, order id, customer, item count, total and the SLA countdown.",
        holdMs: 1900,
      },
      {
        id: "orders-accept",
        screen: "orders-detail",
        target: "order-accept",
        action: "tap",
        control: "Accept order",
        title: "Accept the order",
        detail:
          "Accept order moves NEW to PACKED and dispatches a rider. An unpaid order is blocked with a 409.",
        holdMs: 2200,
      },
      {
        id: "orders-qr",
        screen: "orders-board",
        target: "order-qr",
        action: "tap",
        control: "Pickup QR",
        title: "Show the pickup QR",
        detail:
          "A packed order gets a Pickup QR button on its card. The rider scans the code at handover.",
        holdMs: 2000,
      },
      {
        id: "orders-scan",
        screen: "pickup-qr",
        target: "qr-code",
        action: "scan",
        control: "QR code",
        title: "The rider scans it",
        detail:
          "The scan completes the pickup. The code is short-lived, so a stale QR is refused at the door.",
        holdMs: 2200,
      },
      {
        id: "orders-advance",
        screen: "orders-detail",
        target: "order-advance",
        action: "tap",
        control: "Mark delivered",
        title: "Handed over, then delivered",
        detail:
          "The fixed bar advances the flow: Handed over (PACKED → SHIPPED), then Mark delivered. The timeline marks each stage.",
        holdMs: 2200,
      },
      {
        id: "orders-reject",
        screen: "orders-board",
        target: "order-reject",
        action: "tap",
        control: "Reject",
        title: "Reject if you can't fulfil",
        detail:
          "Rejecting a new order asks for a reason from the sector's list and refunds a captured payment.",
        holdMs: 2300,
      },
      {
        id: "orders-returns",
        screen: "returns",
        target: "return-row",
        action: "tap",
        control: "Reject",
        title: "Handle a return",
        detail:
          "Returns and cancellations land in Returns; a returned order can be rejected back to delivered or approved to queue the refund.",
        holdMs: 2200,
      },
    ],
  },
  {
    id: "order-print-history",
    title: "Print, search and reject",
    subtitle: "The kitchen ticket, the archive, and rejecting with a reason.",
    steps: [
      {
        id: "order-print",
        screen: "orders-detail",
        target: "order-print",
        action: "tap",
        control: "Print KOT",
        title: "Print the kitchen ticket",
        detail:
          "The printer in the order header prints the kitchen order ticket for a Food shop — the same button reads Print for Mart and Pharmacy orders. It prints the order as it stands; it never changes its status.",
        holdMs: 2300,
      },
      {
        id: "history-open",
        screen: "order-history",
        target: "history-search",
        action: "type",
        control: "Search by order ID",
        title: "Search the archive",
        detail:
          "Order history lists every order newest first and searches by order id or customer name; the digits are matched, so typing 10425 finds #FAZ10425.",
        holdMs: 2300,
      },
      {
        id: "history-range",
        screen: "order-history",
        target: "history-range",
        action: "tap",
        control: "Last 7 days",
        title: "Narrow the date range",
        detail:
          "The range row shows the active window and the order count under it. Tapping it opens the range sheet.",
        holdMs: 2200,
      },
      {
        id: "history-range-pick",
        screen: "order-history",
        target: "history-range-sheet",
        action: "tap",
        control: "Last 30 days",
        title: "Pick the window",
        detail:
          "Last 7 days, Last 30 days or All time. The list re-filters immediately; an empty range says No orders found in this range.",
        holdMs: 2400,
      },
      {
        id: "order-reject-reason",
        screen: "orders-reject",
        target: "reject-reason",
        action: "tap",
        control: "Items out of stock",
        title: "Reject with a sector reason",
        detail:
          "Reject opens a reason sheet. A Food shop picks from Items out of stock, Kitchen is full, Restaurant closing soon, Customer requested, Other; Mart and Pharmacy get their own list, so a kitchen excuse never reaches a pharmacy order.",
        holdMs: 2500,
      },
      {
        id: "order-reject-confirm",
        screen: "orders-reject",
        target: "reject-confirm",
        action: "tap",
        control: "Reject order",
        title: "Confirm the rejection",
        detail:
          "Reject order moves the order to CANCELLED, refunds a captured payment and notifies the customer and the rider. The reason is stored on the order and in the audit log.",
        holdMs: 2500,
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
        screen: "hub",
        target: "notif-bell",
        action: "tap",
        control: "Bell",
        title: "Open the bell",
        detail:
          "The bell in the console header opens your notifications; the page repeats the unread count as its sub-line.",
        holdMs: 1900,
      },
      {
        id: "notif-row",
        screen: "notifications",
        target: "notif-row",
        action: "tap",
        control: "#FAZ10429",
        title: "Open the newest alert",
        detail:
          "Rows are newest first and an unread row is tinted. Opening one marks it read through the gateway.",
        holdMs: 2100,
      },
      {
        id: "notif-deeplink",
        screen: "notifications",
        target: "notif-deeplink",
        action: "tap",
        control: "Basmati rice 5 kg was approved",
        title: "Follow the deep link",
        detail:
          "An alert links to its order, product or prescription — from its payload, else from its kind.",
        holdMs: 2100,
      },
      {
        id: "notif-readall",
        screen: "notifications",
        target: "notif-readall",
        action: "tap",
        control: "Mark all read",
        title: "Mark everything read",
        detail: "Mark all read clears the count and is disabled when nothing is unread.",
        holdMs: 2100,
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
        target: "payout-tab",
        action: "tap",
        control: "Payouts",
        title: "Open Payments",
        detail:
          "Payments has two tabs: Payouts and Invoices & Taxes. The Payouts tab opens on the all-time settlement card.",
        holdMs: 1900,
      },
      {
        id: "payout-ledger",
        screen: "payouts",
        target: "payout-ledger",
        action: "tap",
        control: "Gross order value",
        title: "Read the ledger",
        detail:
          "Every figure is derived from delivered orders — gross order value, commission, product GST, TCS 1% and TDS 0.1% down to the net payout.",
        holdMs: 2300,
      },
      {
        id: "payout-cycle",
        screen: "payouts",
        target: "payout-cycle",
        action: "tap",
        control: "Get report",
        title: "Pick the cycle",
        detail:
          "Cycles are the settlement weeks. Picking one re-scopes the ledger cards and the Get report action.",
        holdMs: 2000,
      },
      {
        id: "payout-invoice",
        screen: "payouts",
        target: "payout-invoice",
        action: "tap",
        control: "Payout invoice",
        title: "Get the invoice",
        detail:
          "A PAID payout carries its own settlement invoice, downloaded as a seller-scoped JSON document; the PDF may lag behind it.",
        holdMs: 2200,
      },
      {
        id: "payout-status",
        screen: "payouts",
        target: "payout-status",
        action: "tap",
        control: "Paid",
        title: "Payouts are marked by hand",
        detail:
          "There is no automatic transfer today: an admin marks the payout PAID after the bank transfer, and a part-paid one shows PARTIAL with a balance.",
        holdMs: 2400,
      },
    ],
  },
  {
    id: "settings",
    title: "Your business profile",
    subtitle: "The business details KYC was checked against.",
    steps: [
      {
        id: "settings-profile",
        screen: "settings",
        target: "settings-profile",
        action: "tap",
        control: "Profile",
        title: "Edit your profile",
        detail:
          "Settings tabs run Profile · Bank · Notifications · Appearance · Sub-users · Security. Profile shows the business details KYC was checked against.",
        holdMs: 2000,
      },
      {
        id: "settings-save",
        screen: "settings",
        target: "profile-save",
        action: "tap",
        control: "Save changes",
        title: "Save the changes",
        detail:
          "Only the fields you changed are sent. A change to PAN, GSTIN or the registered address sends the account back for re-verification.",
        holdMs: 2200,
      },
    ],
  },
  {
    id: "settings-bank",
    title: "Bank, alerts and appearance",
    subtitle: "Where payouts land, what reaches you, and the theme you read in.",
    steps: [
      {
        id: "settings-bank",
        screen: "settings",
        target: "settings-bank",
        action: "tap",
        control: "Bank",
        title: "Add the payout account",
        detail:
          "Beneficiary, account number and an 11-character IFSC. Only the masked tail of the account number is stored after you save.",
        holdMs: 2100,
      },
      {
        id: "settings-notify",
        screen: "settings",
        target: "settings-notify",
        action: "tap",
        control: "Notifications",
        title: "Choose your alerts",
        detail:
          "New order, low stock, SLA breach and festival campaign alerts each save to your seller account as you toggle them.",
        holdMs: 2100,
      },
      {
        id: "settings-theme",
        screen: "settings",
        target: "settings-theme",
        action: "tap",
        control: "Appearance",
        title: "Match the theme",
        detail:
          "Appearance follows the browser's light or dark preference and stays on this device.",
        holdMs: 2000,
      },
    ],
  },
  {
    id: "settings-team",
    title: "Your team",
    subtitle: "Invite staff, reissue a link, and revoke access.",
    steps: [
      {
        id: "settings-subusers",
        screen: "settings",
        target: "settings-subusers",
        action: "tap",
        control: "Sub-users",
        title: "Invite your team",
        detail:
          "Staff can run the console; Viewers are read-only. Only the owner manages the team, bank and business profile.",
        holdMs: 2100,
      },
      {
        id: "settings-invite",
        screen: "settings",
        target: "invite-link",
        action: "tap",
        control: "Create invite link",
        title: "Copy the one-time link",
        detail:
          "Create invite link returns an accept URL you share yourself — no email is sent yet. It works once and expires in 7 days.",
        holdMs: 2300,
      },
      {
        id: "settings-resend",
        screen: "settings",
        target: "subuser-resend",
        action: "tap",
        control: "New link",
        title: "Issue a fresh invite",
        detail:
          "An unaccepted invite shows New link and Remove. New link mints another single-use token; the previous one stops working.",
        holdMs: 2300,
      },
      {
        id: "settings-remove",
        screen: "settings",
        target: "subuser-remove",
        action: "tap",
        control: "Remove",
        title: "Remove a teammate",
        detail:
          "Remove revokes the sub-user's access at once; their session stops working on the next request. An owner cannot remove themselves.",
        holdMs: 2300,
      },
      {
        id: "settings-invite-accept",
        screen: "invite-accept",
        target: "accept-submit",
        action: "tap",
        control: "Set password & activate",
        title: "A teammate accepts the invite",
        detail:
          "The invitee opens the link, chooses a password of at least 12 characters and signs in with their own email.",
        holdMs: 2300,
      },
    ],
  },
  {
    id: "settings-signin",
    title: "Sign-in and security",
    subtitle: "The email and password that open the console.",
    steps: [
      {
        id: "settings-security",
        screen: "settings",
        target: "settings-security",
        action: "tap",
        control: "Security",
        title: "Rotate your sign-in",
        detail:
          "Security holds the two self-service credentials: the portal email and the password. Either change signs every other session out.",
        holdMs: 2200,
      },
      {
        id: "settings-email",
        screen: "settings",
        target: "settings-email",
        action: "tap",
        control: "Change email",
        title: "Change the sign-in email",
        detail:
          "Change email opens a sheet that asks for the new address and your current password. The old address stops working the moment it saves.",
        holdMs: 2300,
      },
      {
        id: "settings-email-save",
        screen: "settings",
        target: "email-save",
        action: "tap",
        control: "Save email",
        title: "Confirm with your password",
        detail:
          "Save email re-authenticates with the current password, writes the new address and keeps this device signed in while every other session ends.",
        holdMs: 2400,
      },
      {
        id: "settings-password",
        screen: "settings",
        target: "settings-password",
        action: "tap",
        control: "Change password",
        title: "Change the password",
        detail:
          "The password form needs the current password plus a new one of at least 12 characters; the console rejects a new password that matches the old one.",
        holdMs: 2300,
      },
    ],
  },
  {
    id: "ads",
    title: "Run a hero campaign",
    subtitle: "The five-step ad wizard, from What to Publish now.",
    steps: [
      {
        id: "ad-open",
        screen: "ads",
        target: "ad-new",
        action: "tap",
        control: "New hero campaign",
        title: "Start a campaign",
        detail:
          "Ads leads with impressions, clicks, CTR and attributed orders, then the New hero campaign wizard. Placements are slots in the customer app — there is no tracking pixel.",
        holdMs: 2300,
      },
      {
        id: "ad-target",
        screen: "ads-wizard",
        target: "ad-target",
        action: "tap",
        control: "Products",
        title: "What you promote",
        detail:
          "Pick the tab — Products, Dishes or Stores — then choose one of your own items. An item you do not own is refused when you publish.",
        holdMs: 2400,
      },
      {
        id: "ad-where",
        screen: "ads-wizard",
        target: "ad-where",
        action: "tap",
        control: "Home hero",
        title: "Where it shows",
        detail:
          "Each allowed placement lists its reach. The list is filtered by the target: a dish cannot take a Mart-only slot. A category placement must also pick its category page.",
        holdMs: 2400,
      },
      {
        id: "ad-creative",
        screen: "ads-wizard",
        target: "ad-creative",
        action: "type",
        control: "Title (max 40)",
        title: "Creative and CTA",
        detail:
          "A 40-character title, a 60-character subtitle, a 16:9 poster uploaded to Faazio (external links are rejected) and one call to action. The phone preview shows the scrim the title sits on.",
        holdMs: 2600,
      },
      {
        id: "ad-when",
        screen: "ads-wizard",
        target: "ad-when",
        action: "tap",
        control: "Starts",
        title: "When it runs",
        detail:
          "A start date and an end date that defaults to +30 days and can never exceed 90. Position inside a placement is by relevance and recency, not by bid.",
        holdMs: 2400,
      },
      {
        id: "ad-publish",
        screen: "ads-wizard",
        target: "ad-publish",
        action: "tap",
        control: "Publish now",
        title: "Review, then publish",
        detail:
          "Review repeats the target, placements, CTA and window with the status LIVE. Publish now is machine-checked (owner, placement fit, poster, length, caps) and goes live instantly — no admin approval.",
        holdMs: 2600,
      },
    ],
  },
  {
    id: "prescriptions",
    title: "Fill a prescription",
    subtitle: "Pharmacy only: the scans, the quote and the audited reveal.",
    steps: [
      {
        id: "rx-open",
        screen: "prescriptions",
        target: "rx-row",
        action: "tap",
        control: "RX-88214",
        title: "Open a routed prescription",
        detail:
          "Prescriptions lists only the requests routed to this pharmacy store, with its RX id, the customer, fulfilment kind, page count and status. Opening one shows the patient note and the quote builder.",
        holdMs: 2400,
      },
      {
        id: "rx-images",
        screen: "rx-detail",
        target: "rx-images",
        action: "tap",
        control: "View images",
        title: "Read the scan",
        detail:
          "View images resolves the private Storage keys into short-lived URLs. The scans belong to this store alone; with Storage unconfigured the console says so instead of showing a broken image.",
        holdMs: 2500,
      },
      {
        id: "rx-quote",
        screen: "rx-detail",
        target: "rx-quote",
        action: "type",
        control: "Item name",
        title: "Build the quote",
        detail:
          "Add item appends a row with name, quantity, MRP, price and discount — up to 50 rows. The total under the rows recomputes as you type.",
        holdMs: 2600,
      },
      {
        id: "rx-save-quote",
        screen: "rx-detail",
        target: "rx-save-quote",
        action: "tap",
        control: "Save quote",
        title: "Save the quote",
        detail:
          "Save quote writes the priced rows and moves the request to QUOTED. With no priced row it refuses rather than saving an empty quote.",
        holdMs: 2500,
      },
      {
        id: "rx-mark-ready",
        screen: "rx-detail",
        target: "rx-mark-ready",
        action: "tap",
        control: "Mark READY",
        title: "Mark it READY",
        detail:
          "Mark READY is disabled until the quote totals more than zero. Marking it ready is what surfaces the quote and the pickup or delivery instruction to the customer.",
        holdMs: 2500,
      },
      {
        id: "rx-pii",
        screen: "rx-detail",
        target: "rx-pii",
        action: "tap",
        control: "PII revealed (audited)",
        title: "Contact details, audited",
        detail:
          "The customer's phone and address appear only once the request is READY or FULFILLED, and the reveal is stamped with its time and written to the audit trail. Prescription details never reach the logs.",
        holdMs: 2800,
      },
    ],
  },
  {
    id: "platform-fee",
    title: "Ask for a fee change",
    subtitle: "The per-store platform fee, and who approves a change.",
    steps: [
      {
        id: "fee-entry",
        screen: "account",
        target: "fee-request-entry",
        action: "tap",
        control: "Request a fee change",
        title: "Find the request in the app",
        detail:
          "A signed-in seller sees Request a fee change on the You page, below the account rows. It is the only place a seller can ask for a different platform fee.",
        holdMs: 2400,
      },
      {
        id: "fee-current",
        screen: "fee-request",
        target: "fee-current",
        action: "tap",
        control: "Platform fee",
        title: "See the fee in force",
        detail:
          "The screen opens on the store's current platform fee, read from the store record. A request already waiting shows as pending review under it.",
        holdMs: 2400,
      },
      {
        id: "fee-amount",
        screen: "fee-request",
        target: "fee-amount",
        action: "type",
        control: "Requested fee %",
        title: "Type the fee you want",
        detail:
          "One whole percent, and it must differ from the fee in force — an identical value is refused before anything is sent.",
        holdMs: 2500,
      },
      {
        id: "fee-reason",
        screen: "fee-request",
        target: "fee-reason",
        action: "type",
        control: "Why should the fee change?",
        title: "Say why",
        detail:
          "The reason is what the reviewer reads. It is stored with the request and shown on the admin's fee-change board.",
        holdMs: 2500,
      },
      {
        id: "fee-submit",
        screen: "fee-request",
        target: "fee-submit",
        action: "tap",
        control: "Submit request",
        title: "Submit the request",
        detail:
          "Submit request creates one PENDING request for this store and says an admin will review it. Only one request per store can be pending, so a second submit is refused.",
        holdMs: 2600,
      },
      {
        id: "fee-history",
        screen: "fee-request",
        target: "fee-history",
        action: "tap",
        control: "Request history",
        title: "Track it, and who decides",
        detail:
          "History lists each request as old → requested percent with its status. A district or superadmin approves or rejects it on the Fee change requests board; approval is what rewrites the store's fee.",
        holdMs: 2800,
      },
    ],
  },
  {
    id: "home",
    title: "Home and analytics",
    subtitle: "Today's numbers, the health score, and the series behind them.",
    steps: [
      {
        id: "more-hub-tabs",
        screen: "hub",
        target: "hub-tabs",
        action: "tap",
        control: "Sales",
        title: "Move around Home",
        detail:
          "Home carries five tabs: My Feed, Sales, Funnel, Service quality and Kitchen — a non-food shop sees Operations instead of Kitchen. Each tab re-scopes the cards under it.",
        holdMs: 2300,
      },
      {
        id: "more-hub-range",
        screen: "hub",
        target: "hub-range",
        action: "tap",
        control: "Last 30 days",
        title: "Set the window",
        detail:
          "The range bar states the period and what it compares against. It opens the range sheet, and the cards read the same window.",
        holdMs: 2200,
      },
      {
        id: "more-hub",
        screen: "hub",
        target: "hub-checklist",
        action: "tap",
        control: "Setup checklist",
        title: "Work the daily checklist",
        detail:
          "My Feed opens on today's sales, shop health and the setup checklist. The checklist is local-only for now.",
        holdMs: 2100,
      },
      {
        id: "more-analytics",
        screen: "analytics",
        target: "analytics-series",
        action: "tap",
        control: "GMV (7d)",
        title: "Read your sales series",
        detail:
          "Analytics plots GMV and orders against the previous period, with the status split, category mix, top cities and product performance.",
        holdMs: 2400,
      },
      {
        id: "more-analytics-period",
        screen: "analytics",
        target: "analytics-period",
        action: "tap",
        control: "30d",
        title: "Change the period",
        detail:
          "The 7d / 30d / 90d pills in the header re-query the series, the status split and the ranks together — one control for the whole page.",
        holdMs: 2400,
      },
    ],
  },
  {
    id: "reviews",
    title: "Reviews",
    subtitle: "Read, answer and report — never delete.",
    steps: [
      {
        id: "more-reviews",
        screen: "reviews",
        target: "review-row",
        action: "tap",
        control: "A. Kumar",
        title: "Read your reviews",
        detail:
          "Reviews and Complaints share the header tabs, and the five star pills filter by rating. A review can be answered or flagged — never deleted.",
        holdMs: 2300,
      },
      {
        id: "more-review-reply",
        screen: "reviews",
        target: "review-reply",
        action: "tap",
        control: "Reply",
        title: "Answer in public",
        detail:
          "Reply publishes your answer under the review, where the customer and every shopper can read it. It confirms with a toast and the reply shows on the card.",
        holdMs: 2400,
      },
      {
        id: "more-review-flag",
        screen: "reviews",
        target: "review-flag",
        action: "tap",
        control: "Flag to admin",
        title: "Report a review",
        detail:
          "Flag to admin sends the review to moderation instead of deleting it. The review stays visible until an admin acts on the report.",
        holdMs: 2400,
      },
    ],
  },
  {
    id: "explore-outlet",
    title: "Explore and the outlet card",
    subtitle: "The map of the console, its search, and the shop card behind your avatar.",
    steps: [
      {
        id: "more-explore",
        screen: "explore",
        target: "explore-grid",
        action: "tap",
        control: "Catalog",
        title: "Find any surface in Explore",
        detail:
          "Explore is the map of the console: Overview, Orders, Catalog, Operations and Account, filtered to what your shop's sector can use.",
        holdMs: 2200,
      },
      {
        id: "explore-search",
        screen: "explore",
        target: "explore-search",
        action: "tap",
        control: "Search",
        title: "Search the console",
        detail:
          "The magnifier in the Explore header searches the surface list, so an operator who forgot where a page lives does not have to walk the grids.",
        holdMs: 2200,
      },
      {
        id: "explore-signout",
        screen: "explore",
        target: "explore-signout",
        action: "tap",
        control: "Sign out",
        title: "Sign out when you're done",
        detail:
          "Sign out ends the portal session on this device and returns to /login. The seller app keeps its own screen only while that session is valid.",
        holdMs: 2300,
      },
      {
        id: "more-outlet",
        screen: "outlet-info",
        target: "outlet-hours",
        action: "tap",
        control: "Opening hours",
        title: "Check the outlet profile",
        detail:
          "Outlet info is the read-only shop card behind the header avatar — hours, delivery time, phone — and links out to Stores to edit them.",
        holdMs: 2100,
      },
    ],
  },
  {
    id: "outlet-status",
    title: "Outlet status, delivery and rush",
    subtitle: "Go offline with a reason, tune delivery, and flag a rush.",
    steps: [
      {
        id: "status-toggle",
        screen: "restaurant-status",
        target: "status-toggle",
        action: "tap",
        control: "Delivery status",
        title: "Go offline without closing",
        detail:
          "Delivery status is the outlet switch. Turning it off opens the reason sheet first, so the customer app can say why the shop is quiet instead of just hiding it.",
        holdMs: 2400,
      },
      {
        id: "status-offline-reason",
        screen: "status-offline",
        target: "offline-reason",
        action: "tap",
        control: "Kitchen is full",
        title: "Pick the reason",
        detail:
          "A Food shop chooses from Kitchen is full, Staff shortage, Closing early today, Technical issue, Other; other sectors get their own list.",
        holdMs: 2400,
      },
      {
        id: "status-offline-confirm",
        screen: "status-offline",
        target: "offline-confirm",
        action: "tap",
        control: "Go offline",
        title: "Confirm offline",
        detail:
          "Go offline stops new orders and warns you on the page that customers cannot place orders. The switch, reason and delivery settings are client-local in this release.",
        holdMs: 2500,
      },
      {
        id: "delivery-edit",
        screen: "restaurant-status",
        target: "delivery-edit",
        action: "tap",
        control: "Edit",
        title: "Adjust delivery settings",
        detail:
          "Edit opens minimum order, packaging charge and delivery radius. Save writes them to the console's local store — they are not saved to your account yet.",
        holdMs: 2500,
      },
      {
        id: "rush-window",
        screen: "rush-hour",
        target: "rush-window",
        action: "type",
        control: "30 minutes",
        title: "Say how long the rush lasts",
        detail:
          "Rush in kitchen offers 30 minutes, 1 hour, 2 hours or 3 hours. The window is what the customer app shows as the longer delivery time.",
        holdMs: 2300,
      },
      {
        id: "rush-confirm",
        screen: "rush-hour",
        target: "rush-confirm",
        action: "tap",
        control: "Confirm",
        title: "Turn rush mode on",
        detail:
          "Confirm is client-local in this release: it flips the switch for this device and the Rush hour tile in Explore shows ON. It is not saved to your account.",
        holdMs: 2500,
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    subtitle: "Raise a ticket and follow it.",
    steps: [
      {
        id: "support-new",
        screen: "support",
        target: "support-new",
        action: "type",
        control: "Subject",
        title: "Describe the problem",
        detail:
          "A ticket needs a subject of at least 4 characters and a body of at least 8 before Submit ticket unlocks.",
        holdMs: 2400,
      },
      {
        id: "support-submit",
        screen: "support",
        target: "support-submit",
        action: "tap",
        control: "Submit ticket",
        title: "Submit the ticket",
        detail:
          "Submit ticket adds the ticket to My tickets. Support tickets stay on this device in this release; they are not sent to Faazio yet.",
        holdMs: 2500,
      },
    ],
  },
];
