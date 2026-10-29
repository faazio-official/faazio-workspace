/**
 * Plain-language help copy shown behind the small "i" buttons.
 *
 * Three layers, from broadest to most specific:
 *  - PAGE_HINTS     — one per route (dynamic segments collapsed to ":id"). Explains why the
 *                     page exists, which workflow it is bounded to, and what acting on it changes.
 *  - SECTION_HINTS  — keyed by SectionCard title, so a section written once is explained everywhere.
 *  - METRIC_HINTS   — keyed by KpiCard label, so one line of copy serves every screen showing it.
 *  - COMPONENT_HINTS — keyed by "<pagePath>:<componentId>" for page-scoped controls, or a plain
 *                     global key ("shell:seller-search", "pattern:image-uploader") for controls
 *                     that repeat on every page. A role-specific variant is keyed "<key>@<ROLE>"
 *                     and wins over the generic entry for that role.
 *
 * Every page and component hint tags the app(s) a change reaches, so a user always knows whether
 * they are touching the shopper app, the seller app, the delivery app or just this portal.
 */

import type { Role } from "@/data/types";
import type { Tone } from "@/lib/ui/tones";
import { SELLER_COMPONENT_HINTS } from "@/lib/help/componentHints.seller";
import { DISTRICT_COMPONENT_HINTS } from "@/lib/help/componentHints.district";
import { SUPER_COMPONENT_HINTS } from "@/lib/help/componentHints.super";

/** Which Faazio product a hint's change reaches. */
export type FaazioApp = "consumer" | "seller" | "delivery" | "portal";

export const APP_LABEL: Record<FaazioApp, string> = {
  consumer: "Faazio app",
  seller: "Faazio Seller app",
  delivery: "Faazio Delivery app",
  portal: "Partner Portal",
};

export const APP_TONE: Record<FaazioApp, Tone> = {
  consumer: "primary",
  seller: "grape",
  delivery: "teal",
  portal: "indigo",
};

export interface PageHint {
  /** One line: what this screen is for. */
  what: string;
  /** One line: the next useful action on it. */
  how: string;
  /** Why the page was created — the job it exists to do. */
  whyCreated: string;
  /** The user workflow this page is bounded to. */
  boundedWorkflow: string;
  /** What changes when the user acts on this page. */
  changesMade: string;
  /** Which Faazio apps the changes reach. */
  app: FaazioApp[];
}

export interface ComponentHint {
  /** One line: what this control does. */
  what: string;
  /** Which user workflow this control belongs to. */
  workflow: string;
  /** What change it makes when the user acts on it. */
  changes: string;
  /** Plain-English example. */
  example: string;
  /** Which Faazio apps the change reaches. */
  app: FaazioApp[];
  /** Optional: only show this hint to this role (role-specific variants use the key suffix). */
  role?: Role;
}

function normalise(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return clean
    .split("/")
    .map((part) => (/^[a-z]{2,3}-[a-z0-9-]+$/i.test(part) || /^\d+$/.test(part) ? ":id" : part))
    .join("/");
}

/** Builds the page-scoped component key, e.g. scopedKey("/seller/orders/42", "accept") → "/seller/orders/:id:accept". */
export function scopedKey(pathname: string, id: string): string {
  return `${normalise(pathname)}:${id}`;
}

