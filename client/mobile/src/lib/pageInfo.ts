/**
 * Central registry of user-facing guidance shown by the "i" InfoButton.
 *
 * Plain data only (no logic, no PII, no secrets) so every explanation is easy to
 * audit and translate later. Pages are keyed by route/header name; components by
 * a stable component key. `resolveInfo` turns either into a normalised `InfoDoc`
 * the shared `InfoSheet` renders.
 */

export type AppScope = 'customer' | 'delivery' | 'seller' | 'all';

export interface PageInfo {
  /** Heading shown in the sheet. */
  title: string;
  /** Why this page exists, in plain English. */
  whyCreated: string;
  /** The bounded end-to-end workflow this page belongs to. */
  boundedWorkflow: string;
  /** What state/data this page reads or changes. */
  whatChanges: string;
  /** A concrete, everyday example. */
  example: string;
  app: AppScope;
}

export interface ComponentInfo {
  title: string;
  whatItDoes: string;
  /** Which app(s) render it. */
  affectsApps: string;
  example: string;
  app: AppScope;
}

export interface InfoSection {
  label: string;
  body: string;
}

export interface InfoDoc {
  title: string;
  sections: InfoSection[];
  app: AppScope;
}

export const PAGE_INFO: Record<string, PageInfo> = {
  Onboarding: {
    title: 'Welcome to Faazio',
    whyCreated:
      'First-run walkthrough that introduces the three Faazio sub-apps — Mart groceries, Food restaurants, and Pharma & blood services — before you sign in.',
    boundedWorkflow: 'Onboarding → sign in → set location → start shopping.',
    whatChanges:
      'No data changes. It only teaches the app and links you to the Login screen.',
    example:
      'You swipe through the intro slides, tap Get Started, and land on the Login screen.',
    app: 'customer',
  },
  Login: {
    title: 'Sign in',
    whyCreated:
      'Authenticates you into the Faazio customer app using your phone number and an SMS one-time code.',
    boundedWorkflow: 'Authentication (customer account).',
    whatChanges:
      'Creates or loads your session and stores your auth token securely in the device keychain. Your profile is not changed until you complete registration.',
    example:
      'Enter your phone number, receive an SMS code, type it in, and you are signed in.',
    app: 'customer',
  },
  LanguageSelection: {
    title: 'Choose your language',
    whyCreated:
      'Lets you pick the language Faazio uses for labels and messages on this device.',
    boundedWorkflow: 'Onboarding / app preferences.',
    whatChanges:
      'Saves your language preference on the device. It does not change your account or orders.',
    example:
      'Pick Tamil, and the app switches its interface language for this device.',
    app: 'customer',
  },
  Location: {
    title: 'Set your delivery location',
    whyCreated:
      'Pins where your orders are delivered and shows the stores and restaurants that serve that area.',
    boundedWorkflow: 'Fulfilment setup (address → stores → delivery).',
    whatChanges:
      'Saves the chosen address to your profile so carts and stores can price and route delivery.',
    example:
      'Search for your street, select it, and Home now shows only stores that deliver there.',
    app: 'customer',
  },
  Home: {
    title: 'Home — Mart, Food & Pharma hub',
    whyCreated:
      'Gives you one entry point to browse groceries (Mart), restaurants (Food) and pharmacies (Pharma) without leaving the app.',
    boundedWorkflow: 'Discovery → browse → add to cart → checkout (customer shopping).',
    whatChanges:
      'No data changes here; it only reads and displays stores, categories and offers.',
    example:
      'Tap Mart, see grocery stores, open a store, add rice to your cart, and the cart total rises.',
    app: 'customer',
  },
  SubApp: {
    title: 'Mart / Pharma storefront',
    whyCreated:
      'Wraps a Faazio sub-app (Mart groceries or Pharma) with its own search, categories and cart.',
    boundedWorkflow: 'Discovery → browse → add to cart (sub-app shopping).',
    whatChanges:
      'Reads catalog and store data. Adding an item changes only your cart.',
    example:
      'In Pharma, search paracetamol, add it to your cart, and the cart badge updates.',
    app: 'customer',
  },
  CategoryDrillIn: {
    title: 'Category',
    whyCreated:
      'Lets you drill into a single category to see only the vendors or products inside it.',
    boundedWorkflow: 'Discovery → category browse.',
    whatChanges:
      'No data changes; it is a filtered view of the catalog.',
    example:
      'Open the Fruits category and see only fruit vendors and their products.',
    app: 'customer',
  },
  VendorDetails: {
    title: 'Store',
    whyCreated:
      'Shows a single store’s products, ratings and offers so you can shop it directly.',
    boundedWorkflow: 'Discovery → store browse → add to cart.',
    whatChanges:
      'Reads store data. Adding a product changes your cart only.',
    example:
      'Open your nearest Mart store, add milk, and the cart updates.',
    app: 'customer',
  },
  FoodHome: {
    title: 'Food — restaurants near you',
    whyCreated:
      'Lists restaurants and dishes available for delivery to your current location.',
    boundedWorkflow: 'Discovery → restaurant browse → add to cart → checkout.',
    whatChanges:
      'No data changes; it reads the restaurant catalog.',
    example:
      'Browse nearby restaurants, open one, and add a dish to your cart.',
    app: 'customer',
  },
  FoodSearch: {
    title: 'Search restaurants & dishes',
    whyCreated:
      'Finds restaurants and dishes matching what you type.',
    boundedWorkflow: 'Discovery → search → open results.',
    whatChanges:
      'No data changes; search is read-only.',
    example:
      'Type “biryani” and tap a restaurant in the results to open its menu.',
    app: 'customer',
  },
  RestaurantProfile: {
    title: 'Restaurant',
    whyCreated:
      'Shows a restaurant’s menu, offers and ratings so you can order from it.',
    boundedWorkflow: 'Discovery → restaurant → add to cart → checkout.',
    whatChanges:
      'Reads restaurant data. Adding dishes changes your cart only.',
    example:
      'Open a restaurant, pick a dish, and it appears in your cart.',
    app: 'customer',
  },
  RestaurantOffers: {
    title: 'Restaurant offers',
    whyCreated:
      'Highlights the special dishes, combos and discounts a restaurant is running.',
    boundedWorkflow: 'Discovery → offer browse → add to cart.',
    whatChanges:
      'No data changes; tapping an offer starts an order from that item.',
    example:
      'Tap a “2 for 1” combo and its dish is added to your cart.',
    app: 'customer',
  },
  RestaurantMenu: {
    title: 'Menu',
    whyCreated:
      'The full, filterable menu for a restaurant.',
    boundedWorkflow: 'Discovery → menu browse → add to cart.',
    whatChanges:
      'Reads the menu; adding items changes only your cart.',
    example:
      'Filter the menu to vegetarian dishes and add one to your cart.',
    app: 'customer',
  },
  ProductDetail: {
    title: 'Product details',
    whyCreated:
      'Shows a product’s full details — images, price, description, ratings and reviews — before you buy.',
    boundedWorkflow: 'Discovery → product view → add to cart.',
    whatChanges:
      'Reads product data. Adding to cart changes your cart; reviews you submit are saved.',
    example:
      'Open a product, read reviews, add it to your cart, and the price is added at checkout.',
    app: 'customer',
  },
  Search: {
    title: 'Search',
    whyCreated:
      'Lets you search across the catalog for products, stores and dishes.',
    boundedWorkflow: 'Discovery → search → open result.',
    whatChanges:
      'No data changes; search is read-only.',
    example:
      'Type a product name and tap a result to open its detail page.',
    app: 'customer',
  },
  Cart: {
    title: 'Your cart',
    whyCreated:
      'Reviews everything you are about to buy, lets you set fulfilment, apply coupons and pay.',
    boundedWorkflow: 'Cart → fulfilment → payment → order placed.',
    whatChanges:
      'Edits cart lines and totals. Placing the order creates an order record and starts fulfilment.',
    example:
      'Change a quantity, apply a coupon, choose delivery, and pay — the order appears in My Orders.',
    app: 'customer',
  },
  You: {
    title: 'My Account',
    whyCreated:
      'The hub for your profile, orders, payments, addresses, rewards and privacy controls.',
    boundedWorkflow: 'Account management.',
    whatChanges:
      'Edits here update your profile. Destructive actions (like deleting your account) erase data.',
    example:
      'Open My Account, tap My Orders to track a delivery, or tap Addresses to add one.',
    app: 'customer',
  },
  Account: {
    title: 'My Account',
    whyCreated:
      'The hub for your profile, orders, payments, addresses, rewards and privacy controls.',
    boundedWorkflow: 'Account management.',
    whatChanges:
      'Edits here update your profile. Destructive actions (like deleting your account) erase data.',
    example:
      'Tap My Orders to track a delivery, or Addresses to add a new one.',
    app: 'customer',
  },
  PaymentOptions: {
    title: 'Payment options',
    whyCreated:
      'Lets you choose how to pay for the order — saved card, new card, or cash on delivery.',
    boundedWorkflow: 'Checkout → payment.',
    whatChanges:
      'Selecting a method changes how this order is paid. Card numbers are handled by the payment provider, not stored on your device.',
    example:
      'Choose Cash on Delivery and place the order — you pay the rider on arrival.',
    app: 'customer',
  },
  AddCard: {
    title: 'Add card',
    whyCreated:
      'Adds a card so future checkouts are faster.',
    boundedWorkflow: 'Checkout → payment → saved cards.',
    whatChanges:
      'Saves a tokenised card reference. Your card number goes directly to the payment provider and is never stored in plain form.',
    example:
      'Enter your card details once, and next time you can pick it with one tap.',
    app: 'customer',
  },
  UserDetails: {
    title: 'My Profile',
    whyCreated:
      'Shows and edits your personal details used for orders and delivery.',
    boundedWorkflow: 'Account management → profile.',
    whatChanges:
      'Saves your name, phone and email to your profile.',
    example:
      'Update your name, save, and it appears on new orders.',
    app: 'customer',
  },
  SavedAddresses: {
    title: 'Addresses',
    whyCreated:
      'Manages the delivery addresses you can pick from at checkout.',
    boundedWorkflow: 'Account management → addresses → fulfilment.',
    whatChanges:
      'Adds, edits or removes delivery addresses on your profile.',
    example:
      'Add your office address so you can deliver there at checkout.',
    app: 'customer',
  },
  DeleteAccount: {
    title: 'Delete account',
    whyCreated:
      'Permanently closes your Faazio account when you no longer want it.',
    boundedWorkflow: 'Privacy → account deletion.',
    whatChanges:
      'Erases your account and personal data. Order and prescription records are handled per the privacy policy.',
    example:
      'Confirm deletion and you are signed out and your account is closed.',
    app: 'customer',
  },
  RequestDataDeletion: {
    title: 'Request data deletion',
    whyCreated:
      'Lets you ask support to delete specific data if you prefer not to close your whole account.',
    boundedWorkflow: 'Privacy → data deletion request.',
    whatChanges:
      'Submits a deletion request that support processes; nothing is erased instantly.',
    example:
      'Submit a request and support follows up once it is actioned.',
    app: 'customer',
  },
  MyOrders: {
    title: 'My Orders',
    whyCreated:
      'Tracks every order you have placed across Mart, Food and Pharma.',
    boundedWorkflow: 'Order tracking → reorder / rate / support.',
    whatChanges:
      'Read-only history. You can reorder an item or rate the vendor from here.',
    example:
      'Open a past order and tap Reorder to add the same items again.',
    app: 'customer',
  },
  Notifications: {
    title: 'Notifications',
    whyCreated:
      'The inbox for order updates, offers and account messages.',
    boundedWorkflow: 'Engagement → notifications.',
    whatChanges:
      'Reading marks messages as seen. Your push notification settings control what reaches you.',
    example:
      'Open Notifications to see “Your order is on the way”.',
    app: 'customer',
  },
  OrderDetails: {
    title: 'Order details',
    whyCreated:
      'Shows one order’s items, status, rider and totals.',
    boundedWorkflow: 'Order tracking.',
    whatChanges:
      'Read-only. You can reorder, rate the vendor or contact support from here.',
    example:
      'Open an in-progress order to see its live status and the assigned rider.',
    app: 'customer',
  },
  RateVendor: {
    title: 'Rate vendor',
    whyCreated:
      'Collects your rating and review for a store or delivery experience.',
    boundedWorkflow: 'Post-order feedback.',
    whatChanges:
      'Saves your public rating and review against the vendor.',
    example:
      'Give 5 stars, add a short comment, and submit.',
    app: 'customer',
  },
  BloodDonor: {
    title: 'Blood Donor Registration',
    whyCreated:
      'Lets you register as a blood donor or raise a request for blood in your area.',
    boundedWorkflow: 'Pharma → blood services.',
    whatChanges:
      'Submitting saves your donor profile, blood group and availability so others can find you.',
    example:
      'Register your blood group and city, and appear in donor search results.',
    app: 'customer',
  },
  BloodDonorDetails: {
    title: 'Donor details',
    whyCreated:
      'Shows a matching donor’s details so you can reach out for a blood request.',
    boundedWorkflow: 'Pharma → blood services → request.',
    whatChanges:
      'Read-only. Contacting a donor shares your blood request with them.',
    example:
      'Open a matching donor and send a request for your required blood group.',
    app: 'customer',
  },
  BloodRequestDescription: {
    title: 'Blood request',
    whyCreated:
      'Captures the details of a blood request so matching donors can respond.',
    boundedWorkflow: 'Pharma → blood services → request.',
    whatChanges:
      'Creates a blood request visible to donors who match the group and city.',
    example:
      'Describe your need, submit, and matching donors can see and respond.',
    app: 'customer',
  },
  MedicalShopDetails: {
    title: 'Medical shop',
    whyCreated:
      'Shows a pharmacy’s medicines and lets you order or upload a prescription.',
    boundedWorkflow: 'Pharma → shop → add to cart / prescription.',
    whatChanges:
      'Reads the shop catalog. Adding medicines changes your cart.',
    example:
      'Open a medical shop and add an over-the-counter medicine to your cart.',
    app: 'customer',
  },
  FaazioRewards: {
    title: 'FaazioRewards',
    whyCreated:
      'Shows the loyalty programme — FaazioCoins you earn and can redeem, plus streak discounts.',
    boundedWorkflow: 'Rewards → earn / redeem.',
    whatChanges:
      'Reads your coin ledger. Redeeming coins changes your balance at checkout.',
    example:
      'Earn coins on orders, then redeem them for a discount at checkout.',
    app: 'customer',
  },
  SellWithUs: {
    title: 'Sell with us',
    whyCreated:
      'The application form for merchants who want to sell on Faazio.',
    boundedWorkflow: 'Seller onboarding → application → review.',
    whatChanges:
      'Submitting creates a seller application for Faazio to review.',
    example:
      'Enter your store details, submit, and Faazio reviews your application.',
    app: 'customer',
  },
  SellerPlatformFeeRequest: {
    title: 'Platform fee request',
    whyCreated:
      'Lets a seller request a change to the platform fee they pay.',
    boundedWorkflow: 'Seller onboarding → fees.',
    whatChanges:
      'Submits a fee-change request for review; the fee does not change until approved.',
    example:
      'Request a lower fee percentage and track its approval status.',
    app: 'customer',
  },
  FeeChangeRequests: {
    title: 'Fee change requests',
    whyCreated:
      'Lists the platform-fee change requests and their status.',
    boundedWorkflow: 'Seller onboarding → fees.',
    whatChanges:
      'Read-only list; approving or rejecting here changes a seller’s fee.',
    example:
      'Open a pending fee request and approve it to apply the new rate.',
    app: 'customer',
  },
  SellerRequests: {
    title: 'Seller requests',
    whyCreated:
      'The admin queue of new seller applications waiting for review.',
    boundedWorkflow: 'Seller onboarding → application review.',
    whatChanges:
      'Approving or rejecting an application changes that seller’s status.',
    example:
      'Open a pending application and approve it to make the seller active.',
    app: 'customer',
  },
  SellerRequestDetail: {
    title: 'Review application',
    whyCreated:
      'Shows one seller application in full so it can be approved or rejected.',
    boundedWorkflow: 'Seller onboarding → application review.',
    whatChanges:
      'Approving or rejecting updates the applicant’s status.',
    example:
      'Review the submitted details and approve the seller.',
    app: 'customer',
  },
  DealsLanding: {
    title: 'Deals',
    whyCreated:
      'A landing page for campaigns, discounts and everyday essentials.',
    boundedWorkflow: 'Discovery → deals → add to cart.',
    whatChanges:
      'Read-only offers. Choosing a deal adds its products to your cart.',
    example:
      'Open a “Weekend Sale” deal and add a discounted product to your cart.',
    app: 'customer',
  },
  PrescriptionFlow: {
    title: 'Prescription',
    whyCreated:
      'Lets you upload a doctor’s prescription so a pharmacy can review and fulfil it.',
    boundedWorkflow: 'Pharma → prescription → order.',
    whatChanges:
      'Uploads a prescription image and creates a prescription order for a pharmacy.',
    example:
      'Photograph your prescription, add a note, and submit it to a pharmacy.',
    app: 'customer',
  },
  Favourites: {
    title: 'Favourites',
    whyCreated:
      'Keeps the products and stores you save so you can reorder quickly.',
    boundedWorkflow: 'Account → favourites → reorder.',
    whatChanges:
      'Removing a favourite updates your saved list.',
    example:
      'Open Favourites and re-add a saved product to your cart in one tap.',
    app: 'customer',
  },
  PhoneEntry: {
    title: 'Delivery Partner sign in',
    whyCreated:
      'The login entry for the Faazio Delivery Partner app.',
    boundedWorkflow: 'Delivery onboarding → authentication.',
    whatChanges:
      'Starts a phone-code login. Your delivery profile is not changed until you verify.',
    example:
      'Enter your registered phone number to receive an SMS code.',
    app: 'delivery',
  },
  OtpVerify: {
    title: 'Verify your number',
    whyCreated:
      'Confirms the SMS code sent to your phone to secure your delivery account.',
    boundedWorkflow: 'Delivery onboarding → authentication.',
    whatChanges:
      'Verifying signs you in and stores your session securely. You can change the number and start over.',
    example:
      'Type the 6-digit code from the SMS to continue to your dashboard.',
    app: 'delivery',
  },
  Register: {
    title: 'Your application',
    whyCreated:
      'Collects your details so you can become a Faazio delivery partner.',
    boundedWorkflow: 'Delivery onboarding → application → review.',
    whatChanges:
      'Submitting creates or updates your delivery applicant profile for review.',
    example:
      'Fill in your vehicle and documents, submit, and wait for approval.',
    app: 'delivery',
  },
  SubmissionSuccess: {
    title: 'Application status',
    whyCreated:
      'Tells you whether your delivery application was submitted and its current status.',
    boundedWorkflow: 'Delivery onboarding → application review.',
    whatChanges:
      'Read-only. Signing out ends your session.',
    example:
      'See “Application received” and sign out until Faazio approves you.',
    app: 'delivery',
  },
  Dashboard: {
    title: 'Delivery dashboard',
    whyCreated:
      'Your home screen — go online or offline, see new delivery offers and your current delivery.',
    boundedWorkflow: 'Delivery shift → accept → deliver → paid.',
    whatChanges:
      'Going online starts the location heartbeat and makes you available for offers. Accepting an offer assigns the order to you.',
    example:
      'Go online, accept a nearby offer, and you are taken to the route.',
    app: 'delivery',
  },
  AcceptReject: {
    title: 'New delivery offer',
    whyCreated:
      'Presents a delivery offer that you must accept or decline before the countdown ends.',
    boundedWorkflow: 'Delivery shift → offer decision.',
    whatChanges:
      'Accepting assigns the order to you and opens the route. Declining releases it to other riders.',
    example:
      'Accept within 20 seconds to claim the delivery before it expires.',
    app: 'delivery',
  },
  Route: {
    title: 'Route',
    whyCreated:
      'Guides you from the pickup store to the customer and tracks the delivery milestones.',
    boundedWorkflow: 'Delivery → pickup → dropoff → complete.',
    whatChanges:
      'Marking milestones updates the order status. Marking delivered completes the order and updates your earnings.',
    example:
      'Tap Picked up, then Delivered once you hand the order over.',
    app: 'delivery',
  },
  Payouts: {
    title: 'Earnings',
    whyCreated:
      'Shows how much you have earned and your payout history.',
    boundedWorkflow: 'Delivery earnings → payouts.',
    whatChanges:
      'Read-only. Any payout request creates a payout record for processing.',
    example:
      'Check this week’s earnings and confirm your latest payout was paid.',
    app: 'delivery',
  },
  Portal: {
    title: 'Seller portal',
    whyCreated:
      'The seller app opens the secure Faazio web partner portal, which owns all seller screens and controls.',
    boundedWorkflow: 'Seller operations (menu, orders, fees) on the portal.',
    whatChanges:
      'Everything you change here is saved by the web portal. This native shell only shows the portal and cannot read or edit its content.',
    example:
      'Sign in on the portal, update your menu, and the change is saved there.',
    app: 'seller',
  },
};

