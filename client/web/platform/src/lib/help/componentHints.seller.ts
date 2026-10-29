import type { ComponentHint } from "@/lib/help/hints";

/**
 * Seller-console component help, keyed "<pagePath>:<componentId>" (dynamic
 * segments collapsed to ":id"). Merged into COMPONENT_HINTS in hints.ts.
 */
export const SELLER_COMPONENT_HINTS: Record<string, ComponentHint> = {
  // ── /seller — dashboard ────────────────────────────────────────────────────
  "/seller:add-product-button": {
    what: "Opens the new-listing form to add a product to your catalog.",
    workflow: "Catalog creation — start a new listing.",
    changes: "Starts a draft you fill in; nothing is live until you submit it for review.",
    example: "Use it to add 'Paracetamol 500mg' to your shop.",
    app: ["consumer"],
  },
  "/seller:opt-in-products-button": {
    what: "Jumps to Promotions so you can join listings to the running festival campaign.",
    workflow: "Festival promotions — opt products in.",
    changes:
      "Opens the opt-in page; a discount applies only after you submit and an admin approves.",
    example: "Tap it while 'Diwali' is live to put your best sellers in the festival rail.",
    app: ["consumer"],
  },
  "/seller:setup-checklist": {
    what: "The remaining setup steps blocking your shop from full selling.",
    workflow: "Seller onboarding — complete setup.",
    changes: "Read-only; each open row points at the page that completes it.",
    example: "'First 5 products listed' clears once you have five listings.",
    app: ["portal", "consumer"],
  },
  "/seller:top-products": {
    what: "Your best listings by quality and price band, each with its live status.",
    workflow: "Catalog review — spot what to promote or fix.",
    changes: "Read-only; open a listing on the products page to edit it.",
    example: "A PENDING_REVIEW badge means it cannot sell until a district admin approves.",
    app: ["consumer"],
  },
  "/seller:alerts": {
    what: "Orders waiting to be dispatched, with a one-tap link to each.",
    workflow: "Order fulfilment — clear the dispatch queue.",
    changes: "Read-only; 'Open' takes you to the order so you can move it forward.",
    example: "'ORD-1042 awaits dispatch' links straight to that order.",
    app: ["consumer", "delivery"],
  },

  // ── /seller/ads ────────────────────────────────────────────────────────────
  "/seller/ads:campaign-wizard": {
    what: "The five-step wizard for a new hero campaign: what to promote, where, the creative, when, then review.",
    workflow: "Advertising — buy extra visibility for a listing.",
    changes: "Publishing goes live instantly on the placements you pick; it is machine-checked, not admin-approved.",
    example: "Promote a top product on the product-detail hero for 30 days.",
    app: ["consumer"],
  },
  "/seller/ads:my-campaigns": {
    what: "Your hero ad campaigns with impressions, clicks, CTR and orders attributed.",
    workflow: "Advertising — measure what you bought.",
    changes: "Read-only; publish a new campaign from the wizard above.",
    example: "A high CTR means the creative is working.",
    app: ["consumer"],
  },
  "/seller/ads:product-rails": {
    what: "Your sponsored rail placements, with the same performance columns.",
    workflow: "Advertising — measure rail spend.",
    changes: "Read-only; rail slots are requested from the placement picker.",
    example: "Watch CTR before extending a slot.",
    app: ["consumer"],
  },

  // ── /seller/analytics ──────────────────────────────────────────────────────
  "/seller/analytics:period-filter": {
    what: "Switches the reporting window between the last 7, 30 or 90 days.",
    workflow: "Reporting — choose the period you are analysing.",
    changes: "Recomputes every metric and chart on the page; nothing is saved.",
    example: "Pick '7d' to see this week's sales after a campaign.",
    app: ["portal"],
  },
  "/seller/analytics:revenue-trend": {
    what: "Gross sales per day over the chosen window.",
    workflow: "Reporting — read the shape of your sales.",
    changes: "Read-only; hover a point for the exact value.",
    example: "A rising line with flat orders usually means bigger baskets.",
    app: ["portal"],
  },
  "/seller/analytics:conversion-funnel": {
    what: "How shoppers moved from viewing a listing to placing an order.",
    workflow: "Reporting — find where views drop off.",
    changes: "Read-only; the biggest drop is the step worth fixing.",
    example: "Many views but few carts points at price or photos.",
    app: ["portal"],
  },
  "/seller/analytics:product-performance": {
    what: "Each listing's views, orders, conversion and GMV, best sellers first.",
    workflow: "Reporting — decide what to restock or drop.",
    changes: "Read-only; insights lead to edits on catalog, pricing or inventory.",
    example: "A listing with views but no orders needs a price or photo change.",
    app: ["portal"],
  },

  // ── /seller/inventory ──────────────────────────────────────────────────────
  "/seller/inventory:bulk-qty-input": {
    what: "A quantity to write to every listing at once.",
    workflow: "Stock maintenance — bulk update.",
    changes: "Nothing until you press Apply; it only holds the value you type here.",
    example: "Type 50 to top every listing up to fifty units.",
    app: ["consumer"],
  },
  "/seller/inventory:bulk-apply-button": {
    what: "Sets the entered quantity on all your listings.",
    workflow: "Stock maintenance — bulk update.",
    changes: "Overwrites every listing's stock in one action.",
    example: "Apply 50 after a fresh restock of the whole catalog.",
    app: ["consumer"],
  },
  "/seller/inventory:qty-column": {
    what: "Units on hand for a listing.",
    workflow: "Stock maintenance — per-listing edit.",
    changes: "Saving a quantity changes availability in the app; zero shows out of stock.",
    example: "Set 0 when you have sold out so shoppers stop ordering it.",
    app: ["consumer"],
  },
  "/seller/inventory:eta-column": {
    what: "The delivery time you promise for that listing, in minutes.",
    workflow: "Stock maintenance — per-listing edit.",
    changes: "Saving updates the ETA shoppers see at checkout.",
    example: "Enter 30 for a 30-minute delivery promise.",
    app: ["consumer", "delivery"],
  },
  "/seller/inventory:save-column": {
    what: "Saves the quantity and ETA for that row.",
    workflow: "Stock maintenance — per-listing edit.",
    changes: "Writes the row's stock and ETA to the app immediately.",
    example: "Change quantity to 12 and Save to publish it.",
    app: ["consumer"],
  },

  // ── /seller/menus ──────────────────────────────────────────────────────────
  "/seller/menus:add-dish-button": {
    what: "Opens the form to add a new dish to your menu.",
    workflow: "Menu management — add a dish.",
    changes: "Creates a draft dish; it is not orderable until submitted and approved.",
    example: "Add 'Paneer Tikka' to your restaurant's menu.",
    app: ["consumer"],
  },
  "/seller/menus:search-input": {
    what: "Filters the dish list by name or dish id.",
    workflow: "Finding a dish.",
    changes: "Re-filters the table; nothing is changed.",
    example: "Type 'tikka' to find that dish.",
    app: ["portal"],
  },
  "/seller/menus:status-filter": {
    what: "Filters the menu by status (DRAFT, PENDING_REVIEW, ACTIVE, DELISTED).",
    workflow: "Menu management — find dishes by state.",
    changes: "Re-filters the list; nothing is changed.",
    example: "Pick 'PENDING_REVIEW' to see dishes awaiting a district admin.",
    app: ["portal"],
  },
  "/seller/menus:price-input": {
    what: "The selling price shoppers pay for the dish.",
    workflow: "Menu management — price a dish.",
    changes: "Saving sets the dish price in the app.",
    example: "Enter 220 for a ₹220 dish.",
    app: ["consumer"],
  },
  "/seller/menus:mrp-input": {
    what: "An optional list price shown struck through against your price.",
    workflow: "Menu management — show an offer.",
    changes: "Saving shows the strike-through MRP in the app; it must be at or above the price.",
    example: "MRP 260 with price 220 shows the saving.",
    app: ["consumer"],
  },
  "/seller/menus:veg-switch": {
    what: "Marks the dish vegetarian or not.",
    workflow: "Menu management — dish detail.",
    changes: "Saving shows the veg / non-veg marker in the app.",
    example: "Turn it off for a chicken dish.",
    app: ["consumer"],
  },
  "/seller/menus:save-dish-button": {
    what: "Saves or creates the dish.",
    workflow: "Menu management — add or edit a dish.",
    changes: "Writes the dish; a new dish stays draft until you submit it for review.",
    example: "Create the dish, then use Submit to send it for review.",
    app: ["consumer"],
  },
  "/seller/menus:row-actions": {
    what: "The actions for one dish: edit its details, submit a draft, delist a live dish or remove it.",
    workflow: "Menu management — advance or retire a dish.",
    changes:
      "Submit sends a draft to review; Delist hides a live dish; Remove deletes it from your menu.",
    example: "Submit a DRAFT dish to send it to your district admin for approval.",
    app: ["consumer"],
  },

  // ── /seller/onboarding ─────────────────────────────────────────────────────
  "/seller/onboarding:sector-select": {
    what: "The primary sector the shop sells under: MART, FOOD or PHARMA.",
    workflow: "Seller onboarding — business details.",
    changes: "Sets your sub-app; it is fixed once the application is approved.",
    example: "Choose PHARMA for a pharmacy.",
    app: ["consumer"],
  },
  "/seller/onboarding:gstin-input": {
    what: "Your business GST number, checked against a strict format.",
    workflow: "Seller onboarding — business details.",
    changes: "Must match the 15-character GSTIN pattern before you can continue.",
    example: "27AABCU9603R1ZM.",
    app: ["portal"],
  },
  "/seller/onboarding:attach-docs-button": {
    what: "Attaches a KYC proof (GSTIN certificate, PAN, bank proof, shop licence).",
    workflow: "Seller onboarding — KYC documents.",
    changes: "Marks documents as attached so you can move on to the bank step.",
    example: "Attach your PAN card scan.",
    app: ["portal"],
  },
  "/seller/onboarding:bank-input": {
    what: "The account number and IFSC payouts are sent to.",
    workflow: "Seller onboarding — bank details.",
    changes: "Becomes the payout destination once a district admin verifies it.",
    example: "Enter your account number and 11-character IFSC.",
    app: ["portal"],
  },
  "/seller/onboarding:state-select": {
    what: "The state your store operates in.",
    workflow: "Seller onboarding — store details.",
    changes: "Decides your district admin and the campaigns you can join.",
    example: "Choose MH for a Mumbai store.",
    app: ["consumer"],
  },
  "/seller/onboarding:submit-button": {
    what: "Submits the finished application for KYC review.",
    workflow: "Seller onboarding — submit.",
    changes: "Sends the application into your district admin's verification queue.",
    example: "Submit once all documents and bank details are in.",
    app: ["portal", "consumer"],
  },
  "/seller/onboarding:esign-switch": {
    what: "The e-sign confirmation that your details are accurate and you accept the partner terms.",
    workflow: "Seller onboarding — final step.",
    changes: "Must be switched on before Submit is enabled; it records your agreement.",
    example: "Turn it on only after checking the business, bank and store details.",
    app: ["portal"],
  },

  // ── /seller/orders/:id ─────────────────────────────────────────────────────
  "/seller/orders/:id:accept-button": {
    what: "Accepts the order so you can start packing it.",
    workflow: "Order fulfilment: accept → pack → hand over.",
    changes: "Moves the order to PACKED and notifies the shopper.",
    example: "Accept within the SLA window to protect your health score.",
    app: ["consumer", "delivery"],
  },
  "/seller/orders/:id:reject-button": {
    what: "Rejects an order you cannot fulfil, with a reason.",
    workflow: "Order fulfilment — exception path.",
    changes: "Cancels the order and starts the shopper's refund.",
    example: "Use it only when you truly cannot supply the items.",
    app: ["consumer"],
  },
  "/seller/orders/:id:advance-button": {
    what: "Moves the order to its next stage (packed, shipped, delivered).",
    workflow: "Order fulfilment: accept → pack → hand over.",
    changes: "Updates the shopper's tracking and the rider's job in the delivery app.",
    example: "Mark PACKED once the items are boxed.",
    app: ["consumer", "delivery"],
  },

  // ── /seller/payments ───────────────────────────────────────────────────────
  "/seller/payments:print-statement-button": {
    what: "Prints or saves the current payout statement.",
    workflow: "Payouts — keep a record.",
    changes: "Opens the browser print dialog; no data is changed.",
    example: "Print the ledger before filing your accounts.",
    app: ["portal"],
  },
  "/seller/payments:settlement-ledger": {
    what: "Each settlement cycle's order value and the TCS, TDS and GST deducted.",
    workflow: "Payouts — check a cycle's breakdown.",
    changes: "Read-only; use it to explain a lower net payout.",
    example: "A large TDS column explains why net is below gross.",
    app: ["portal"],
  },
  "/seller/payments:payout-schedule": {
    what: "Upcoming payouts with their cycle, date, amount and status.",
    workflow: "Payouts — know when money arrives.",
    changes: "Read-only; a PENDING row has not left Faazio yet.",
    example: "A PAID row means the transfer has been sent.",
    app: ["portal"],
  },

  // ── /seller/prescriptions ──────────────────────────────────────────────────
  "/seller/prescriptions:open-button": {
    what: "Opens a prescription so you can price and fulfil it.",
    workflow: "Rx fulfilment — work one prescription.",
    changes: "Opens the quote panel; nothing is changed until you save.",
    example: "Open an Rx to add its priced lines.",
    app: ["portal"],
  },
  "/seller/prescriptions:view-images": {
    what: "Loads the customer's private prescription scans from secure storage.",
    workflow: "Rx fulfilment — read the prescription.",
    changes: "Read-only; the images stay private and the view is audited.",
    example: "Check the dosage on the scan before quoting.",
    app: ["portal"],
  },
  "/seller/prescriptions:add-item-button": {
    what: "Adds another priced line to the quote.",
    workflow: "Rx fulfilment — quote lines.",
    changes: "Adds a blank row you fill with item, qty, MRP, price and discount.",
    example: "Add a second medicine to the same quote.",
    app: ["consumer"],
  },
  "/seller/prescriptions:save-quote-button": {
    what: "Saves the priced lines against the prescription.",
    workflow: "Rx fulfilment — quote lines.",
    changes: "Stores the quote total the customer will pay.",
    example: "Save a ₹540 quote before marking it ready.",
    app: ["consumer"],
  },
  "/seller/prescriptions:mark-ready-button": {
    what: "Marks the prescription READY and reveals the customer's contact details.",
    workflow: "Rx fulfilment — ready for fulfilment.",
    changes: "Notifies the shopper and unmasks their phone and address; the reveal is audited.",
    example: "Mark READY only once the quote is final.",
    app: ["consumer"],
  },
  "/seller/prescriptions:process-button": {
    what: "Moves the prescription into processing.",
    workflow: "Rx fulfilment — start packing.",
    changes: "Sets the status to PROCESSING so you can pick and pack the quoted items.",
    example: "Process a RECEIVED or QUOTED Rx once the quote is agreed.",
    app: ["consumer"],
  },
  "/seller/prescriptions:fulfil-button": {
    what: "Marks a READY prescription as fulfilled.",
    workflow: "Rx fulfilment — completion.",
    changes: "Closes the prescription and records the customer payment.",
    example: "Fulfil after handing over the packed medicines.",
    app: ["consumer"],
  },
  "/seller/prescriptions:cancel-button": {
    what: "Cancels the prescription and records the reason.",
    workflow: "Rx fulfilment — exception path.",
    changes: "Stops the request and notifies the shopper.",
    example: "Cancel when an item on the Rx is unavailable.",
    app: ["consumer"],
  },

  // ── /seller/pricing ────────────────────────────────────────────────────────
  "/seller/pricing:mass-cut-input": {
    what: "A percentage to cut every listing's price by.",
    workflow: "Pricing — bulk discount.",
    changes: "Nothing until you press Apply to all.",
    example: "Enter 5 to take 5% off every listing.",
    app: ["consumer"],
  },
  "/seller/pricing:apply-to-all-button": {
    what: "Applies the mass-cut percentage wherever the price floor allows.",
    workflow: "Pricing — bulk discount.",
    changes: "Lowers every eligible listing's price and writes it to the app.",
    example: "Apply a 5% cut across the catalog.",
    app: ["consumer"],
  },
  "/seller/pricing:mrp-input": {
    what: "The list price (MRP) for that listing.",
    workflow: "Pricing — per-listing edit.",
    changes: "Saving sets the strike-through price shoppers see.",
    example: "MRP 200 with price 160 shows 20% off.",
    app: ["consumer"],
  },
  "/seller/pricing:price-input": {
    what: "The actual selling price shoppers pay for that listing.",
    workflow: "Pricing — per-listing edit.",
    changes: "Saving changes the price in the app; a red border means a pricing rule is broken.",
    example: "Enter 160 for a ₹160 shelf price.",
    app: ["consumer"],
  },
  "/seller/pricing:save-price-button": {
    what: "Saves that row's MRP and price.",
    workflow: "Pricing — per-listing edit.",
    changes: "Writes the price and logs the change in the price history.",
    example: "Fix a flagged row and Save to clear the rule.",
    app: ["consumer"],
  },

  // ── /seller/products ───────────────────────────────────────────────────────
  "/seller/products:add-product-button": {
    what: "Opens the four-step form to create a new listing.",
    workflow: "Catalog creation.",
    changes: "Starts a listing that goes for review when you submit it.",
    example: "Add a new product to your shop.",
    app: ["consumer"],
  },
  "/seller/products:bulk-upload-button": {
    what: "Opens the bulk CSV upload to add many listings at once.",
    workflow: "Catalog creation — batch.",
    changes: "Imports a sheet of listings; each still goes through review.",
    example: "Upload your full stock list as a CSV.",
    app: ["consumer"],
  },
  "/seller/products:search-input": {
    what: "Filters listings by product name or product id.",
    workflow: "Finding a listing.",
    changes: "Re-filters the table; nothing is changed.",
    example: "Search 'paracetamol' to find that listing.",
    app: ["portal"],
  },
  "/seller/products:sector-filter": {
    what: "Filters listings by sub-app (MART, FOOD, PHARMA).",
    workflow: "Finding a listing.",
    changes: "Re-filters the list; nothing is changed.",
    example: "Pick PHARMA to see only pharmacy listings.",
    app: ["portal"],
  },
  "/seller/products:status-filter": {
    what: "Filters listings by review status (ACTIVE, PENDING_REVIEW, DELISTED).",
    workflow: "Catalog — find listings by state.",
    changes: "Re-filters the list; nothing is changed.",
    example: "Pick PENDING_REVIEW to find listings stuck in review.",
    app: ["portal"],
  },
  "/seller/products:load-more-button": {
    what: "Loads the next ten listings into the table.",
    workflow: "Browsing the catalog.",
    changes: "Shows more rows; nothing is changed.",
    example: "Tap it to page through a long catalog.",
    app: ["portal"],
  },
  "/seller/products:row-actions": {
    what: "Opens a listing's edit page to change its photos, details and price.",
    workflow: "Catalog maintenance — fix or refresh a listing.",
    changes: "Read-only here; opening it takes you to the form where edits are saved.",
    example: "Open a PENDING_REVIEW listing to fix why it was rejected.",
    app: ["consumer"],
  },

  // ── /seller/products/:id/edit ──────────────────────────────────────────────
  "/seller/products/:id/edit:name-input": {
    what: "The product name shoppers see on cards and in search.",
    workflow: "Catalog maintenance — edit a listing.",
    changes: "Saving updates the listing title in the app.",
    example: "Rename 'Tablets' to 'Paracetamol 500mg'.",
    app: ["consumer"],
  },
  "/seller/products/:id/edit:description-input": {
    what: "A short description of the product.",
    workflow: "Catalog maintenance — edit a listing.",
    changes: "Saving updates the text on the product page.",
    example: "Mention pack size and strength.",
    app: ["consumer"],
  },
  "/seller/products/:id/edit:price-input": {
    what: "The final price shoppers pay; GST is included.",
    workflow: "Catalog maintenance — price a listing.",
    changes: "Saving sets the shelf price in the app.",
    example: "Type 179 for ₹179.",
    app: ["consumer"],
  },
  "/seller/products/:id/edit:rx-switch": {
    what: "Marks the listing as needing a prescription.",
    workflow: "Catalog maintenance — listing detail.",
    changes: "Saving makes shoppers attach a valid prescription before ordering.",
    example: "Turn it on for a scheduled medicine.",
    app: ["consumer"],
  },
  "/seller/products/:id/edit:delete-button": {
    what: "Permanently deletes this listing.",
    workflow: "Catalog maintenance — remove a listing.",
    changes: "Removes it from the app immediately; the action is audit-logged.",
    example: "Delete a discontinued product you will never restock.",
    app: ["consumer"],
  },
  "/seller/products/:id/edit:save-button": {
    what: "Saves all edits to the listing and its price.",
    workflow: "Catalog maintenance — save changes.",
    changes: "Updates the shopper-facing listing; material edits may re-enter review.",
    example: "Save after fixing the photo and price.",
    app: ["consumer"],
  },

  // ── /seller/promotions ─────────────────────────────────────────────────────
  "/seller/promotions:campaign-select": {
    what: "Chooses which festival campaign you are viewing and joining.",
    workflow: "Promotions — join a campaign.",
    changes: "Switches the opt-in table to that campaign; nothing is saved.",
    example: "Pick 'Diwali' to opt products into it.",
    app: ["consumer"],
  },
  "/seller/promotions:discount-input": {
    what: "The discount percentage you offer on that listing for the campaign.",
    workflow: "Promotions — set an opt-in discount.",
    changes: "Saving (Opt in) sets the campaign price, capped by the sector limit.",
    example: "Enter 10 to offer 10% off during the campaign.",
    app: ["consumer"],
  },
  "/seller/promotions:optin-button": {
    what: "Submits or updates the listing's opt-in for the campaign.",
    workflow: "Promotions — join a campaign.",
    changes: "Sends the opt-in for district approval; the price applies once approved.",
    example: "Opt in your top seller at 10% off.",
    app: ["consumer"],
  },

  // ── /seller/returns ────────────────────────────────────────────────────────
  "/seller/returns:approve-button": {
    what: "Approves a return and refunds the order value.",
    workflow: "After-sales — resolve a return.",
    changes: "Approves the refund, taken from your next settlement cycle.",
    example: "Approve a damaged-in-transit return.",
    app: ["consumer"],
  },
  "/seller/returns:reject-button": {
    what: "Rejects a return request and records a reason.",
    workflow: "After-sales — exception path.",
    changes: "Denies the refund and keeps your reason on the request.",
    example: "Reject a return raised outside the return window.",
    app: ["consumer"],
  },

  // ── /seller/reviews ────────────────────────────────────────────────────────
  "/seller/reviews:reply-input": {
    what: "Your public reply to a shopper's review.",
    workflow: "Reputation — respond to feedback.",
    changes: "Nothing until you send it.",
    example: "Thank the shopper or explain the fix.",
    app: ["consumer"],
  },
  "/seller/reviews:send-reply-button": {
    what: "Publishes your reply under the review.",
    workflow: "Reputation — respond to feedback.",
    changes: "Shows the reply publicly in the app.",
    example: "Send a reply to a 2-star review.",
    app: ["consumer"],
  },
  "/seller/reviews:flag-button": {
    what: "Reports the review to an admin for moderation.",
    workflow: "Reputation — report a review.",
    changes: "Sends it to the admin moderation queue for review.",
    example: "Flag a review that is spam or abusive.",
    app: ["portal"],
  },

  // ── /seller/settings ───────────────────────────────────────────────────────
  "/seller/settings:profile-tabs": {
    what: "Switches between your profile, bank, notifications and sub-users.",
    workflow: "Account administration.",
    changes: "Opens the chosen tab; nothing is saved.",
    example: "Open 'Sub-users' to add staff logins.",
    app: ["portal"],
  },
  "/seller/settings:request-update-button": {
    what: "Sends your edited business-profile changes for verification.",
    workflow: "Account administration — profile.",
    changes: "Queues the change for a district admin to re-verify against your KYC.",
    example: "Request an update after changing your GSTIN.",
    app: ["portal"],
  },
  "/seller/settings:notify-switches": {
    what: "Toggles which events alert you (new orders, low stock, SLA, campaigns).",
    workflow: "Account administration — notifications.",
    changes: "Changes which alerts and emails you receive.",
    example: "Turn off campaign news if you find it noisy.",
    app: ["portal"],
  },
  "/seller/settings:sub-user-email-input": {
    what: "The email a staff sub-user logs in with.",
    workflow: "Account administration — sub-users.",
    changes: "Becomes the new sub-user's login once invited.",
    example: "staff@myshop.com.",
    app: ["portal"],
  },
  "/seller/settings:invite-button": {
    what: "Invites the named sub-user to your account.",
    workflow: "Account administration — sub-users.",
    changes: "Creates a scoped login with limited access to orders and inventory.",
    example: "Invite your store manager.",
    app: ["portal"],
  },

  // ── /seller/stores ─────────────────────────────────────────────────────────
  "/seller/stores:hours-input": {
    what: "Your opening hours shown on the store profile.",
    workflow: "Store profile — set hours.",
    changes: "Saving updates the hours shoppers see; orders taken while closed hurt your score.",
    example: "Set 10:00 AM - 9:30 PM.",
    app: ["consumer"],
  },
  "/seller/stores:delivery-input": {
    what: "The delivery time you promise for this store.",
    workflow: "Store profile — delivery promise.",
    changes: "Saving updates the ETA shoppers see at checkout.",
    example: "Set 45 min.",
    app: ["consumer", "delivery"],
  },
  "/seller/stores:live-switch": {
    what: "Turns the store live or paused in the app.",
    workflow: "Store profile — availability.",
    changes: "Saves immediately and hides or shows the store to shoppers.",
    example: "Pause the store during a refit.",
    app: ["consumer"],
  },
  "/seller/stores:veg-switch": {
    what: "Marks the whole store as pure vegetarian.",
    workflow: "Store profile — store type.",
    changes: "Saves immediately and shows the pure-veg badge in the app.",
    example: "Turn it on for a vegetarian-only kitchen.",
    app: ["consumer"],
  },
  "/seller/stores:save-store-button": {
    what: "Saves the store's opening hours and delivery time.",
    workflow: "Store profile — save changes.",
    changes: "Writes the profile shoppers and riders rely on.",
    example: "Save after updating holiday hours.",
    app: ["consumer"],
  },

  // ── /seller/support ────────────────────────────────────────────────────────
  "/seller/support:subject-input": {
    what: "A one-line summary of your issue.",
    workflow: "Support — raise a ticket.",
    changes: "Nothing until you submit; four characters minimum.",
    example: "'Payout for cycle 12 missing'.",
    app: ["portal"],
  },
  "/seller/support:body-input": {
    what: "The detail of what happened, ideally with the order or listing id.",
    workflow: "Support — raise a ticket.",
    changes: "Nothing until you submit; eight characters minimum.",
    example: "Include 'ORD-1042' so support can find it fast.",
    app: ["portal"],
  },
  "/seller/support:submit-ticket-button": {
    what: "Raises the ticket into Faazio's support queue.",
    workflow: "Support — submit a ticket.",
    changes: "Creates a NEW ticket routed by your state.",
    example: "Submit after writing up the issue.",
    app: ["portal"],
  },
};