export const PAGE_HINTS: Record<string, PageHint> = {
  // ── Seller console ─────────────────────────────────────────────────────────
  "/seller": {
    what: "Your shop at a glance: today's orders, payouts due, stock warnings and listing health.",
    how: "Start with the alert cards — anything red or amber is costing you orders right now.",
    whyCreated: "So a seller sees today's sales, payouts and risks in one screen without digging.",
    boundedWorkflow: "Daily operations: read orders → clear stock/price alerts → track payouts.",
    changesMade: "Read-only summary; acting on an alert opens the page that edits it.",
    app: ["consumer"],
  },
  "/seller/onboarding": {
    what: "The steps Faazio needs before your shop can sell: business details, documents and bank account.",
    how: "Finish every checklist row; each one unlocks the next stage of review.",
    whyCreated: "To collect and verify the legal details Faazio needs before a shop goes live.",
    boundedWorkflow: "Seller onboarding: submit documents → district admin verifies → shop activates.",
    changesMade: "Submitting moves your application into the district admin's verification queue.",
    app: ["portal", "consumer"],
  },
  "/seller/products": {
    what: "Every listing you own, with photo, price, stock state and review status.",
    how: "Filter by status to find listings stuck in review, then open one to fix it.",
    whyCreated: "So a seller can manage the full catalog and see what is live, pending or rejected.",
    boundedWorkflow: "Catalog management: list → submit for review → edit → delist.",
    changesMade: "Editing or delisting here changes what shoppers can buy in the Faazio app.",
    app: ["consumer"],
  },
  "/seller/products/new": {
    what: "A four-step form that creates one listing: category, details and photos, price, then review.",
    how: "Upload at least one clear photo on a white background — listings without photos rarely sell.",
    whyCreated: "So a seller can add a new product without help and be guided through the required fields.",
    boundedWorkflow: "Catalog creation: category → details/photos → price/inventory → submit for review.",
    changesMade: "Submitting creates a PENDING_REVIEW listing and sends it to the district review queue.",
    app: ["consumer"],
  },
  "/seller/products/:id/edit": {
    what: "Edit an existing listing's photos, description, price and prescription flag.",
    how: "Save changes to send the listing back through review; delete only if you will never restock it.",
    whyCreated: "So a seller can correct or refresh a live listing without recreating it.",
    boundedWorkflow: "Catalog maintenance: open a listing → edit fields → save → re-review if needed.",
    changesMade: "Saving updates the shopper-facing listing; material edits re-enter review.",
    app: ["consumer"],
  },
  "/seller/inventory": {
    what: "Stock counts and delivery time for each listing.",
    how: "Type a new quantity or ETA and save the row; anything at or below the low-stock line is highlighted.",
    whyCreated: "So a seller can keep stock honest and avoid selling items that are out of stock.",
    boundedWorkflow: "Stock maintenance: review low-stock rows → update quantity → save.",
    changesMade: "Saving changes availability and the delivery promise shoppers see.",
    app: ["consumer"],
  },
  "/seller/pricing": {
    what: "Side-by-side pricing for your catalog with the discount and margin rules applied.",
    how: "Rows flagged against the state median need a price change or an explanation.",
    whyCreated: "So a seller can keep prices competitive and fix anything the pricing audit flags.",
    boundedWorkflow: "Pricing: review flagged rows → adjust price → save.",
    changesMade: "Saving changes the price shoppers pay and clears or raises the audit flag.",
    app: ["consumer"],
  },
  "/seller/promotions": {
    what: "Your own discounts plus the festival campaigns you can opt listings into.",
    how: "Opt in products you have real stock for; campaign pricing overrides your normal price.",
    whyCreated: "So a seller can run offers and join Faazio campaigns that drive traffic.",
    boundedWorkflow: "Promotions: create a discount or opt listings into a live campaign.",
    changesMade: "Opting in applies campaign pricing shoppers see during the campaign window.",
    app: ["consumer"],
  },
  "/seller/ads": {
    what: "Sponsored placements that push your listings up in app search and category rails.",
    how: "Request a slot, set the daily budget, and watch spend against clicks before extending.",
    whyCreated: "So a seller can buy extra visibility and measure whether it pays back.",
    boundedWorkflow: "Advertising: pick a target → choose a placement → add creative → set dates → go live.",
    changesMade: "Publishing a campaign shows the creative on the chosen shopper app surface immediately.",
    app: ["consumer"],
  },
  "/seller/stores": {
    what: "Your shop's addresses, service area, opening hours and delivery promise.",
    how: "Keep hours honest — orders arriving while you are closed hurt your health score.",
    whyCreated: "So a seller can define where and when they serve, and what they promise on delivery.",
    boundedWorkflow: "Store profile: set address, hours and delivery promise.",
    changesMade: "Saving changes the service area and hours shoppers see in the app.",
    app: ["consumer"],
  },
  "/seller/menus": {
    what: "Your restaurant's dish menu with selling price and optional MRP strike-through.",
    how: "Add or edit a dish, then publish; the app hides unpublished dishes.",
    whyCreated: "So a Food seller can curate the dishes shown on their venue page.",
    boundedWorkflow: "Menu management: add a dish → set price/MRP → publish.",
    changesMade: "Publishing a dish makes it orderable on the venue in the Faazio app.",
    app: ["consumer"],
  },
  "/seller/orders": {
    what: "Live orders from the consumer app, newest first.",
    how: "Move an order forward one status at a time — accept, pack, hand over — inside its detail page.",
    whyCreated: "So a seller never misses or stalls an incoming order, and can act before the SLA.",
    boundedWorkflow: "Order fulfilment: accept → pack → hand over to rider.",
    changesMade: "Each status change updates the shopper's tracking and moves the delivery app job.",
    app: ["consumer", "delivery"],
  },
  "/seller/orders/:id": {
    what: "One order: items, customer promise time, payment state and its full timeline.",
    how: "Use the status buttons as you actually pack and hand over; the customer sees each step.",
    whyCreated: "So a seller can work a single order end-to-end and see everything about it.",
    boundedWorkflow: "Order fulfilment: accept → pack → hand over, with a full status timeline.",
    changesMade: "Advancing status updates the shopper's tracking and the rider's job in the delivery app.",
    app: ["consumer", "delivery"],
  },
  "/seller/prescriptions": {
    what: "Pharmacy prescriptions waiting for a price quote and fulfilment.",
    how: "Open an Rx, add priced lines, then mark it READY to reveal the customer's details.",
    whyCreated: "So a pharmacy can quote a prescription before the customer pays, protecting PII until READY.",
    boundedWorkflow: "Rx fulfilment: review the image → quote lines → mark READY → fulfil or cancel.",
    changesMade: "Marking READY reveals the customer's contact details and notifies them in the app.",
    app: ["consumer"],
  },
  "/seller/returns": {
    what: "Return and refund requests raised against your orders.",
    how: "Approve or reject each request with a reason — the reason reaches the customer.",
    whyCreated: "So a seller can resolve after-sales issues and keep refunds moving.",
    boundedWorkflow: "After-sales: review a return request → approve or reject with a reason.",
    changesMade: "Approving starts the refund the customer sees in the Faazio app.",
    app: ["consumer"],
  },
  "/seller/reviews": {
    what: "Customer ratings and written reviews for your listings.",
    how: "Read the low-star reviews first; repeated complaints usually point at one listing.",
    whyCreated: "So a seller can hear customer feedback and spot a listing that is underperforming.",
    boundedWorkflow: "Reputation: read reviews → reply or fix the flagged listing.",
    changesMade: "A seller reply appears publicly under the review in the app.",
    app: ["consumer"],
  },
  "/seller/payments": {
    what: "What Faazio owes you: settled payouts, commission, taxes and the next payout date.",
    how: "Open a settlement to see the order-level breakdown before you raise a query.",
    whyCreated: "So a seller can see exactly how each payout was calculated and when money arrives.",
    boundedWorkflow: "Payouts: review settled cycles → check deductions → raise a support ticket if needed.",
    changesMade: "Read-only ledger; raising a query opens a Faazio support ticket.",
    app: ["portal"],
  },
  "/seller/analytics": {
    what: "How the shop is performing: revenue, orders, category mix and the funnel from view to order.",
    how: "Switch the date range, then compare category performance to decide what to restock.",
    whyCreated: "So a seller can make stock and pricing decisions from their own numbers.",
    boundedWorkflow: "Reporting: pick a window → read revenue/funnel → adjust catalog or stock.",
    changesMade: "Read-only; insights lead to edits on the catalog, pricing or inventory pages.",
    app: ["portal"],
  },
  "/seller/support": {
    what: "Raise a ticket to Faazio and track the ones already open.",
    how: "Attach the order or listing ID in the ticket — it gets answered far faster.",
    whyCreated: "So a seller has one channel to reach Faazio and follow every open issue.",
    boundedWorkflow: "Support: raise a ticket → track replies → close when resolved.",
    changesMade: "A new ticket enters the Faazio support queue, routed by state.",
    app: ["portal"],
  },
  "/seller/settings": {
    what: "Account details, sub-users, notification choices and shop-level preferences.",
    how: "Give staff their own sub-user login instead of sharing yours.",
    whyCreated: "So a seller can manage their account and staff access safely.",
    boundedWorkflow: "Account administration: update details → add sub-users → set notifications.",
    changesMade: "Saving changes your account and what alerts you receive.",
    app: ["portal"],
  },

  // ── District admin console ─────────────────────────────────────────────────
  "/admin/district": {
    what: "Command center for your state: supply, demand, escalations and anything waiting on you.",
    how: "Clear the queue counters at the top before moving to growth work.",
    whyCreated: "So a district admin sees every decision waiting on them in one place.",
    boundedWorkflow: "District operations: clear review queues → handle escalations → review supply.",
    changesMade: "Read-only summary; each counter opens the page where you act.",
    app: ["consumer", "delivery"],
  },
  "/admin/district/sellers": {
    what: "Every seller registered in your state with KYC stage and health score.",
    how: "Open a seller to read documents and approve, hold or reject with a reason.",
    whyCreated: "So a district admin can onboard and moderate the sellers in their state.",
    boundedWorkflow: "Seller verification: open a seller → check documents → approve or reject.",
    changesMade: "Approving activates the seller; rejecting blocks them and is audit-logged.",
    app: ["portal", "consumer"],
  },
  "/admin/district/sellers/:id": {
    what: "One seller's profile, documents, bank details, stores and moderation history.",
    how: "Check each document against the registered name before approving.",
    whyCreated: "So a district admin can verify a seller's identity and payout account before activating them.",
    boundedWorkflow: "KYC verification: check each document → verify → activate or reject with a reason.",
    changesMade: "Verifying a document and activating the seller lets their listing go live in the app.",
    app: ["portal", "consumer"],
  },
  "/admin/district/products": {
    what: "All listings in your state, whatever their status.",
    how: "Search by seller or category to audit a batch, then act from the row.",
    whyCreated: "So a district admin can audit the full local catalog and moderate at scale.",
    boundedWorkflow: "Catalog moderation: search/filter → approve, reject or delist a listing.",
    changesMade: "A moderation decision changes whether shoppers can see and buy the listing.",
    app: ["consumer"],
  },
  "/admin/district/products/queue": {
    what: "Listings waiting for a first review in your state.",
    how: "Approve or reject each one with a reason; both actions are written to the audit log.",
    whyCreated: "So newly submitted listings are reviewed before they reach shoppers.",
    boundedWorkflow: "Catalog review: open a pending listing → approve or reject with a reason.",
    changesMade: "Approving publishes the listing to the app; rejecting sends the reason to the seller.",
    app: ["consumer"],
  },
  "/admin/district/pricing-audit": {
    what: "Listings whose price breaks a rule or sits far from the state median.",
    how: "Work top to bottom — the reasons column tells you which rule tripped.",
    whyCreated: "So a district admin can catch mispriced listings that break Faazio's pricing rules.",
    boundedWorkflow: "Price integrity: review flagged listings → correct or take action.",
    changesMade: "Acting on a flag can delist or fix the listing shoppers see.",
    app: ["consumer"],
  },
  "/admin/district/festival": {
    what: "Festival campaigns running in your state and the sellers who opted in.",
    how: "Create a state campaign, then chase opt-ins from your strongest sellers.",
    whyCreated: "So a district admin can run local festival promotions on top of national campaigns.",
    boundedWorkflow: "Campaign management: create a state campaign → approve opt-ins.",
    changesMade: "A live campaign changes prices on opted-in listings in the app.",
    app: ["consumer"],
  },
  "/admin/district/content": {
    what: "The rails and picks shoppers see on the app home screen for your state.",
    how: "Curate a rail from the candidate list; only in-stock, approved listings qualify.",
    whyCreated: "So a district admin can choose what shoppers see first on the app home screen.",
    boundedWorkflow: "Merchandising: pick a rail → curate listings → publish.",
    changesMade: "Publishing changes the home-screen rails shoppers see in the app.",
    app: ["consumer"],
  },
  "/admin/district/coupons": {
    what: "Coupons valid in your state, with usage and remaining budget.",
    how: "Issue one with a clear cap; watch redemption before widening it.",
    whyCreated: "So a district admin can run local discounts without overspending.",
    boundedWorkflow: "Coupon management: issue a coupon → set cap and validity → monitor redemption.",
    changesMade: "An active coupon is redeemable by shoppers in your state at checkout.",
    app: ["consumer"],
  },
  "/admin/district/orders": {
    what: "Live order flow in your state, including late orders and cancellations.",
    how: "Escalations sit at the top — those customers are already waiting.",
    whyCreated: "So a district admin can watch order health and step in on late or stuck orders.",
    boundedWorkflow: "Order oversight: monitor flow → escalate or resolve late orders.",
    changesMade: "Resolving an escalation updates the order the shopper is tracking.",
    app: ["consumer", "delivery"],
  },
  "/admin/district/blood": {
    what: "Blood requests posted in your state, with urgency and expiry.",
    how: "Remove a fulfilled or expired request; contact details stay redacted for the public.",
    whyCreated: "So a district admin can moderate the blood-request board and remove stale posts.",
    boundedWorkflow: "Blood bank moderation: review requests → delete fulfilled/expired ones.",
    changesMade: "Deleting removes the request from the board in the app.",
    app: ["consumer"],
  },
  "/admin/district/customers": {
    what: "Customers who ordered in your state, with order count and spend.",
    how: "Open a customer to see their activity trail before acting on a query.",
    whyCreated: "So a district admin can support customers and spot unusual behaviour.",
    boundedWorkflow: "Customer support: find a customer → read their activity trail → resolve.",
    changesMade: "Read-only; activity is traced from ID-only events with no PII exposed.",
    app: ["consumer"],
  },
  "/admin/district/delivery-boys": {
    what: "Delivery partners in your state: pending KYC, active riders and suspensions.",
    how: "Verify a rider's documents, then a super admin activates them.",
    whyCreated: "So a district admin can vet and manage the riders serving their state.",
    boundedWorkflow: "Rider management: verify documents → recommend activation → suspend if needed.",
    changesMade: "Verifying enables a rider for activation, which puts them on delivery jobs.",
    app: ["delivery"],
  },
  "/admin/district/delivery/manual-allocation": {
    what: "Delivery-ready orders in your district with no rider, plus offers the rider has not accepted.",
    how: "Open an order, pick a rider by road distance, then choose AUTOMATED or MANUAL payout before allocating.",
    whyCreated: "So a district admin can hand a stuck order to a rider when auto-allocation fails.",
    boundedWorkflow: "Manual allocation: open an unassigned order → pick a rider → choose payout mode → allocate.",
    changesMade: "Allocating creates the rider's job in the delivery app and sets how they will be paid.",
    app: ["delivery", "consumer"],
  },
  "/admin/district/delivery/payouts": {
    what: "Rider payouts in your district, both system-calculated and manually entered.",
    how: "Open a pending payout to record the travelled distance or fare, then Mark Paid after paying the rider.",
    whyCreated: "So a district admin can settle what each rider earned per completed delivery.",
    boundedWorkflow: "Payout settlement: review a job → set mode/distance/fare → Mark Paid.",
    changesMade: "Marking Paid records the payment the rider sees in the delivery app.",
    app: ["delivery"],
  },
  "/admin/district/analytics": {
    what: "State-level GMV, orders, category mix and city split.",
    how: "Compare cities to spot where supply, not demand, is the limit.",
    whyCreated: "So a district admin can measure their state and find where to focus.",
    boundedWorkflow: "Reporting: pick a window → read GMV/category/city split → plan actions.",
    changesMade: "Read-only; insights lead to action on sellers, catalog or campaigns.",
    app: ["portal"],
  },
  "/admin/district/support": {
    what: "Support tickets raised by sellers and customers in your state.",
    how: "Answer in order of age; attach the order or listing ID to the reply.",
    whyCreated: "So a district admin can be the first responder to local support issues.",
    boundedWorkflow: "Support: open a ticket → reply → resolve or escalate to Faazio.",
    changesMade: "Replies reach the seller or customer in the app.",
    app: ["consumer", "seller"],
  },
  "/admin/district/audit": {
    what: "Every action taken in your state console, oldest kept, nothing editable.",
    how: "Filter by entity or free text when you need to explain a past decision.",
    whyCreated: "So there is an immutable record of who changed what in your state.",
    boundedWorkflow: "Governance: search the log to explain or investigate a past action.",
    changesMade: "Read-only; rows are retained for 7 days then purged nightly.",
    app: ["portal"],
  },
  "/admin/district/fee-change-requests": {
    what: "Seller requests to change their platform-fee percentage, scoped to your district.",
    how: "Approve to apply the new fee, or reject with a reason the seller will read.",
    whyCreated: "So fee negotiations have one reviewable, auditable place instead of email.",
    boundedWorkflow: "Fee review: open a request → approve (applies the fee) or reject with a reason.",
    changesMade: "Approving changes the fee deducted from the seller's future payouts.",
    app: ["portal"],
  },

  // ── Super admin console ────────────────────────────────────────────────────
  "/admin/super": {
    what: "The global command center across all districts, sectors and sellers.",
    how: "Scan district and sector health first; drill in where a number breaks the pattern.",
    whyCreated: "So a super admin sees platform-wide health and the districts that need attention.",
    boundedWorkflow: "Global operations: scan health → drill into a district or sector.",
    changesMade: "Read-only summary; each tile opens the control plane where you act.",
    app: ["consumer", "seller", "delivery", "portal"],
  },
  "/admin/super/ads": {
    what: "Every sponsored hero campaign, with live/reported status and CTR.",
    how: "Take down a reported ad, or restore one that was cleared.",
    whyCreated: "So a super admin can police advertising quality across the whole platform.",
    boundedWorkflow: "Ad moderation: monitor live campaigns → takedown or restore with a reason.",
    changesMade: "A takedown removes the creative from the app immediately.",
    app: ["consumer"],
  },
  "/admin/super/sdui": {
    what: "The home / Mart / Food / Pharma app layouts: rails, product picks and hero banners.",
    how: "Edit a section's title or product ids, then publish; the app recompiles on its next poll.",
    whyCreated: "So Faazio can change what shoppers see on the home screen without an app release.",
    boundedWorkflow: "Merchandising authority: edit SDUI sections → publish → app recompiles.",
    changesMade: "Publishing bumps the layout version and changes the app home screen.",
    app: ["consumer"],
  },
  "/admin/super/festival": {
    what: "National festival campaigns and how states are taking them up.",
    how: "Launch a global campaign, then check opted-in GMV by sector.",
    whyCreated: "So Faazio can run platform-wide promotions and see adoption by state.",
    boundedWorkflow: "Campaign authority: launch a global campaign → monitor opt-ins by sector.",
    changesMade: "A live global campaign changes prices on opted-in listings everywhere.",
    app: ["consumer"],
  },
  "/admin/super/coupons": {
    what: "Platform-wide coupons and their spend.",
    how: "Set a budget cap on every coupon before it goes live.",
    whyCreated: "So Faazio can run global discounts while controlling total spend.",
    boundedWorkflow: "Coupon authority: issue a global coupon → cap it → monitor redemption.",
    changesMade: "An active coupon is redeemable by shoppers platform-wide.",
    app: ["consumer"],
  },
  "/admin/super/products": {
    what: "The entire catalog with bulk moderation.",
    how: "Select rows, then apply one decision to the whole batch.",
    whyCreated: "So a super admin can moderate the catalog at platform scale.",
    boundedWorkflow: "Global catalog moderation: filter → bulk approve, reject or delist.",
    changesMade: "A batch decision changes what shoppers can see and buy across all states.",
    app: ["consumer"],
  },
  "/admin/super/sellers": {
    what: "Every seller on the platform, across states.",
    how: "Sort by GMV or health to find both your top partners and the risky ones.",
    whyCreated: "So a super admin can see and moderate sellers platform-wide.",
    boundedWorkflow: "Global seller oversight: search/sort → open KYC detail → moderate.",
    changesMade: "Moderation reaches the seller's ability to sell in the app.",
    app: ["portal", "consumer"],
  },
  "/admin/super/sectors": {
    what: "Sectors, their category trees and the GST rates that govern pricing.",
    how: "Add, rename or remove categories here; every listing under them follows.",
    whyCreated: "So there is one authoritative category and GST master for the whole platform.",
    boundedWorkflow: "Taxonomy authority: edit the category tree and GST rates.",
    changesMade: "Changes reach the category picker sellers use and the checkout tax split.",
    app: ["consumer", "portal"],
  },
  "/admin/super/coverage": {
    what: "Which consumer app surface is fed by which data source, so nothing ships empty.",
    how: "Any surface without a source will look broken in the app — fix those first.",
    whyCreated: "So Faazio can guarantee no shopper-facing surface renders empty.",
    boundedWorkflow: "Coverage assurance: review surfaces → fill the gaps.",
    changesMade: "Read-only; gaps point to the SDUI or catalog work that fills them.",
    app: ["consumer"],
  },
  "/admin/super/rewards": {
    what: "The FaazioCoins loyalty program rates: earn, redeem, streak and discount cards.",
    how: "Tune the rates, then watch earn vs redeem before changing them again.",
    whyCreated: "So Faazio can run and tune the loyalty programme from one place.",
    boundedWorkflow: "Rewards authority: set earn/redeem rates → monitor the coin ledger.",
    changesMade: "New rates change how many coins shoppers earn and what they redeem for.",
    app: ["consumer"],
  },
  "/admin/super/users": {
    what: "Every portal login Faazio has issued, with role and scope.",
    how: "Search by email to find an account, then enable, disable or reset it.",
    whyCreated: "So a super admin can see and manage every portal account in one list.",
    boundedWorkflow: "Account governance: search accounts → enable/disable → reset password.",
    changesMade: "Disabling an account blocks that user's next sign-in to the portal.",
    app: ["portal"],
  },
  "/admin/super/districts": {
    what: "Each district's launch status, supply depth and performance side by side.",
    how: "Use the matrix to decide where to open next and where to hold.",
    whyCreated: "So a super admin can compare districts and prioritise expansion.",
    boundedWorkflow: "Expansion planning: compare districts → decide open/hold.",
    changesMade: "Read-only; decisions lead to issuing district-admin logins.",
    app: ["portal", "consumer"],
  },
  "/admin/super/fee-change-requests": {
    what: "Seller platform-fee change requests across every district.",
    how: "Approve to apply the new fee, or reject with a reason the seller will read.",
    whyCreated: "So fee changes are reviewed centrally and applied consistently.",
    boundedWorkflow: "Fee review: open a request → approve (applies the fee) or reject with a reason.",
    changesMade: "Approving changes the fee deducted from the seller's future payouts.",
    app: ["portal"],
  },
  "/admin/super/district-admins": {
    what: "District-admin accounts and which district each one governs.",
    how: "Create an account per district; never share one login across districts.",
    whyCreated: "So every district has exactly one accountable admin login.",
    boundedWorkflow: "Roster management: create an admin (and login) → map to one district.",
    changesMade: "A new admin can sign in and manage their district immediately.",
    app: ["portal"],
  },
  "/admin/super/app-config": {
    what: "Central remote config the Faazio apps read on boot to override baked defaults.",
    how: "Edit a value and save; the app picks it up on its next cold boot, no release needed.",
    whyCreated: "So Faazio can change app behaviour and flags without an app-store update.",
    boundedWorkflow: "Remote config: edit a key → save → apps fetch it on next boot.",
    changesMade: "Saving changes what every app does on its next launch (secret rows stay masked).",
    app: ["consumer", "seller", "delivery"],
  },
  "/admin/super/audit": {
    what: "The immutable record of every admin action across all consoles.",
    how: "Filter by actor role or entity when investigating a decision.",
    whyCreated: "So there is one platform-wide, non-editable record of admin actions.",
    boundedWorkflow: "Governance: search the log to investigate or explain an action.",
    changesMade: "Read-only; rows are retained for 7 days then purged nightly.",
    app: ["portal"],
  },
  "/admin/super/security": {
    what: "Rotate your own portal password.",
    how: "Enter the current password, then a new one — every other session is signed out.",
    whyCreated: "So any portal user can change their password and revoke stale sessions.",
    boundedWorkflow: "Account security: verify current password → set a new one.",
    changesMade: "Changing the password revokes every other active session.",
    app: ["portal"],
  },
  "/admin/super/delivery-boys": {
    what: "All-India delivery-partner console: KYC queue, active riders and suspensions.",
    how: "Verify a rider, then activate (super-only) or suspend/blacklist.",
    whyCreated: "So Faazio can vet, activate and police riders across every district.",
    boundedWorkflow: "Rider authority: verify → activate → suspend or blacklist.",
    changesMade: "Activating puts a rider on jobs; suspending removes them from delivery.",
    app: ["delivery"],
  },
  "/admin/super/delivery/manual-allocation": {
    what: "Delivery-ready orders across every district with no rider, plus unaccepted offers.",
    how: "Filter by district, open an order, pick a rider by road distance, then choose the payout mode.",
    whyCreated: "So a super admin can unblock any district's stuck deliveries.",
    boundedWorkflow: "Manual allocation: filter district → open order → pick rider → allocate.",
    changesMade: "Allocating creates the rider's job in the delivery app.",
    app: ["delivery", "consumer"],
  },
  "/admin/super/delivery/payouts": {
    what: "Every rider payout, with district, mode, calculated fare and settlement state.",
    how: "Open a pending payout to adjust the mode or manual fare, then Mark Paid after paying the rider.",
    whyCreated: "So a super admin can settle rider payouts across the whole platform.",
    boundedWorkflow: "Payout authority: review a job → set mode/fare → Mark Paid.",
    changesMade: "Marking Paid records the payment the rider sees in the delivery app.",
    app: ["delivery"],
  },
  "/admin/super/analytics": {
    what: "Platform metrics: GMV, orders, sector mix, state split and seller concentration.",
    how: "Change the window at the top; concentration above a third of GMV is a risk to flag.",
    whyCreated: "So a super admin can read platform health and concentration risk.",
    boundedWorkflow: "Reporting: pick a window → read platform mix/concentration → plan.",
    changesMade: "Read-only; insights lead to action on sellers, campaigns or districts.",
    app: ["portal"],
  },
  "/admin/super/settings": {
    what: "Platform-level switches: commission, tax, payout schedule and service levels.",
    how: "Changes here apply to every state, so note the reason in the audit log.",
    whyCreated: "So Faazio's global commercial and service rules live in one audited place.",
    boundedWorkflow: "Platform settings: change a global rule → confirm.",
    changesMade: "A change applies to every state and affects sellers and payouts platform-wide.",
    app: ["portal", "consumer", "seller", "delivery"],
  },
  "/admin/super/credentials": {
    what: "Issue or disable portal logins for any role, and reset passwords.",
    how: "Create a scoped login (seller or district), then hand over the temporary password once.",
    whyCreated: "So a super admin controls exactly who can sign in to the portal.",
    boundedWorkflow: "Credential management: issue a login → reset or disable it.",
    changesMade: "A new login can sign in; a disabled one is blocked at the next sign-in.",
    app: ["portal"],
  },
  "/security": {
    what: "Rotate your own portal password.",
    how: "Enter the current password, then a new one — every other session is signed out.",
    whyCreated: "So any portal user can change a temporary or compromised password.",
    boundedWorkflow: "Account security: verify current password → set a new one.",
    changesMade: "Changing the password revokes every other active session.",
    app: ["portal"],
  },
};

