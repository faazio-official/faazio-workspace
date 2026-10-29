import type { ComponentHint } from "@/lib/help/hints";

/**
 * Super-admin console component help, keyed "<pagePath>:<componentId>"
 * (dynamic segments collapsed to ":id"). Merged into COMPONENT_HINTS in hints.ts.
 */

/** Expands `{ componentId: hint }` into `{ "<pagePath>:<componentId>": hint }`. */
function pageHints(
  pagePath: string,
  hints: Record<string, ComponentHint>,
): Record<string, ComponentHint> {
  const out: Record<string, ComponentHint> = {};
  for (const [id, hint] of Object.entries(hints)) {
    out[`${pagePath}:${id}`] = hint;
  }
  return out;
}

export const SUPER_COMPONENT_HINTS: Record<string, ComponentHint> = {
  // ── Command center ─────────────────────────────────────────────────────────
  ...pageHints("/admin/super", {
    "district-filter": {
      what: "Toggles the district matrix between every district and only those with no active admin.",
      workflow: "Global operations — spot districts that need an admin.",
      changes: "Re-filters the matrix; nothing is changed.",
      example: "Choose 'Uncovered only' to list the districts missing an admin.",
      app: ["portal"],
    },
    "festival-overview": {
      what: "A snapshot of festival campaigns and the status each one is in.",
      workflow: "Campaign oversight — see which festivals are running.",
      changes: "Read-only; the Governance link opens where you launch or end a campaign.",
      example: "A DRAFT campaign still needs scheduling before shoppers see it.",
      app: ["consumer"],
    },
    "system-alerts": {
      what: "Platform problems needing attention: districts with no admin and open seller applications.",
      workflow: "Daily operations — clear the red items first.",
      changes: "Read-only; each alert links to the page where you fix it.",
      example: "A district with zero active admins links to the roster to create one.",
      app: ["portal"],
    },
  }),

  // ── Ads live monitor ───────────────────────────────────────────────────────
  ...pageHints("/admin/super/ads", {
    "takedown-button": {
      what: "Removes a live hero campaign from the app after an abuse report.",
      workflow: "Ad moderation — police sponsored creatives.",
      changes: "Marks the campaign REJECTED and hides it from shoppers immediately.",
      example: "Take down a campaign with a misleading claim and give the reason.",
      app: ["consumer"],
    },
    "restore-button": {
      what: "Puts a taken-down hero campaign back live after review.",
      workflow: "Ad moderation — clear a campaign that was wrongly flagged.",
      changes: "Marks the campaign LIVE so it shows in the app again.",
      example: "Restore a campaign once you confirm the complaint was unfounded.",
      app: ["consumer"],
    },
    "approve-placement": {
      what: "Approves a seller's rail-placement request so it can run.",
      workflow: "Ad moderation — clear queued placement requests.",
      changes: "Marks the slot APPROVED; the boosted listing can appear on the rail.",
      example: "Approve a placement whose creative and budget look correct.",
      app: ["consumer"],
    },
    "reject-placement": {
      what: "Declines a seller's rail-placement request.",
      workflow: "Ad moderation — turn down slots that break the rules.",
      changes: "Marks the slot REJECTED; the seller sees the decision.",
      example: "Reject a placement targeting a category it does not belong to.",
      app: ["consumer"],
    },
  }),

  // ── Global analytics ───────────────────────────────────────────────────────
  ...pageHints("/admin/super/analytics", {
    "period-filter": {
      what: "Switches the reporting window between 7, 30 and 90 days.",
      workflow: "Reporting — read platform performance over the window you need.",
      changes: "Re-computes every KPI and chart; nothing is changed.",
      example: "Pick 90d to read seller concentration over a quarter.",
      app: ["portal"],
    },
    "seller-concentration": {
      what: "Ranks sellers by GMV and shows each one's share of the platform.",
      workflow: "Reporting — watch concentration risk.",
      changes: "Read-only; a rising top-10 share means fewer sellers carry more sales.",
      example: "A top seller above a third of GMV is worth flagging to growth.",
      app: ["portal"],
    },
    "category-performance": {
      what: "Catalogue value grouped by category, highest first.",
      workflow: "Reporting — see which categories hold the most value.",
      changes: "Read-only; it counts catalogue value, not sales.",
      example: "Use it to spot a category with many listings but little revenue.",
      app: ["portal"],
    },
  }),

  // ── Audit log ──────────────────────────────────────────────────────────────
  ...pageHints("/admin/super/audit", {
    "audit-search": {
      what: "Free-text search across the action, entity id and actor.",
      workflow: "Governance — find the entry that explains a past decision.",
      changes: "Filters the log; nothing is changed.",
      example: "Type an order id to see every action recorded against it.",
      app: ["portal"],
    },
    "role-filter": {
      what: "Narrows the log to actions taken by one actor role.",
      workflow: "Governance — trace who did what.",
      changes: "Filters the log by role; nothing is changed.",
      example: "Pick SUPER_ADMIN to see only platform-wide changes.",
      app: ["portal"],
    },
    "entity-filter": {
      what: "Narrows the log to one kind of record (order, seller, product…).",
      workflow: "Governance — investigate a record type.",
      changes: "Filters the log by entity; nothing is changed.",
      example: "Choose 'seller' to see every seller-related action.",
      app: ["portal"],
    },
  }),

  // ── Coupons ────────────────────────────────────────────────────────────────
  ...pageHints("/admin/super/coupons", {
    "coupon-code": {
      what: "The checkout code shoppers type; stored uppercase.",
      workflow: "Coupon authority — issue a global discount.",
      changes: "Sets the code; the coupon is created only when you press Issue coupon.",
      example: "Enter FEST25 for a festival offer.",
      app: ["consumer"],
    },
    "coupon-sector": {
      what: "Restricts the coupon to one sub-app, or leaves it open to all sectors.",
      workflow: "Coupon authority — scope the discount.",
      changes: "Decides which app surfaces honour the coupon.",
      example: "Choose PHARMA so only medicines get the discount.",
      app: ["consumer"],
    },
    "coupon-value": {
      what: "The discount as a percentage of the cart (maximum 50%).",
      workflow: "Coupon authority — set the discount size.",
      changes: "Sets the percentage applied at checkout.",
      example: "Enter 15 for a 15% off coupon.",
      app: ["consumer"],
    },
    "coupon-cap": {
      what: "The most rupees the coupon can knock off a single order.",
      workflow: "Coupon authority — cap the spend per order.",
      changes: "Limits the discount per order, protecting against large baskets.",
      example: "Set ₹300 so a 15% coupon never exceeds that.",
      app: ["consumer"],
    },
    "coupon-validity": {
      what: "The last date the coupon can be redeemed.",
      workflow: "Coupon authority — bound the offer window.",
      changes: "Sets the expiry; the coupon stops working after it.",
      example: "Set it to the last day of the festival.",
      app: ["consumer"],
    },
    "issue-coupon-button": {
      what: "Creates the coupon and makes it redeemable platform-wide.",
      workflow: "Coupon authority — publish a global coupon.",
      changes: "Adds an active coupon shoppers can use in every state.",
      example: "Issue after confirming the code, cap and validity.",
      app: ["consumer"],
    },
    "toggle-coupon": {
      what: "Retires or reactivates a coupon without deleting it.",
      workflow: "Coupon authority — end or revive an offer.",
      changes: "Retiring stops redemption; reactivating restores it.",
      example: "Retire a coupon that has spent its budget.",
      app: ["consumer"],
    },
  }),

  // ── Coverage ───────────────────────────────────────────────────────────────
  ...pageHints("/admin/super/coverage", {
    "coverage-table": {
      what: "Maps each shopper-facing app surface to the table that feeds it.",
      workflow: "Coverage assurance — prove no shopper surface is empty.",
      changes: "Read-only; a zero row points to the SDUI or catalog work still needed.",
      example: "A zero next to 'Home top ad carousel' means no live ad slots.",
      app: ["consumer"],
    },
    "coverage-rows": {
      what: "How many live rows back this app surface.",
      workflow: "Coverage assurance — find the gaps.",
      changes: "Read-only; zero is the warning sign.",
      example: "Coupons above zero means shoppers have codes to redeem.",
      app: ["consumer"],
    },
    "coverage-status": {
      what: "Whether a surface is covered or still needs data.",
      workflow: "Coverage assurance — confirm launch readiness.",
      changes: "Read-only; 'Needs data' marks a surface that would render empty.",
      example: "Fix every 'Needs data' row before launch.",
      app: ["consumer"],
    },
  }),

  // ── App config (remote config) ─────────────────────────────────────────────
  ...pageHints("/admin/super/app-config", {
    "new-config": {
      what: "Opens a blank form to add a remote config key.",
      workflow: "Remote config — introduce a new app setting.",
      changes: "Starts a new key; nothing is saved until you press Create key.",
      example: "Add a feature flag the apps read on their next boot.",
      app: ["consumer", "seller", "delivery"],
    },
    "config-key": {
      what: "The key the apps look up; lowercase letters, digits, dots, dashes and underscores.",
      workflow: "Remote config — name the setting.",
      changes: "Sets the lookup name; it cannot be renamed once created.",
      example: "Enter maps.places_api_key or feature.newCheckout.",
      app: ["consumer", "seller", "delivery"],
    },
    "config-value": {
      what: "The value served to the apps; plain text, or JSON for objects and arrays.",
      workflow: "Remote config — set the stored value.",
      changes: "Sets what the apps read on boot; true/false and numbers keep their JSON type.",
      example: "Enter 25 for a number, or {...} for an object.",
      app: ["consumer", "seller", "delivery"],
    },
    "config-variant": {
      what: "Which app flavour reads this key — Customer, Delivery, Seller or all.",
      workflow: "Remote config — scope the setting.",
      changes: "Limits the override to one app; other apps keep their baked default.",
      example: "Choose Delivery so only the delivery app is affected.",
      app: ["consumer", "seller", "delivery"],
    },
    "config-public": {
      what: "Whether the value is served to every app on boot.",
      workflow: "Remote config — expose or withhold a value.",
      changes: "Public values ship to the apps; private values stay on the gateway.",
      example: "Leave Public on for a harmless display flag.",
      app: ["consumer", "seller", "delivery"],
    },
    "config-secret": {
      what: "Marks a value secret: masked here and never served to the apps.",
      workflow: "Remote config — store a credential safely.",
      changes: "Forces the value private and hides it in this portal; blank keeps the stored secret.",
      example: "Mark an API key secret so it never leaves the gateway.",
      app: ["consumer", "seller", "delivery"],
    },
    "save-config": {
      what: "Saves the key and its value.",
      workflow: "Remote config — publish a setting.",
      changes: "Apps pick it up on their next cold boot; no app-store release needed.",
      example: "Create or save after setting the key, value and visibility.",
      app: ["consumer", "seller", "delivery"],
    },
    "delete-config": {
      what: "Removes a config key from the gateway.",
      workflow: "Remote config — retire a setting.",
      changes: "Apps fall back to their baked build-time value; the removal is audit-logged.",
      example: "Remove a key once no app reads it any more.",
      app: ["consumer", "seller", "delivery"],
    },
  }),

  // ── Credentials ────────────────────────────────────────────────────────────
  ...pageHints("/admin/super/credentials", {
    "issue-login": {
      what: "Opens the form to create a portal login for a seller or district admin.",
      workflow: "Credential management — grant portal access.",
      changes: "Starts a new credential; nothing is saved until you confirm.",
      example: "Issue a login for a new district admin with a temporary password.",
      app: ["portal"],
    },
    "create-credential": {
      what: "Creates the login and its temporary password.",
      workflow: "Credential management — issue access.",
      changes: "Adds an active credential the holder can sign in with.",
      example: "Create after setting the role, scope and a 12+ character password.",
      app: ["portal"],
    },
    "reset-password": {
      what: "Resets a user's password and revokes their running sessions.",
      workflow: "Credential management — recover or rotate access.",
      changes: "Sets a new temporary or immediate password; old sessions stop working.",
      example: "Reset after a partner loses their password.",
      app: ["portal"],
    },
    "toggle-active": {
      what: "Deactivates or reactivates a login.",
      workflow: "Credential management — suspend access.",
      changes: "A deactivated login is blocked at the next sign-in.",
      example: "Deactivate a login for a partner who has left.",
      app: ["portal"],
    },
    "role-select": {
      what: "Chooses whether the login is a seller or a district admin.",
      workflow: "Credential management — scope the login.",
      changes: "Switches the scope field between seller and district.",
      example: "Pick District admin to scope the login to one district.",
      app: ["portal"],
    },
    "force-change": {
      what: "Requires the holder to set their own password on first sign-in.",
      workflow: "Credential management — safe hand-over.",
      changes: "Keeps the temporary password single-use; unchecking activates it now.",
      example: "Leave it on for a seller's first login.",
      app: ["portal"],
    },
  }),

  // ── District admins ────────────────────────────────────────────────────────
  ...pageHints("/admin/super/district-admins", {
    "district-select": {
      what: "The single district this admin will govern.",
      workflow: "Roster management — assign a district.",
      changes: "Locks the admin's scope to that district.",
      example: "Pick Coimbatore for a new Coimbatore admin.",
      app: ["portal"],
    },
    "issue-login-toggle": {
      what: "Creates the roster row and a portal login in one step, or the roster row only.",
      workflow: "Roster management — create an admin.",
      changes: "Unchecked, the admin exists but cannot sign in until you issue a login.",
      example: "Leave it on so the admin can sign in right away.",
      app: ["portal"],
    },
    "create-admin-button": {
      what: "Creates the district admin and, if selected, their login.",
      workflow: "Roster management — add an admin.",
      changes: "Adds the admin and shows the temporary password once.",
      example: "Create only after the email and 10-digit phone validate.",
      app: ["portal"],
    },
    "pre-provision": {
      what: "Switches the form to create a roster entry without a login.",
      workflow: "Roster management — pre-provision an admin.",
      changes: "Creates the admin row only; they cannot sign in yet.",
      example: "Use it when you will issue the login later from Credentials.",
      app: ["portal"],
    },
    "roster-search": {
      what: "Filters the admin roster by name, email or district code.",
      workflow: "Roster management — find an admin.",
      changes: "Filters the table; nothing is changed.",
      example: "Type 'TCH' to list the admins in that district.",
      app: ["portal"],
    },
    "issue-login-action": {
      what: "Opens Credentials prefilled to issue a login for this admin.",
      workflow: "Roster management — grant access to an existing admin.",
      changes: "Starts a district-admin credential for that email.",
      example: "Use it for an admin you pre-provisioned without a login.",
      app: ["portal"],
    },
    "admin-delete": {
      what: "Permanently removes the admin and revokes their login.",
      workflow: "Roster management — offboard an admin.",
      changes: "Removes access to the district; past actions stay in the audit log.",
      example: "Delete an admin who has permanently left.",
      app: ["portal"],
    },
  }),

  // ── Districts ──────────────────────────────────────────────────────────────
  ...pageHints("/admin/super/districts", {
    "district-search": {
      what: "Filters the district picker and lists by code or name.",
      workflow: "Expansion planning — find a district.",
      changes: "Filters the options; nothing is changed.",
      example: "Type 'Madurai' to narrow the picker.",
      app: ["portal"],
    },
    "district-select": {
      what: "Picks the district whose supply, demand and governance you are viewing.",
      workflow: "Expansion planning — inspect one district.",
      changes: "Reloads the tables for that district; nothing is changed.",
      example: "Switch to Chengalpattu to read its sellers and admins.",
      app: ["portal"],
    },
    "district-admin-roster": {
      what: "The admins governing the selected district.",
      workflow: "Governance — check a district has an accountable admin.",
      changes: "Read-only; an empty roster means no one runs KYC or campaigns there.",
      example: "Create an admin from District admins if this list is empty.",
      app: ["portal"],
    },
    "district-campaigns": {
      what: "Festival campaigns running in the selected district's state.",
      workflow: "Campaign oversight — see local promotions.",
      changes: "Read-only; actions on a campaign happen on the Festival page.",
      example: "A LIVE campaign means festival prices are active in that state.",
      app: ["consumer"],
    },
    "district-sellers": {
      what: "Every seller that applied from the selected district.",
      workflow: "Supply oversight — read a district's seller base.",
      changes: "Read-only; moderation opens from the seller detail page.",
      example: "Check ratings before trusting a new district's quality.",
      app: ["portal"],
    },
  }),

  // ── Festival governance ────────────────────────────────────────────────────
  ...pageHints("/admin/super/festival", {
    "global-cap": {
      what: "The hard maximum festival discount per sector, applied everywhere.",
      workflow: "Festival governance — set the platform ceiling.",
      changes: "Caps every state campaign and seller opt-in for that sector.",
      example: "Set MART to 40% so no MART discount exceeds 40%.",
      app: ["consumer"],
    },
    "state-override": {
      what: "A per-state cap that replaces the global cap for that state only.",
      workflow: "Festival governance — allow or tighten a state's ceiling.",
      changes: "Overrides the global cap for the chosen state; it can never exceed it.",
      example: "Give Puducherry a 25% MART cap below the 40% global.",
      app: ["consumer"],
    },
    "campaign-name": {
      what: "The campaign name used across the portal and app.",
      workflow: "Festival governance — launch a global campaign.",
      changes: "Names the campaign, which is created as a DRAFT.",
      example: "Call it 'Diwali Utsav' so states recognise it.",
      app: ["consumer"],
    },
    "campaign-dates": {
      what: "The start and end dates that bound the campaign window.",
      workflow: "Festival governance — set the campaign period.",
      changes: "Defines when the campaign runs; the end must be after the start.",
      example: "Start on 1 Nov and end on 15 Nov.",
      app: ["consumer"],
    },
    "create-campaign-button": {
      what: "Creates the global campaign as a DRAFT.",
      workflow: "Festival governance — start a campaign.",
      changes: "Adds the campaign; move it to LIVE from the lifecycle selector.",
      example: "Create, then schedule it once the dates are confirmed.",
      app: ["consumer"],
    },
    "campaign-lifecycle": {
      what: "Moves a campaign between DRAFT, SCHEDULED, LIVE and ENDED.",
      workflow: "Festival governance — run the campaign lifecycle.",
      changes: "LIVE applies campaign pricing in every live state.",
      example: "Set LIVE on the start date to begin festival pricing.",
      app: ["consumer"],
    },
  }),

  // ── Global catalog ─────────────────────────────────────────────────────────
  ...pageHints("/admin/super/products", {
    "product-search": {
      what: "Filters the global catalog by product name or id.",
      workflow: "Global catalog moderation — find listings.",
      changes: "Filters the table; nothing is changed.",
      example: "Search 'paracetamol' to audit that listing.",
      app: ["consumer"],
    },
    "sector-filter": {
      what: "Shows listings from one sub-app (MART, FOOD or PHARMA).",
      workflow: "Global catalog moderation — scope by sector.",
      changes: "Filters the table; nothing is changed.",
      example: "Pick PHARMA to review only medicines.",
      app: ["consumer"],
    },
    "bulk-select": {
      what: "Ticks listings for a bulk action.",
      workflow: "Global catalog moderation — act on many at once.",
      changes: "Builds the selection the bulk buttons apply to.",
      example: "Select the listings you intend to approve together.",
      app: ["consumer"],
    },
    "approve-selected": {
      what: "Approves every selected listing so shoppers can see it.",
      workflow: "Global catalog moderation — bulk approve.",
      changes: "Sets each selected listing ACTIVE; logged as a bulk approval.",
      example: "Approve a batch of correct listings in one click.",
      app: ["consumer"],
    },
    "delete-selected": {
      what: "Permanently removes every selected listing from the catalog.",
      workflow: "Global catalog moderation — bulk removal.",
      changes: "Deletes them; they disappear from the app immediately and the removal is logged.",
      example: "Remove a batch of duplicate or policy-breaching listings.",
      app: ["consumer"],
    },
  }),

  // ── Rewards ────────────────────────────────────────────────────────────────
  ...pageHints("/admin/super/rewards", {
    "earn-rate": {
      what: "How many rupees a shopper spends to earn one FaazioCoin.",
      workflow: "Rewards authority — tune earning.",
      changes: "Applies to orders placed after you save.",
      example: "A lower number means shoppers earn coins faster.",
      app: ["consumer"],
    },
    "redeem-rate": {
      what: "How many coins equal ₹1 at redemption.",
      workflow: "Rewards authority — tune redemption.",
      changes: "Changes the cash value of coins at checkout.",
      example: "Keep it generous enough that coins feel worth collecting.",
      app: ["consumer"],
    },
    "streak-target": {
      what: "The number of consecutive days that completes a streak.",
      workflow: "Rewards authority — tune streaks.",
      changes: "Changes how long shoppers must order to hit the streak bonus.",
      example: "Set 7 for a weekly streak.",
      app: ["consumer"],
    },
    "discount-card": {
      what: "The discount percentage on a completed streak reward card.",
      workflow: "Rewards authority — tune the reward card.",
      changes: "Sets how much the card knocks off the next order.",
      example: "Set 10 to give 10% off.",
      app: ["consumer"],
    },
    "card-validity": {
      what: "How many days a reward card stays usable.",
      workflow: "Rewards authority — bound the reward window.",
      changes: "Sets the card's expiry after it is earned.",
      example: "Set 30 so cards last a month.",
      app: ["consumer"],
    },
    "save-program": {
      what: "Saves all the FaazioCoins rates together.",
      workflow: "Rewards authority — publish rate changes.",
      changes: "New rates apply to the next order; the coin ledger is untouched.",
      example: "Save after adjusting earn and redeem.",
      app: ["consumer"],
    },
  }),

  // ── App content (SDUI) ─────────────────────────────────────────────────────
  ...pageHints("/admin/super/sdui", {
    "publish-button": {
      what: "Publishes the edited home layout to the app.",
      workflow: "Merchandising authority — ship a layout change.",
      changes: "Bumps the live version; the app recompiles on its next poll.",
      example: "Publish after retitling a rail and reordering its product ids.",
      app: ["consumer"],
    },
    "section-title": {
      what: "The heading shoppers see above a home rail.",
      workflow: "Merchandising — edit a layout section.",
      changes: "Edits the draft only; press Publish to make it live.",
      example: "Rename 'Top picks' to 'Monsoon must-haves'.",
      app: ["consumer"],
    },
    "section-product-ids": {
      what: "The catalog product ids shown in the rail, comma-separated.",
      workflow: "Merchandising — curate a rail.",
      changes: "Edits the draft only; ids must exist in the catalog.",
      example: "Enter md-1, md-2 to pin those two products.",
      app: ["consumer"],
    },
    "section-refs": {
      what: "Counts of stores, chips, banners and campaigns attached to the section.",
      workflow: "Merchandising — read a section's structure.",
      changes: "Read-only; edit the editors shown below the row.",
      example: "A count of 0 banners means the section has no hero images.",
      app: ["consumer"],
    },
    "banner-editor": {
      what: "The title, subtitle and image for a hero banner.",
      workflow: "Merchandising — edit a banner.",
      changes: "Prices are always joined from the catalog; only copy and image are editable.",
      example: "Set a title and upload a wide banner image.",
      app: ["consumer"],
    },
    "campaign-editor": {
      what: "The vendor store, carousel slot and catalog product ids for a campaign row.",
      workflow: "Merchandising — edit a store campaign.",
      changes: "Store and products are referenced by id; title and price come from the catalog.",
      example: "Point the campaign at store-m1 and its food product ids.",
      app: ["consumer"],
    },
  }),

  // ── Sectors & categories ───────────────────────────────────────────────────
  ...pageHints("/admin/super/sectors", {
    "rename-category": {
      what: "Renames a category on every listing filed under it.",
      workflow: "Taxonomy authority — fix a category name.",
      changes: "Updates the category on all its listings; shoppers see the new name.",
      example: "Rename 'Cold Drinks' to 'Beverages'.",
      app: ["consumer", "portal"],
    },
    "merge-categories": {
      what: "Moves every listing from one category into another.",
      workflow: "Taxonomy authority — consolidate categories.",
      changes: "Reassigns all source listings to the target; the source disappears.",
      example: "Merge 'Snacks' into 'Packaged Food'.",
      app: ["consumer", "portal"],
    },
    "gst-add": {
      what: "Adds a category with its sector and GST rate to the master.",
      workflow: "Taxonomy authority — define a category's tax.",
      changes: "Makes the category selectable by sellers and sets its checkout tax.",
      example: "Add 'Audio' under MART at 18%.",
      app: ["consumer", "portal"],
    },
    "gst-rate": {
      what: "The GST rate applied to this category at checkout.",
      workflow: "Taxonomy authority — adjust tax.",
      changes: "Changes the tax split for every listing in the category.",
      example: "Change 'Thali' from 5% to 12%.",
      app: ["consumer", "portal"],
    },
    "gst-delete": {
      what: "Removes a category from the GST master.",
      workflow: "Taxonomy authority — retire a category.",
      changes: "Deletes the row; sellers can no longer pick it.",
      example: "Delete a category you created by mistake.",
      app: ["consumer", "portal"],
    },
  }),

  // ── Sellers ────────────────────────────────────────────────────────────────
  ...pageHints("/admin/super/sellers", {
    "seller-search": {
      what: "Filters sellers by business name, district or state.",
      workflow: "Global seller oversight — find a seller.",
      changes: "Filters the table; nothing is changed.",
      example: "Type 'TCH' to see a district's sellers.",
      app: ["portal"],
    },
    "status-filter": {
      what: "Shows sellers in one lifecycle state.",
      workflow: "Global seller oversight — scope by status.",
      changes: "Filters the table; nothing is changed.",
      example: "Pick PENDING_REVIEW to clear applications.",
      app: ["consumer", "portal"],
    },
    "seller-activate": {
      what: "Overrides a district decision and activates a seller.",
      workflow: "Global seller oversight — unblock a seller.",
      changes: "Lets the seller sell; the override is audit-logged.",
      example: "Activate a seller wrongly held in review.",
      app: ["consumer", "portal"],
    },
    "seller-suspend": {
      what: "Suspends a seller platform-wide.",
      workflow: "Global seller oversight — stop a seller.",
      changes: "Removes their listings from sale; the override is audit-logged.",
      example: "Suspend a seller after repeated policy breaches.",
      app: ["consumer", "portal"],
    },
  }),

  // ── Platform settings ──────────────────────────────────────────────────────
  ...pageHints("/admin/super/settings", {
    "tcs-input": {
      what: "The tax collected at source, deducted before payout.",
      workflow: "Platform settings — statutory deduction.",
      changes: "Changes settlement maths for every state and payout.",
      example: "Set 1 for a 1% TCS.",
      app: ["consumer", "seller", "delivery", "portal"],
    },
    "earn-rate": {
      what: "Coins earned per ₹100 a shopper spends.",
      workflow: "Platform settings — loyalty earning.",
      changes: "Changes what shoppers earn, platform-wide.",
      example: "Set 2 so ₹100 earns 2 coins.",
      app: ["consumer", "seller", "delivery", "portal"],
    },
    "redeem-rate": {
      what: "The rupee value of one coin at redemption.",
      workflow: "Platform settings — loyalty redemption.",
      changes: "Changes the cash value of coins platform-wide.",
      example: "Set 0.25 so four coins equal ₹1.",
      app: ["consumer", "seller", "delivery", "portal"],
    },
    "sla-input": {
      what: "The dispatch SLA in hours used by delivery and seller gates.",
      workflow: "Platform settings — service levels.",
      changes: "Changes the promise window used across the portal.",
      example: "Set 24 for a one-day dispatch promise.",
      app: ["consumer", "seller", "delivery", "portal"],
    },
    "save-settings": {
      what: "Saves the platform settings.",
      workflow: "Platform settings — apply global rules.",
      changes: "Applies to every state and reaches sellers, riders and shoppers.",
      example: "Save after changing TCS or the SLA.",
      app: ["consumer", "seller", "delivery", "portal"],
    },
  }),

  // ── Users (customer monitoring) ────────────────────────────────────────────
  ...pageHints("/admin/super/users", {
    "user-search": {
      what: "Filters customers by name or user id.",
      workflow: "Customer monitoring — find a customer.",
      changes: "Filters the table; nothing is changed.",
      example: "Type a user id to see their order count and spend.",
      app: ["portal"],
    },
    "user-orders": {
      what: "How many orders this customer has placed.",
      workflow: "Customer monitoring — read activity.",
      changes: "Read-only; counts paid orders.",
      example: "A high count with low spend means small baskets.",
      app: ["portal"],
    },
    "user-spend": {
      what: "Total rupees this customer has spent.",
      workflow: "Customer monitoring — read value.",
      changes: "Read-only; the projection excludes phone, address and email.",
      example: "Sort your attention by the biggest spenders.",
      app: ["portal"],
    },
  }),
};