export const COMPONENT_INFO: Record<string, ComponentInfo> = {
  ProductCard: {
    title: 'Product card',
    whatItDoes:
      'A product tile in store grids — shows the image, name, price and an add-to-cart control.',
    affectsApps: 'Faazio customer app',
    example:
      'Tap the plus on a product card to add it to your cart without opening the product.',
    app: 'customer',
  },
  StoreCard: {
    title: 'Store card',
    whatItDoes:
      'A store tile showing the store’s name, rating, delivery time and offers. Tapping it opens the store.',
    affectsApps: 'Faazio customer app',
    example:
      'Tap a store card to browse that store’s full catalog.',
    app: 'customer',
  },
  SearchProductRow: {
    title: 'Search result row',
    whatItDoes:
      'A single search result — product image, name, price and an add control.',
    affectsApps: 'Faazio customer app',
    example:
      'Tap a search result row to add that product to your cart.',
    app: 'customer',
  },
  SortDropdown: {
    title: 'Sort control',
    whatItDoes:
      'Lets you choose the order results are shown in — for example price, rating or distance.',
    affectsApps: 'Faazio customer app',
    example:
      'Pick “Price: low to high” and the results reorder so the cheapest is first.',
    app: 'customer',
  },
  FilterChips: {
    title: 'Filter chips',
    whatItDoes:
      'Quick filters that narrow results by attribute such as category, offer or rating.',
    affectsApps: 'Faazio customer app',
    example:
      'Tap the “Offers” chip to show only items that are on discount.',
    app: 'customer',
  },
  AppTextInput: {
    title: 'Text input',
    whatItDoes:
      'A standard labelled text field for entering details like a name, search term or address.',
    affectsApps: 'All Faazio apps',
    example:
      'Type into the field and the value is saved when you submit the form.',
    app: 'all',
  },
  DeliveryField: {
    title: 'Form field',
    whatItDoes:
      'A labelled input used in delivery-partner forms, with an optional hint.',
    affectsApps: 'Faazio Delivery Partner app',
    example:
      'Enter your vehicle number in the field and it is saved with your application.',
    app: 'delivery',
  },
  DeliveryPrimaryButton: {
    title: 'Action button',
    whatItDoes:
      'The main action on a screen — for example Continue, Submit or Go online.',
    affectsApps: 'Faazio Delivery Partner app',
    example:
      'Tap Continue to move to the next onboarding step.',
    app: 'delivery',
  },
  DeliveryCard: {
    title: 'Card',
    whatItDoes:
      'A grouped block of related information, such as your application summary or earnings.',
    affectsApps: 'Faazio Delivery Partner app',
    example:
      'Read the earnings card to see today’s payout total.',
    app: 'delivery',
  },
  DeliveryStatusPill: {
    title: 'Status badge',
    whatItDoes:
      'A small coloured label showing a status such as Active, Paid or Rejected.',
    affectsApps: 'Faazio Delivery Partner app',
    example:
      'A green “Active” badge means your application is approved.',
    app: 'delivery',
  },
  HeaderCategoryRail: {
    title: 'Category rail',
    whatItDoes:
      'The scrollable row of categories pinned in the Mart header for quick access.',
    affectsApps: 'Faazio customer app',
    example:
      'Tap “Dairy” in the rail to jump to that category.',
    app: 'customer',
  },
  FloatingCartBar: {
    title: 'Floating cart bar',
    whatItDoes:
      'A bar that shows your current cart item count and total, and opens the cart.',
    affectsApps: 'Faazio customer app',
    example:
      'Add an item and the floating cart bar updates its count; tap it to check out.',
    app: 'customer',
  },
  StarRatingInput: {
    title: 'Star rating',
    whatItDoes:
      'A tap-to-rate control that records a rating from one to five stars.',
    affectsApps: 'Faazio customer app',
    example:
      'Tap the fourth star to give a 4-star rating.',
    app: 'customer',
  },
  VendorRateButton: {
    title: 'Rate vendor',
    whatItDoes:
      'Opens the rating screen so you can rate a store or delivery after an order.',
    affectsApps: 'Faazio customer app',
    example:
      'Tap Rate to open the rating screen for your last order.',
    app: 'customer',
  },
  Checkbox: {
    title: 'Checkbox',
    whatItDoes:
      'A toggle for a yes/no choice, such as accepting terms.',
    affectsApps: 'All Faazio apps',
    example:
      'Tick the checkbox to accept the terms before continuing.',
    app: 'all',
  },
  SlideUpSheet: {
    title: 'Bottom sheet',
    whatItDoes:
      'A panel that slides up over the screen to show options or extra information.',
    affectsApps: 'All Faazio apps',
    example:
      'Dismiss it by tapping the dimmed area behind it.',
    app: 'all',
  },
};

/** Normalise a page or component registry entry into a renderable doc. */
export function resolveInfo(key: string): InfoDoc | null {
  const page = PAGE_INFO[key];
  if (page) {
    return {
      title: page.title,
      app: page.app,
      sections: [
        { label: 'Why it exists', body: page.whyCreated },
        { label: 'Workflow', body: page.boundedWorkflow },
        { label: 'What changes', body: page.whatChanges },
        { label: 'Example', body: page.example },
      ],
    };
  }
  const component = COMPONENT_INFO[key];
  if (component) {
    return {
      title: component.title,
      app: component.app,
      sections: [
        { label: 'What it does', body: component.whatItDoes },
        { label: 'Used in', body: component.affectsApps },
        { label: 'Example', body: component.example },
      ],
    };
  }
  return null;
}