export function routeHint(pathname: string): PageHint | undefined {
  return PAGE_HINTS[normalise(pathname)];
}

export const SECTION_HINTS: Record<string, string> = {
  "Admin roster": "District admin accounts, newest first. One admin owns one district.",
  Ads: "Sponsored placements and what they cost against the clicks they earn.",
  Alerts: "Anything already hurting sales or waiting on a decision. Empty is good.",
  "All campaigns": "Every festival campaign, whatever its state or stage.",
  "All coupons": "Every coupon, live or expired, with the budget it has consumed.",
  "All open orders": "Orders not yet delivered or cancelled anywhere in scope.",
  "All placements": "Ad slots across sellers, with spend and delivery.",
  "Audit log": "Actions written as they happen. Read-only, retained 7 days; older entries are purged nightly.",
  "Business profile": "The legal details Faazio checks against your documents.",
  "Cancellations and returns": "Money going back out and the reasons customers gave.",
  Catalog: "Listings in scope with photo, price and review status.",
  "Catalog moderation": "Approve, reject or delist listings; each action needs a reason.",
  "Category master": "The category tree every listing is filed under.",
  "Category mix": "Share of sales by category, so you can see what actually sells.",
  "Category performance": "Revenue and order count per category over the chosen window.",
  "Command center": "The few numbers worth reacting to today.",
  "Commission & tax": "The cut Faazio takes and the tax applied before payout.",
  "Consumer app coverage": "Each shopper-facing surface and the data feeding it.",
  "Content curation": "The home-screen rails shoppers see, in the order they see them.",
  "Conversion funnel": "Views to cart to order. The biggest drop is where to work.",
  Coupons: "Discount codes and how much of their budget is left.",
  "Coupons in your state": "Codes redeemable in your state only.",
  "Create a global campaign": "Runs in every live state. Set dates and discount ceiling.",
  "Create a state campaign": "Runs in your state only, on top of any national campaign.",
  "Create an admin account": "Grants console access for one district. Choose the district carefully.",
  Decision: "Approve, hold or reject with a reason the seller will read.",
  Escalations: "Orders a customer has already complained about.",
  FaazioCoins: "Loyalty balance earned and spent by shoppers.",
  "Festival campaigns": "Time-boxed discount events with opt-in listings.",
  "Festival governance": "Which states and sectors take part, and the ceilings they must respect.",
  "Festival overview": "Campaign reach, opt-ins and the sales they moved.",
  "Flagged listings": "Prices that break a rule or sit far from the state median.",
  "GMV by city": "Gross sales split by city.",
  "GMV by day": "Gross sales per day over the chosen window.",
  "GMV by state": "Gross sales split by state.",
  "GMV trend": "Gross sales over time. Watch the shape, not one day.",
  "Global analytics": "Platform totals across every state and sector.",
  "Global catalog": "Every listing on the platform, with bulk actions.",
  "Global sector caps": "Maximum discount and commission allowed per sector.",
  Inventory: "Stock on hand and the delivery time you promise.",
  "Issue a coupon": "Set code, discount, cap and validity before it goes live.",
  "Issue a global coupon": "Applies in every live state. Always set a budget cap.",
  "KYC documents": "Uploaded proofs. Check each against the registered business name.",
  "List a new product": "Four steps: category, details and photos, price, review.",
  "Listing details": "Name, description, price and prescription flag for this listing.",
  "Listing queue": "Listings waiting for a first review.",
  "Merge categories": "Moves every listing into the target category. This cannot be undone.",
  "My placements": "Ad slots you are running, with spend to date.",
  "My tickets": "Support requests you have raised and their replies.",
  Notifications: "Which events email or alert you.",
  "Onboarding funnel": "How far sellers get before they drop out of sign-up.",
  "Opt products in": "Adds listings to the campaign at the campaign price.",
  "Opted-in GMV by sector": "Campaign sales split by sector.",
  Orders: "Orders in scope, newest first.",
  "Orders awaiting allocation": "PACKED orders with no active rider, plus offers the rider has not accepted yet.",
  "Orders by day": "Order count per day over the chosen window.",
  "Order status split": "Where open orders are stuck right now.",
  "Orders monitor": "Live order flow, including late and cancelled orders.",
  "Orders per day": "Order count per day over the chosen window.",
  Payments: "Settled payouts, deductions and the next payout date.",
  "Payout schedule": "How often settled money leaves Faazio for seller accounts.",
  "Per-state overrides": "Where a state deviates from the platform default.",
  "Per-state ceilings": "Discount limits set per state.",
  Photos: "What shoppers see on cards, search results and the product page.",
  "Platform GMV": "Total gross sales across the platform.",
  "Platform settings": "Global switches. A change here reaches every state.",
  "Price change history": "Every price edit on this catalog, with who made it.",
  Pricing: "MRP against selling price, with the rules applied.",
  "Pricing audit": "Prices that need an explanation or a correction.",
  "Product performance": "Which listings earn, and which just take up space.",
  Products: "Listings in scope with status and price.",
  Promotions: "Your discounts plus campaigns you can join.",
  "Rail being edited": "The home-screen row you are curating.",
  "Raise a ticket": "Include the order or listing ID for a faster answer.",
  "Rating breakdown": "How your stars are distributed.",
  "Recent reviews": "The newest customer comments on your listings.",
  "Registered details": "What the seller submitted at sign-up.",
  "Rename a category": "Renames it everywhere shoppers see it.",
  "Request a placement": "Ask for an ad slot; set a daily budget you can afford.",
  Returns: "Return requests and where each one stands.",
  "Revenue trend": "Money earned over time, after discounts.",
  Reviews: "Customer ratings and comments.",
  "Sector caps in force": "The discount and commission ceilings applied right now.",
  "Sector mix": "Share of activity across Mart, Food and Pharma.",
  "Sectors & categories": "The tree every listing hangs off.",
  "Seller concentration": "How much of GMV a few sellers carry. High is risky.",
  "Seller leaderboard": "Top sellers by sales in the chosen window.",
  "Seller onboarding": "Sellers part-way through sign-up.",
  "Seller opt-ins": "Sellers who joined this campaign.",
  Sellers: "Sellers in scope with KYC stage and health score.",
  "Sellers in this state": "Every seller registered in your state.",
  "Service levels": "Promised delivery and response times.",
  Settings: "Preferences for this account and shop.",
  "Settlement bank account": "Where payouts land. Changes are re-verified.",
  "Settlement board": "Completed deliveries ready to settle, with their payout mode and amount.",
  "Settlement ledger": "Each payout, its deductions and its status.",
  "Setup checklist": "Everything still blocking your shop from selling.",
  "Shop analytics": "Your sales, orders and conversion over time.",
  "Shop health": "The score Faazio uses to rank you in the app.",
  "Sponsored slots": "Ad inventory available and how full it is.",
  "District admins": "Who governs which district.",
  "State analytics": "Performance for your state only.",
  "District matrix": "Every district side by side on the same measures.",
  States: "Launch status and depth per state.",
  Stores: "Your addresses, hours and delivery promise.",
  "Sub-users": "Staff logins scoped to your shop.",
  Summary: "The short version of this screen.",
  Support: "Tickets between you and Faazio.",
  "Surface to data mapping": "Which app screen reads which data source.",
  "System alerts": "Platform-level problems needing attention.",
  Timeline: "Every step this record has been through, with timestamps.",
  "Top cities": "Where the orders come from.",
  "Top products": "Your best sellers in the chosen window.",
};

