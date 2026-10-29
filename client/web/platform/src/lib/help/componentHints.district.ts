import type { ComponentHint } from "@/lib/help/hints";

/**
 * District-admin console component help, keyed "<pagePath>:<componentId>"
 * (dynamic segments collapsed to ":id"). Merged into COMPONENT_HINTS in hints.ts.
 */
export const DISTRICT_COMPONENT_HINTS: Record<string, ComponentHint> = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  "/admin/district:manage-campaigns-link": {
    what: "Opens the festival campaigns you can create, run and opt sellers into.",
    workflow: "District operations: clear queues → handle escalations → run local campaigns.",
    changes: "Navigation only; it opens the campaign page where a live campaign changes app prices.",
    example: "Tap Manage to launch a Diwali campaign for your district.",
    app: ["consumer"],
  },
  "/admin/district:alerts-list": {
    what: "The alerts feed: seller applications waiting on KYC and orders that breached their SLA.",
    workflow: "Daily operations — clear anything red or amber before growth work.",
    changes: "Read-only; each alert opens the entity where you act on it.",
    example: "'3 seller applications awaiting KYC review' opens the sellers list.",
    app: ["consumer", "delivery"],
  },
  "/admin/district:alert-pending-kyc": {
    what: "Jump to the sellers in your district waiting for KYC verification.",
    workflow: "Seller onboarding and verification.",
    changes: "Navigation only; verifying there activates the seller's shop.",
    example: "Open it, then check each seller's passbook against the registered name.",
    app: ["portal", "consumer"],
  },
  // ── Analytics ─────────────────────────────────────────────────────────────
  "/admin/district/analytics:period-filter": {
    what: "Chooses the reporting window: last 7, 30 or 90 days.",
    workflow: "Reporting — pick a window, then read GMV, orders and category mix.",
    changes: "Only what this page shows; nothing is saved or changed.",
    example: "Switch to 90d to see if a slow month is really a trend.",
    app: ["portal"],
  },
  "/admin/district/analytics:seller-leaderboard": {
    what: "Sellers ranked by GMV in the chosen window, with orders, rating and status.",
    workflow: "Reporting — spot your strongest and weakest sellers, then act on them.",
    changes: "Read-only; use it to decide which seller to open or chase.",
    example: "A top seller gone quiet is worth a call before they churn.",
    app: ["portal"],
  },

  // ── Audit log ─────────────────────────────────────────────────────────────
  "/admin/district/audit:audit-search": {
    what: "Free-text search across the audit log by action, entity id or actor.",
    workflow: "Governance — find the entry that explains a past decision.",
    changes: "Filters what you are reading; the log is never edited.",
    example: "Search a seller id to see every moderation action against them.",
    app: ["portal"],
  },
  "/admin/district/audit:role-filter": {
    what: "Filters the log to actions taken by a specific role.",
    workflow: "Governance — narrow the log to who did what.",
    changes: "Filters what you are reading; nothing is changed.",
    example: "Choose DISTRICT ADMIN to review only your team's actions.",
    app: ["portal"],
  },

  // ── Blood bank ────────────────────────────────────────────────────────────
  "/admin/district/blood:remove-button": {
    what: "Removes a blood request from the public board.",
    workflow: "Blood bank moderation — take down fulfilled, expired or abusive posts.",
    changes: "Deletes the request so it disappears from the board in the app.",
    example: "Remove a request once the units were found.",
    app: ["consumer"],
  },

  // ── Content curation ──────────────────────────────────────────────────────
  "/admin/district/content:rail-title": {
    what: "The heading shoppers see above this home-screen rail.",
    workflow: "Merchandising — build a rail, name it, then publish.",
    changes: "Sets the rail's title; it reaches shoppers only when you publish.",
    example: "Name a rail 'Today's picks' or 'Monsoon essentials'.",
    app: ["consumer"],
  },
  "/admin/district/content:publish-rail": {
    what: "Publishes the rail to the app home screen for your district.",
    workflow: "Merchandising — pick a rail → curate listings → publish.",
    changes: "Publishing changes the home-screen rails shoppers see in the app.",
    example: "Publish a rain-gear rail as the monsoon starts.",
    app: ["consumer"],
  },
  "/admin/district/content:catalog-search": {
    what: "Filters the district's active listings while you build a rail.",
    workflow: "Merchandising — find the right products to add.",
    changes: "Filters the candidate list only; nothing is changed.",
    example: "Search 'umbrella' to find items for a monsoon rail.",
    app: ["portal"],
  },
  "/admin/district/content:add-to-rail": {
    what: "Adds a listing to the rail you are editing.",
    workflow: "Merchandising — build the rail's order from active, in-stock listings.",
    changes: "Adds the product to the draft rail; publish to make it reach shoppers.",
    example: "Add three popular snacks to a 'Quick bites' rail.",
    app: ["consumer"],
  },

  // ── Coupons ───────────────────────────────────────────────────────────────
  "/admin/district/coupons:coupon-code": {
    what: "The code shoppers type at checkout, e.g. MHFEST10.",
    workflow: "Coupon management — issue a district coupon → redeem at checkout.",
    changes: "Sets the coupon's code; it works once you issue it.",
    example: "Use MHDIWALI25 for a Diwali discount in your district.",
    app: ["consumer"],
  },
  "/admin/district/coupons:coupon-sector": {
    what: "Which sector the coupon applies to: Mart, Food or Pharma.",
    workflow: "Coupon management — scope the discount before issuing.",
    changes: "Limits redemption to that sector's orders at checkout.",
    example: "Choose FOOD so the code only works on restaurant orders.",
    app: ["consumer"],
  },
  "/admin/district/coupons:coupon-value": {
    what: "The discount percentage, capped at 50%.",
    workflow: "Coupon management — set the discount before issuing.",
    changes: "Sets how much is taken off the order at checkout.",
    example: "Enter 10 for 10% off.",
    app: ["consumer"],
  },
  "/admin/district/coupons:coupon-cap": {
    what: "The most rupees the coupon can knock off any single order.",
    workflow: "Coupon management — cap the spend before issuing.",
    changes: "Limits the discount per order so a big basket cannot drain the budget.",
    example: "Cap at ₹150 so 10% stops once it reaches ₹150 off.",
    app: ["consumer"],
  },
  "/admin/district/coupons:coupon-valid-till": {
    what: "The last day the coupon can be redeemed.",
    workflow: "Coupon management — set validity before issuing.",
    changes: "After this date the code stops working at checkout.",
    example: "End a Diwali coupon on the day after the festival.",
    app: ["consumer"],
  },
  "/admin/district/coupons:issue-coupon": {
    what: "Creates the district coupon with the code, discount, cap and validity you set.",
    workflow: "Coupon management — issue a coupon → monitor redemption.",
    changes: "An active coupon becomes redeemable by shoppers in your district.",
    example: "Issue MHFEST10 and watch how much of its cap gets used.",
    app: ["consumer"],
  },
  "/admin/district/coupons:toggle-coupon": {
    what: "Retires a live coupon or reactivates a retired one.",
    workflow: "Coupon management — pull a code early or bring it back.",
    changes: "Retiring stops redemption at checkout; reactivating restores it.",
    example: "Retire a code once its budget is nearly spent.",
    app: ["consumer"],
  },

  // ── Customers ─────────────────────────────────────────────────────────────
  "/admin/district/customers:customer-search": {
    what: "Search customers in your district by name or user id.",
    workflow: "Customer support — find a customer, then read their activity trail.",
    changes: "Filters the list only; no customer data is changed.",
    example: "Search a user id from a support ticket to open their record.",
    app: ["portal"],
  },
  "/admin/district/customers:customer-row": {
    what: "Selecting a customer reveals their PII-safe activity trail below.",
    workflow: "Customer support — trace behaviour before acting on a query.",
    changes: "Shows ID-only events (no phone, address or email).",
    example: "Click a customer to see which products they viewed.",
    app: ["consumer"],
  },
  "/admin/district/customers:activity-trail": {
    what: "The customer's behaviour events: product views and actions, ID-only.",
    workflow: "Customer support — read the trail to understand a query.",
    changes: "Read-only; no PII is shown and nothing is changed.",
    example: "See that a customer viewed an item repeatedly before buying.",
    app: ["consumer"],
  },

  // ── Festival campaigns ────────────────────────────────────────────────────
  "/admin/district/festival:campaign-name": {
    what: "The campaign name sellers and shoppers see.",
    workflow: "Campaign management — create a state campaign → approve opt-ins.",
    changes: "Names the campaign; it only runs in your state once live.",
    example: "Call it 'Chennai Pongal Sale'.",
    app: ["consumer"],
  },
  "/admin/district/festival:campaign-banner": {
    what: "The image URL shown on the campaign banner in the app.",
    workflow: "Campaign management — create a state campaign.",
    changes: "Sets the banner shoppers see where the campaign appears.",
    example: "Leave blank to use the Faazio state-festival placeholder.",
    app: ["consumer"],
  },
  "/admin/district/festival:campaign-dates": {
    what: "The start and end dates of the campaign window.",
    workflow: "Campaign management — time-box the campaign.",
    changes: "Campaign pricing only applies between these dates in the app.",
    example: "Run from 12 to 16 January for Pongal.",
    app: ["consumer"],
  },
  "/admin/district/festival:create-campaign": {
    what: "Creates the state campaign as a draft.",
    workflow: "Campaign management — create → schedule → go live.",
    changes: "Adds a DRAFT campaign you must move to LIVE before it affects prices.",
    example: "Create the campaign, then move it LIVE when you are ready.",
    app: ["consumer"],
  },
  "/admin/district/festival:campaign-lifecycle": {
    what: "Moves a state campaign between DRAFT, SCHEDULED, LIVE and ENDED.",
    workflow: "Campaign management — control when the campaign runs.",
    changes: "A LIVE campaign applies campaign prices on opted-in listings.",
    example: "Move SCHEDULED to LIVE on the first day of the festival.",
    app: ["consumer"],
  },
  "/admin/district/festival:approve-optin": {
    what: "Approves a seller's request to join the campaign at their discount.",
    workflow: "Campaign management — review opt-ins against the sector cap.",
    changes: "Adds the listing to the campaign at campaign pricing in the app.",
    example: "Approve once the requested discount sits within the sector cap.",
    app: ["consumer"],
  },
  "/admin/district/festival:reject-optin": {
    what: "Rejects a seller's campaign opt-in.",
    workflow: "Campaign management — exception path for opt-ins over the cap.",
    changes: "Keeps the listing at normal pricing and notifies the seller.",
    example: "Reject an opt-in that asks for more than the sector cap allows.",
    app: ["consumer"],
  },

  // ── Orders ────────────────────────────────────────────────────────────────
  "/admin/district/orders:escalate-button": {
    what: "Flags a breached order and raises the escalation with the seller.",
    workflow: "Order oversight — step in when an order misses its SLA.",
    changes: "Logs the escalation against the order and the seller.",
    example: "Escalate an order that is still NEW well past its promise time.",
    app: ["consumer", "delivery"],
  },
  "/admin/district/orders:escalations-board": {
    what: "Orders that breached their dispatch SLA, oldest first.",
    workflow: "Order oversight — work the late orders before the queue grows.",
    changes: "Read-only feed; escalating an order flags it with the seller.",
    example: "Start at the top; those customers have waited longest.",
    app: ["consumer", "delivery"],
  },

  // ── Pricing audit ─────────────────────────────────────────────────────────
  "/admin/district/pricing-audit:flagged-list": {
    what: "Listings whose price breaks a rule or sits far from the category median.",
    workflow: "Price integrity — review flags, then contact the seller.",
    changes: "Read-only; the flags explain which rule tripped.",
    example: "'Discount above 60%' points at a listing priced too aggressively.",
    app: ["consumer"],
  },
  "/admin/district/pricing-audit:contact-seller": {
    what: "Sends the flagged listing's seller a notice to review their price.",
    workflow: "Price integrity — flag and contact; everyday pricing stays with the seller.",
    changes: "Notifies the seller; it does not change the price itself.",
    example: "Contact the seller of a listing far below the category median.",
    app: ["seller"],
  },

  // ── Catalog moderation ────────────────────────────────────────────────────
  "/admin/district/products:product-search": {
    what: "Search the district catalog by product or id.",
    workflow: "Catalog moderation — find a listing to audit or fix.",
    changes: "Filters the list only; nothing is changed.",
    example: "Search a product id to open its row.",
    app: ["portal"],
  },
  "/admin/district/products:sector-filter": {
    what: "Narrows the catalog to Mart, Food or Pharma.",
    workflow: "Catalog moderation — audit one sector at a time.",
    changes: "Filters the list only; nothing is changed.",
    example: "Pick PHARMA to review only pharmacy listings.",
    app: ["portal"],
  },
  "/admin/district/products:moderate-button": {
    what: "Opens a listing to edit its name or price, or delete it with a reason.",
    workflow: "Catalog moderation — open a listing → edit or remove.",
    changes: "Navigation into the editor; changes apply when you save.",
    example: "Open a listing to correct a wrong price.",
    app: ["consumer"],
  },
  "/admin/district/products:moderation-name": {
    what: "The listing's title as shoppers see it.",
    workflow: "Catalog moderation — fix a listing, then save.",
    changes: "Updates the shopper-facing name when you save.",
    example: "Correct a typo in the product name.",
    app: ["consumer"],
  },
  "/admin/district/products:moderation-price": {
    what: "The listing's selling price in rupees.",
    workflow: "Catalog moderation — fix a listing, then save.",
    changes: "Updates the price shoppers pay when you save.",
    example: "Drop the price to match the seller's written offer.",
    app: ["consumer"],
  },
  "/admin/district/products:moderation-reason": {
    what: "Why you are editing or deleting this listing; required and audit-logged.",
    workflow: "Catalog moderation — every action needs a reason.",
    changes: "Records the justification against your action in the audit log.",
    example: "Write 'price corrected per seller ticket 4821'.",
    app: ["portal"],
  },
  "/admin/district/products:save-changes": {
    what: "Saves the edited name and price back to the live listing.",
    workflow: "Catalog moderation — open a listing → edit → save.",
    changes: "Updates the listing shoppers see and writes the change to the audit log.",
    example: "Save after fixing a mislabelled product.",
    app: ["consumer"],
  },
  "/admin/district/products:delete-listing": {
    what: "Removes the listing from the catalog with your reason.",
    workflow: "Catalog moderation — exception path.",
    changes: "Takes the listing out of the app; the reason is audit-logged.",
    example: "Delete a duplicate listing, noting it as a duplicate.",
    app: ["consumer"],
  },

  // ── Support ───────────────────────────────────────────────────────────────
  "/admin/district/support:ticket-search": {
    what: "Search support tickets by subject or ticket id.",
    workflow: "Support — find a ticket, then update its status as you work it.",
    changes: "Filters the list only; nothing is changed.",
    example: "Search a ticket id quoted in an email.",
    app: ["portal"],
  },
  "/admin/district/support:status-filter": {
    what: "Narrows tickets to OPEN, IN PROGRESS, RESOLVED or CLOSED.",
    workflow: "Support — work the queue in order of age and state.",
    changes: "Filters the list only; nothing is changed.",
    example: "Pick OPEN to see everything still unanswered.",
    app: ["portal"],
  },
  "/admin/district/support:update-status": {
    what: "Moves a ticket to a new status as you resolve it.",
    workflow: "Support — reply, then mark the ticket resolved or closed.",
    changes: "Updates the ticket state the seller or customer sees.",
    example: "Set a ticket to RESOLVED once you have replied.",
    app: ["consumer", "seller"],
  },
};
