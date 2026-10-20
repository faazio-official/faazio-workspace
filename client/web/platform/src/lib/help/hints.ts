/**
 * Plain-language help copy shown behind the small "i" buttons.
 *
 * ROUTE_HINTS keys are pathnames (dynamic segments collapsed to ":id").
 * SECTION_HINTS keys are SectionCard titles, so a section written once gets
 * the same explanation everywhere it appears.
 */

export interface RouteHint {
  /** One line: what this screen is for. */
  what: string;
  /** One line: the next useful action on it. */
  how: string;
}

function normalise(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return clean
    .split("/")
    .map((part) => (/^[a-z]{2,3}-[a-z0-9-]+$/i.test(part) || /^\d+$/.test(part) ? ":id" : part))
    .join("/");
}

export const ROUTE_HINTS: Record<string, RouteHint> = {
  "/seller": {
    what: "Your shop at a glance: today's orders, payouts due, stock warnings and listing health.",
    how: "Start with the alert cards — anything red or amber is costing you orders right now.",
  },
  "/seller/onboarding": {
    what: "The steps Faazio needs before your shop can sell: business details, documents and bank account.",
    how: "Finish every checklist row; each one unlocks the next stage of review.",
  },
  "/seller/products": {
    what: "Every listing you own, with photo, price, stock state and review status.",
    how: "Filter by status to find listings stuck in review, then open one to fix it.",
  },
  "/seller/products/new": {
    what: "A four-step form that creates one listing: category, details and photos, price, then review.",
    how: "Upload at least one clear photo on a white background — listings without photos rarely sell.",
  },
  "/seller/products/:id/edit": {
    what: "Edit an existing listing's photos, description, price and prescription flag.",
    how: "Save changes to send the listing back through review; delete only if you will never restock it.",
  },
  "/seller/pricing": {
    what: "Side-by-side pricing for your catalog with the discount and margin rules applied.",
    how: "Rows flagged against the state median need a price change or an explanation.",
  },
  "/seller/inventory": {
    what: "Stock counts and delivery time for each listing.",
    how: "Type a new quantity or ETA and save the row; anything at or below the low-stock line is highlighted.",
  },
  "/seller/orders": {
    what: "Live orders from the consumer app, newest first.",
    how: "Move an order forward one status at a time — accept, pack, hand over — inside its detail page.",
  },
  "/seller/orders/:id": {
    what: "One order: items, customer promise time, payment state and its full timeline.",
    how: "Use the status buttons as you actually pack and hand over; the customer sees each step.",
  },
  "/seller/returns": {
    what: "Return and refund requests raised against your orders.",
    how: "Approve or reject each request with a reason — the reason reaches the customer.",
  },
  "/seller/payments": {
    what: "What Faazio owes you: settled payouts, commission, taxes and the next payout date.",
    how: "Open a settlement to see the order-level breakdown before you raise a query.",
  },
  "/seller/promotions": {
    what: "Your own discounts plus the festival campaigns you can opt listings into.",
    how: "Opt in products you have real stock for; campaign pricing overrides your normal price.",
  },
  "/seller/ads": {
    what: "Sponsored placements that push your listings up in app search and category rails.",
    how: "Request a slot, set the daily budget, and watch spend against clicks before extending.",
  },
  "/seller/stores": {
    what: "Your shop's addresses, service area, opening hours and delivery promise.",
    how: "Keep hours honest — orders arriving while you are closed hurt your health score.",
  },
  "/seller/analytics": {
    what: "How the shop is performing: revenue, orders, category mix and the funnel from view to order.",
    how: "Switch the date range, then compare category performance to decide what to restock.",
  },
  "/seller/reviews": {
    what: "Customer ratings and written reviews for your listings.",
    how: "Read the low-star reviews first; repeated complaints usually point at one listing.",
  },
  "/seller/settings": {
    what: "Account details, sub-users, notification choices and shop-level preferences.",
    how: "Give staff their own sub-user login instead of sharing yours.",
  },
  "/seller/support": {
    what: "Raise a ticket to Faazio and track the ones already open.",
    how: "Attach the order or listing ID in the ticket — it gets answered far faster.",
  },

  "/admin/state": {
    what: "Command center for your state: supply, demand, escalations and anything waiting on you.",
    how: "Clear the queue counters at the top before moving to growth work.",
  },
  "/admin/state/sellers": {
    what: "Every seller registered in your state with KYC stage and health score.",
    how: "Open a seller to read documents and approve, hold or reject with a reason.",
  },
  "/admin/state/sellers/:id": {
    what: "One seller's profile, documents, bank details, stores and moderation history.",
    how: "Check each document against the registered name before approving.",
  },
  "/admin/state/products": {
    what: "All listings in your state, whatever their status.",
    how: "Search by seller or category to audit a batch, then act from the row.",
  },
  "/admin/state/products/queue": {
    what: "Listings waiting for a first review in your state.",
    how: "Approve or reject each one with a reason; both actions are written to the audit log.",
  },
  "/admin/state/pricing-audit": {
    what: "Listings whose price breaks a rule or sits far from the state median.",
    how: "Work top to bottom — the reasons column tells you which rule tripped.",
  },
  "/admin/state/festival": {
    what: "Festival campaigns running in your state and the sellers who opted in.",
    how: "Create a state campaign, then chase opt-ins from your strongest sellers.",
  },
  "/admin/state/content": {
    what: "The rails and picks shoppers see on the app home screen for your state.",
    how: "Curate a rail from the candidate list; only in-stock, approved listings qualify.",
  },
  "/admin/state/coupons": {
    what: "Coupons valid in your state, with usage and remaining budget.",
    how: "Issue one with a clear cap; watch redemption before widening it.",
  },
  "/admin/state/orders": {
    what: "Live order flow in your state, including late orders and cancellations.",
    how: "Escalations sit at the top — those customers are already waiting.",
  },
  "/admin/state/analytics": {
    what: "State-level GMV, orders, category mix and city split.",
    how: "Compare cities to spot where supply, not demand, is the limit.",
  },
  "/admin/state/audit": {
    what: "Every action taken in your state console, oldest kept, nothing editable.",
    how: "Filter by entity or free text when you need to explain a past decision.",
  },

  "/admin/super": {
    what: "The global command center across all states, sectors and sellers.",
    how: "Scan state and sector health first; drill in where a number breaks the pattern.",
  },
  "/admin/super/state-admins": {
    what: "Admin accounts and which state each one governs.",
    how: "Create an account per state; never share one login across states.",
  },
  "/admin/super/states": {
    what: "Each state's launch status, supply depth and performance side by side.",
    how: "Use the matrix to decide where to open next and where to hold.",
  },
  "/admin/super/sellers": {
    what: "Every seller on the platform, across states.",
    how: "Sort by GMV or health to find both your top partners and the risky ones.",
  },
  "/admin/super/products": {
    what: "The entire catalog with bulk moderation.",
    how: "Select rows, then apply one decision to the whole batch.",
  },
  "/admin/super/festival": {
    what: "National festival campaigns and how states are taking them up.",
    how: "Launch a global campaign, then check opted-in GMV by sector.",
  },
  "/admin/super/sectors": {
    what: "Sectors, their category trees and the caps that govern pricing and commission.",
    how: "Rename or merge categories here; every listing under them follows.",
  },
  "/admin/super/coupons": {
    what: "Platform-wide coupons and their spend.",
    how: "Set a budget cap on every coupon before it goes live.",
  },
  "/admin/super/ads": {
    what: "All sponsored placements and the revenue they bring in.",
    how: "Approve or pause placements; check fill rate before adding new slots.",
  },
  "/admin/super/analytics": {
    what: "Platform metrics: GMV, orders, sector mix, state split and seller concentration.",
    how: "Change the window at the top; concentration above a third of GMV is a risk to flag.",
  },
  "/admin/super/audit": {
    what: "The immutable record of every admin action across all consoles.",
    how: "Filter by actor role or entity when investigating a decision.",
  },
  "/admin/super/coverage": {
    what: "Which consumer app surface is fed by which data source, so nothing ships empty.",
    how: "Any surface without a source will look broken in the app — fix those first.",
  },
  "/admin/super/settings": {
    what: "Platform-level switches: commission, tax, payout schedule and service levels.",
    how: "Changes here apply to every state, so note the reason in the audit log.",
  },
};

export function routeHint(pathname: string): RouteHint | undefined {
  return ROUTE_HINTS[normalise(pathname)];
}

export const SECTION_HINTS: Record<string, string> = {
  "Admin roster": "State admin accounts, newest first. One admin owns one state.",
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
  "Create an admin account": "Grants console access for one state. Choose the state carefully.",
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
  "Settlement ledger": "Each payout, its deductions and its status.",
  "Setup checklist": "Everything still blocking your shop from selling.",
  "Shop analytics": "Your sales, orders and conversion over time.",
  "Shop health": "The score Faazio uses to rank you in the app.",
  "Sponsored slots": "Ad inventory available and how full it is.",
  "State admins": "Who governs which state.",
  "State analytics": "Performance for your state only.",
  "State matrix": "Every state side by side on the same measures.",
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
  "State admins": "Admin accounts governing a state.",
  "States live": "States open to shoppers today.",
  "Surfaces tracked": "App screens this console feeds.",
  TCS: "Tax collected at source, deducted before payout.",
  Views: "Times shoppers opened the listing.",
};

export function metricHint(label: string): string | undefined {
  return METRIC_HINTS[label];
}