export function sectionHint(title?: string): string | undefined {
  return title ? SECTION_HINTS[title] : undefined;
}

/**
 * Fallback help for metric tiles, keyed by the tile label so one line of copy
 * serves every screen that shows that metric.
 */
export const METRIC_HINTS: Record<string, string> = {
  Active: "Records currently live and visible to shoppers.",
  "Active admins": "Admin accounts able to sign in right now.",
  "Active sellers": "Sellers with at least one live listing.",
  Anomalies: "Prices or numbers that broke a rule and need a look.",
  Applications: "Sellers who applied and are waiting on review.",
  Approved: "Passed review and now allowed to sell.",
  "Awaiting decision": "Waiting on you. This number should trend to zero.",
  CTR: "Clicks divided by impressions. Higher means the ad is working.",
  Campaigns: "Festival events counted in this view.",
  Carts: "Shoppers who added an item but may not have paid yet.",
  Categories: "Category buckets in scope.",
  Clicks: "Times shoppers tapped a sponsored listing.",
  Commission: "The share Faazio keeps from these sales.",
  Covered: "App surfaces that already have data behind them.",
  "GMV (30d)": "Gross sales value over the last 30 days, before deductions.",
  "GSTIN check": "Whether the tax number matched government records.",
  Gaps: "Surfaces with no data yet — they look empty in the app.",
  "Gross order value": "Total order value before commission, tax and discounts.",
  Impressions: "Times a sponsored listing was shown.",
  Listings: "Products counted in this view.",
  Live: "Currently running and visible.",
  "Net payout": "What actually reaches the bank after deductions.",
  "Open orders": "Orders not yet delivered or cancelled.",
  "Opted-in GMV (30d)": "Sales from listings joined to the campaign.",
  Orders: "Paid orders in this view.",
  "Orders (30d)": "Paid orders over the last 30 days.",
  "Orders attributed": "Orders traced back to this ad placement.",
  "Pending KYC": "Sellers blocked until their documents are checked.",
  "Pending dispatch": "Paid orders still waiting to be packed or handed over.",
  "Products audited": "Listings whose price has been reviewed.",
  Rating: "Average customer star rating.",
  Requests: "Incoming asks waiting for a response.",
  Returns: "Items customers sent back.",
  "SLA breaches": "Promises missed on delivery or response time.",
  Selected: "Rows you have ticked for a bulk action.",
  "Seller opt-ins": "Sellers who joined this campaign.",
  Sellers: "Seller accounts in this view.",
  "District admins": "Admin accounts governing a district.",
  "Districts live": "Districts open to shoppers today.",
  "Uncovered districts": "Districts with no active admin account yet.",
  "Surfaces tracked": "App screens this console feeds.",
  TCS: "Tax collected at source, deducted before payout.",
  Views: "Times shoppers opened the listing.",
};

export function metricHint(label: string): string | undefined {
  return METRIC_HINTS[label];
}

/**
 * Component-level help. Keys are either a global id ("shell:seller-search",
 * "pattern:image-uploader") or a page-scoped "<pagePath>:<componentId>" built
 * with `scopedKey()`. A role-specific variant is stored as "<key>@<ROLE>" and
 * wins over the generic entry for that role.
 */
const CORE_COMPONENT_HINTS: Record<string, ComponentHint> = {
  // ── Shell chrome (every console page) ──────────────────────────────────────
  "shell:seller-nav": {
    what: "The seller console sections, grouped by job (Overview, Catalog, Operations, Growth, Account).",
    workflow: "Navigation — switch between the parts of your shop console.",
    changes: "Opens the section you pick; nothing is saved or changed.",
    example: "Tap 'Orders' under Operations to see today's incoming orders.",
    app: ["portal"],
  },
  "shell:seller-search": {
    what: "A quick filter for your products and orders.",
    workflow: "Find a record fast without opening a full page.",
    changes: "Filters what you are looking at; nothing is changed.",
    example: "Type 'paracetamol' to jump to that listing.",
    app: ["portal"],
  },
  "shell:seller-bell": {
    what: "Notifications about your shop: new orders, reviews, payouts and admin decisions.",
    workflow: "Daily operations — catch anything new since you were last here.",
    changes: "Read-only; opening an alert takes you to the page where you act.",
    example: "A new-order alert takes you straight to the order.",
    app: ["consumer", "delivery"],
  },
  "shell:seller-user": {
    what: "Your account menu: account settings and sign out.",
    workflow: "Account — manage your own login.",
    changes: "Signing out ends this session on this device.",
    example: "Use 'Account settings' to add a sub-user.",
    app: ["portal"],
  },
  "shell:seller-signout": {
    what: "Ends your portal session on this device.",
    workflow: "Account security.",
    changes: "Clears your session cookies; you must sign in again.",
    example: "Sign out before leaving a shared computer.",
    app: ["portal"],
  },
  "shell:admin-nav": {
    what: "The admin console sections, grouped by job.",
    workflow: "Navigation — switch between the control-plane sections.",
    changes: "Opens the section you pick; nothing is saved or changed.",
    example: "Open 'Sellers' to review KYC.",
    app: ["portal"],
  },
  "shell:admin-search": {
    what: "Command palette (Cmd/Ctrl-K) to jump to any page, seller or order.",
    workflow: "Navigation — reach a record without knowing the menu.",
    changes: "Opens the record you pick; nothing is changed.",
    example: "Press Cmd-K and type a seller name to open them.",
    app: ["portal"],
  },
  "shell:admin-bell": {
    what: "Platform notifications: escalations, approvals waiting and system alerts.",
    workflow: "Daily operations — catch anything new since you were last here.",
    changes: "Read-only; opening an alert takes you to the page where you act.",
    example: "An escalation alert opens the order that needs attention.",
    app: ["consumer", "delivery"],
  },
  "shell:admin-user": {
    what: "Your admin account menu: role, scope and sign out.",
    workflow: "Account — confirm which role and district you are acting as.",
    changes: "Signing out ends this session on this device.",
    example: "Check the scope badge before making a district-wide change.",
    app: ["portal"],
  },
  "shell:admin-signout": {
    what: "Ends your portal session on this device.",
    workflow: "Account security.",
    changes: "Clears your session cookies; you must sign in again.",
    example: "Sign out before leaving a shared computer.",
    app: ["portal"],
  },
  "shell:admin-scope": {
    what: "Shows the role and district/state you are currently acting as.",
    workflow: "Account — confirm your scope before an action.",
    changes: "Read-only; every action you take is limited to this scope.",
    example: "A DISTRICT_ADMIN scoped to TCH cannot edit another district.",
    app: ["portal"],
  },
  "shell:mobile-nav": {
    what: "The touch-friendly navigation drawer for small screens.",
    workflow: "Navigation on a phone or narrow window.",
    changes: "Opens a section and closes the drawer.",
    example: "On a phone, tap the menu icon to reach Inventory.",
    app: ["portal"],
  },

  // ── Shared patterns ────────────────────────────────────────────────────────
  "pattern:status-pill": {
    what: "The lifecycle state of a record (e.g. PENDING_REVIEW, ACTIVE, DELIVERED).",
    workflow: "Status tracking — read where a record is in its flow.",
    changes: "Read-only; the colour tells you whether it needs action.",
    example: "A amber PENDING_REVIEW product still needs your district review.",
    app: ["portal"],
  },
  "pattern:sector-pill": {
    what: "Which sub-app a record belongs to: MART, FOOD or PHARMA.",
    workflow: "Scope — telling apart the three Faazio shopping apps.",
    changes: "Read-only; each sector has its own rules and app surfaces.",
    example: "A PHARMA listing needs a prescription flag where a MART one does not.",
    app: ["consumer"],
  },
  "pattern:image-uploader": {
    what: "Adds product or banner photos that shoppers see in the app.",
    workflow: "Content creation — give a listing or campaign its visuals.",
    changes: "Uploading stores the image and attaches it to the record.",
    example: "Upload a white-background shot so the item looks clean on the home rail.",
    app: ["consumer"],
  },
  "pattern:filter-chip": {
    what: "A one-tap filter for the table or list below it.",
    workflow: "Finding records — narrow a long list to the rows you care about.",
    changes: "Re-filters the view; nothing is changed.",
    example: "Tap 'Pending' to see only listings waiting on review.",
    app: ["portal"],
  },
  "pattern:product-thumb": {
    what: "The thumbnail of a product, from its primary photo.",
    workflow: "Recognition — spot a listing at a glance.",
    changes: "Read-only; the primary photo is edited on the listing form.",
    example: "A grey box means no photo was uploaded yet.",
    app: ["consumer"],
  },
  "pattern:empty-state": {
    what: "Shown when there is nothing to list yet.",
    workflow: "Feedback — tells you the page loaded but has no rows.",
    changes: "Read-only; the action button creates the first record.",
    example: "An empty review queue means nothing is waiting on you — that is good.",
    app: ["portal"],
  },
  "pattern:error-state": {
    what: "Shown when a request failed.",
    workflow: "Recovery — retry without losing your place.",
    changes: "Retrying re-fetches the data; nothing is changed.",
    example: "Tap 'Retry' after a dropped connection.",
    app: ["portal"],
  },
  "pattern:chart": {
    what: "A trend or split of activity over time.",
    workflow: "Reporting — read the shape, not a single point.",
    changes: "Read-only; hover for exact values.",
    example: "A rising GMV line with flat orders usually means bigger baskets.",
    app: ["portal"],
  },
  "pattern:seed-banner": {
    what: "A warning that the portal is running on demo data, not the live gateway.",
    workflow: "Safety — never mistaking seed data for live data.",
    changes: "Read-only; appears only when no gateway is configured.",
    example: "If you see this in production, the gateway URL is missing.",
    app: ["portal"],
  },

  // ── Seller — products/new (create listing workflow) ───────────────────────
  ...buildPageHints("/seller/products/new", {
    "step-rail": {
      what: "The five steps that create one listing.",
      workflow: "Create a new listing.",
      changes: "Shows where you are; you cannot skip a required step.",
      example: "You cannot reach Pricing until category and details are filled.",
      app: ["consumer"],
    },
    "sector-field": {
      what: "The sub-app (MART/FOOD/PHARMA) this listing belongs to.",
      workflow: "Create a new listing.",
      changes: "Fixed by your registration; contact an admin to change it.",
      example: "A pharmacy account always lists under PHARMA.",
      app: ["consumer"],
    },
    "store-select": {
      what: "Which of your stores stocks this listing.",
      workflow: "Create a new listing.",
      changes: "Decides the pickup location shoppers and riders use.",
      example: "Pick the store that actually holds the stock.",
      app: ["consumer", "delivery"],
    },
    "category-select": {
      what: "The approved category the listing is filed under, which also sets its GST rate.",
      workflow: "Create a new listing → cataloguing.",
      changes: "Decides where shoppers find it and the tax applied at checkout.",
      example: "Pick 'OTC Medicine' so it lands under Pharma, not Mart.",
      app: ["consumer"],
    },
    "name-input": {
      what: "The product name shoppers see on cards and search.",
      workflow: "Create a new listing → details.",
      changes: "Sets the listing title; keep it short and specific.",
      example: "Use 'Paracetamol 500mg Strip of 10', not just 'Tablets'.",
      app: ["consumer"],
    },
    "description-input": {
      what: "A short description of what the product is.",
      workflow: "Create a new listing → details.",
      changes: "Shown on the product page; it does not change price or stock.",
      example: "Mention pack size, flavour or strength.",
      app: ["consumer"],
    },
    "veg-switch": {
      what: "Marks the item as vegetarian.",
      workflow: "Create a new listing → details.",
      changes: "Shows the green veg mark shoppers filter by.",
      example: "Turn off for egg or meat products.",
      app: ["consumer"],
    },
    "rx-switch": {
      what: "Marks the item as needing a prescription.",
      workflow: "Create a new listing → details.",
      changes: "Forces shoppers to attach a valid prescription before ordering.",
      example: "Turn on for scheduled medicines.",
      app: ["consumer"],
    },
    "price-input": {
      what: "The final price shoppers pay; GST is already included.",
      workflow: "Create a new listing → pricing.",
      changes: "Saving sets the selling price on the listing.",
      example: "If you want ₹179, type 179 — do not add GST on top.",
      app: ["consumer"],
    },
    "gst-field": {
      what: "The GST rate that applies to the chosen category.",
      workflow: "Create a new listing → pricing.",
      changes: "Read-only; it comes from the platform's category master.",
      example: "Changing the category changes this rate automatically.",
      app: ["consumer"],
    },
    "stock-input": {
      what: "How many units you have on hand.",
      workflow: "Create a new listing → inventory.",
      changes: "Sets availability; zero hides the listing as out of stock.",
      example: "Enter 24 if you have two dozen strips.",
      app: ["consumer"],
    },
    "submit-button": {
      what: "Submits the listing for review.",
      workflow: "Create a new listing → review.",
      changes: "Creates a PENDING_REVIEW listing and sends it to your district's review queue.",
      example: "Your district admin approves it before shoppers see it.",
      app: ["consumer"],
    },
  }),

  // ── Seller — orders (fulfilment workflow) ─────────────────────────────────
  ...buildPageHints("/seller/orders", {
    "accept-button": {
      what: "Accepts a new order so you can start packing it.",
      workflow: "Order fulfilment: accept → pack → hand over.",
      changes: "Moves the order to PACKED and tells the shopper you are preparing it.",
      example: "Accept within the promise window to protect your health score.",
      app: ["consumer", "delivery"],
    },
    "reject-button": {
      what: "Rejects an order you cannot fulfil.",
      workflow: "Order fulfilment — exception path.",
      changes: "Cancels the order and starts the refund the shopper sees.",
      example: "Use it only when you genuinely cannot supply the items.",
      app: ["consumer"],
    },
  }),

  // ── District — seller KYC (verification workflow) ─────────────────────────
  ...buildPageHints("/admin/district/sellers/:id", {
    "verify-kyc-button": {
      what: "Approves the seller's KYC and activates their shop.",
      workflow: "Seller verification: check documents → verify → activate.",
      changes: "Activates the seller so their listings can go live; audit-logged.",
      example: "Only verify after every document matches the registered name.",
      app: ["portal", "consumer"],
    },
    "reject-button": {
      what: "Rejects the seller's application with a reason.",
      workflow: "Seller verification — exception path.",
      changes: "Blocks the seller and sends the reason to them; audit-logged.",
      example: "Say exactly which document failed so they can fix it.",
      app: ["portal"],
    },
    "doc-row": {
      what: "One uploaded KYC proof (PAN, GSTIN, FSSAI or passbook).",
      workflow: "Seller verification.",
      changes: "Verifying each document records your check against it.",
      example: "Open the passbook image and match the account number to the record.",
      app: ["portal"],
    },
    "fee-input": {
      what: "The seller's platform-fee percentage.",
      workflow: "Seller verification → commercial terms.",
      changes: "Changes the fee deducted from that seller's future payouts.",
      example: "Set 12 to keep 12% commission on their sales.",
      app: ["portal"],
    },
  }),

  // ── District — product review queue ───────────────────────────────────────
  ...buildPageHints("/admin/district/products/queue", {
    "approve-button": {
      what: "Approves a listing so shoppers can see it.",
      workflow: "Catalog review: open a pending listing → approve or reject.",
      changes: "Publishes the listing to the app; audit-logged.",
      example: "Approve once the photo and price look right.",
      app: ["consumer"],
    },
    "reject-button": {
      what: "Rejects a listing with a reason the seller reads.",
      workflow: "Catalog review — exception path.",
      changes: "Keeps the listing out of the app and notifies the seller.",
      example: "Reject a blurry photo and say 'retake on a white background'.",
      app: ["consumer"],
    },
  }),

  // ── Delivery boards (shared across district + super) ──────────────────────
  "pattern:allocation-rider-picker": {
    what: "Picks the rider for an order, sorted by road distance from the store.",
    workflow: "Manual delivery allocation.",
    changes: "Choosing a rider sets who will deliver the order.",
    example: "The top row is usually the closest available rider.",
    app: ["delivery"],
  },
  "pattern:allocation-payout-mode": {
    what: "How the rider will be paid: AUTOMATED (system fare) or MANUAL (you enter it).",
    workflow: "Manual delivery allocation.",
    changes: "Sets the payout method when you allocate the order.",
    example: "Choose MANUAL when you agree a flat fare with the rider.",
    app: ["delivery"],
  },
  "pattern:payout-mark-paid": {
    what: "Records that a rider has been paid.",
    workflow: "Payout settlement.",
    changes: "Marks the payout PAID; it does not move money by itself.",
    example: "Pay the rider in cash, then Mark Paid to record it.",
    app: ["delivery"],
  },

  // ── Shared boards (rider review, fee-change review, account security) ─────
  "pattern:delivery-doc-verify": {
    what: "Marks one rider document as checked and verified.",
    workflow: "Rider onboarding: review documents → verify → activate.",
    changes: "Verifying records your check against that document; audit-logged.",
    example: "Open the licence image, confirm the name, then Verify.",
    app: ["delivery"],
  },
  "pattern:delivery-profile-approve": {
    what: "Approves the rider's profile after their documents pass.",
    workflow: "Rider onboarding.",
    changes: "Moves the rider to VERIFIED, ready for a super admin to activate.",
    example: "Approve once every required document shows VERIFIED.",
    app: ["delivery"],
  },
  "pattern:delivery-activate": {
    what: "Activates a verified rider so they receive delivery jobs.",
    workflow: "Rider onboarding — super admin only.",
    changes: "Puts the rider online for jobs in the delivery app.",
    example: "Activate after the profile is verified.",
    app: ["delivery"],
  },
  "pattern:delivery-suspend": {
    what: "Suspends an active rider with a reason.",
    workflow: "Rider management — exception path.",
    changes: "Removes the rider from new jobs; existing jobs are unaffected.",
    example: "Suspend for repeated failed deliveries and state the reason.",
    app: ["delivery"],
  },
  "pattern:fee-change-approve": {
    what: "Approves a seller's fee-change request and applies the new fee.",
    workflow: "Fee review: open a request → approve or reject.",
    changes: "Applies the requested platform fee to the seller's future payouts.",
    example: "Approve to move the seller from 15% to 12%.",
    app: ["portal"],
  },
  "pattern:fee-change-reject": {
    what: "Rejects a fee-change request with a reason the seller reads.",
    workflow: "Fee review — exception path.",
    changes: "Keeps the current fee and notifies the seller with your reason.",
    example: "Reject and explain the current rate already reflects the category.",
    app: ["portal"],
  },
  "pattern:account-current-password": {
    what: "Your current portal password, used to authorise the change.",
    workflow: "Account security.",
    changes: "Checked by the server on submit; never stored in the browser.",
    example: "Type the password you signed in with.",
    app: ["portal"],
  },
  "pattern:account-new-password": {
    what: "The new password you want to set (at least 12 characters).",
    workflow: "Account security.",
    changes: "On submit, replaces your password and signs out every other device.",
    example: "Use a long, unique passphrase you do not reuse elsewhere.",
    app: ["portal"],
  },
  "pattern:account-submit": {
    what: "Applies the password change.",
    workflow: "Account security.",
    changes: "Rotates the password and revokes all other sessions.",
    example: "After changing, sign in again with the new password.",
    app: ["portal"],
  },

  // ── Role-specific variants ─────────────────────────────────────────────────
  // Keyed "<baseKey>@<ROLE>" so the same control can explain itself differently
  // to each role that can reach it. A SUPER_ADMIN reaches the district seller
  // detail (via admin/super/sellers) and the global delivery boards, where the
  // scope is platform-wide rather than one district.
  "/admin/district/sellers/:id:verify-kyc-button@SUPER_ADMIN": {
    what: "Approves the seller's KYC and activates their shop platform-wide.",
    workflow: "Seller verification: check documents → verify → activate.",
    changes: "Activates the seller so their listings can go live; audit-logged.",
    example: "Only verify after every document matches the registered business name.",
    app: ["portal", "consumer"],
    role: "SUPER_ADMIN",
  },
  "/admin/district/sellers/:id:reject-button@SUPER_ADMIN": {
    what: "Rejects the seller's application with a reason, as a platform-level decision.",
    workflow: "Seller verification — exception path.",
    changes: "Blocks the seller and sends them the reason; audit-logged with your admin identity.",
    example: "Name the exact document that failed so the seller can fix it.",
    app: ["portal"],
    role: "SUPER_ADMIN",
  },
  "/admin/district/sellers/:id:fee-input@SUPER_ADMIN": {
    what: "The seller's platform-fee percentage, set with platform-wide authority.",
    workflow: "Seller verification → commercial terms.",
    changes: "Changes the fee deducted from that seller's future payouts in every district.",
    example: "Set 12 to keep a 12% platform fee on their sales.",
    app: ["portal"],
    role: "SUPER_ADMIN",
  },
  "pattern:allocation-rider-picker@SUPER_ADMIN": {
    what: "Picks the rider for an order, drawn from every district, sorted by road distance.",
    workflow: "Manual delivery allocation (platform-wide).",
    changes: "Choosing a rider sets who will deliver the order, regardless of district.",
    example: "Filter by district first, then pick the closest eligible rider.",
    app: ["delivery"],
    role: "SUPER_ADMIN",
  },
  "pattern:allocation-payout-mode@SUPER_ADMIN": {
    what: "How the rider will be paid: AUTOMATED (system fare) or MANUAL (you enter it).",
    workflow: "Manual delivery allocation (platform-wide).",
    changes: "Sets the payout method for this order across any district.",
    example: "Choose MANUAL when a district agrees a flat fare with the rider.",
    app: ["delivery"],
    role: "SUPER_ADMIN",
  },
  "pattern:payout-mark-paid@SUPER_ADMIN": {
    what: "Records that a rider has been paid, platform-wide.",
    workflow: "Payout settlement (all districts).",
    changes: "Marks the payout PAID in the ledger; no money moves.",
    example: "After paying the rider, Mark Paid to close the payout.",
    app: ["delivery"],
    role: "SUPER_ADMIN",
  },
};

/**
 * Merged component registry: core chrome/patterns + each console's page-scoped
 * entries. Later spread wins, so per-console files may override a core key.
 */
export const COMPONENT_HINTS: Record<string, ComponentHint> = {
  ...CORE_COMPONENT_HINTS,
  ...SELLER_COMPONENT_HINTS,
  ...DISTRICT_COMPONENT_HINTS,
  ...SUPER_COMPONENT_HINTS,
};

/** Expands `{ componentId: hint }` into `{ "<pagePath>:<componentId>": hint }`. */
function buildPageHints(
  pagePath: string,
  hints: Record<string, ComponentHint>,
): Record<string, ComponentHint> {
  const out: Record<string, ComponentHint> = {};
  for (const [id, hint] of Object.entries(hints)) {
    out[`${pagePath}:${id}`] = hint;
  }
  return out;
}

/**
 * Resolves a component hint. `key` is either a global key or a page-scoped key
 * built with `scopedKey()`. When `role` is given, a role-specific variant
 * ("<key>@<ROLE>") wins over the generic entry.
 */
export function componentHint(key: string, role?: Role): ComponentHint | undefined {
  if (role) {
    const roleSpecific = COMPONENT_HINTS[`${key}@${role}`];
    if (roleSpecific) return roleSpecific;
  }
  return COMPONENT_HINTS[key];
}
