import type { ComponentType } from "react";
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineArrowUturnLeft,
  HiOutlineBanknotes,
  HiOutlineBuildingStorefront,
  HiOutlineDocumentText,
  HiOutlineFire,
  HiOutlineGlobeAlt,
  HiOutlineHeart,
  HiOutlineIdentification,
  HiOutlineInformationCircle,
  HiOutlineLockClosed,
  HiOutlineMapPin,
  HiOutlinePlus,
  HiOutlineReceiptPercent,
  HiOutlineShieldCheck,
  HiOutlineShoppingBag,
  HiOutlineSwatch,
  HiOutlineTrash,
} from "react-icons/hi2";
import {
  AppClickwrap,
  AppContractSummary,
  AppDocRow,
  AppField,
  AppGeoNote,
  AppHeader,
  AppHero,
  AppOtpRow,
  AppPageHeader,
  AppPhone,
  AppReviewCard,
  AppScroll,
  AppSection,
  AppSecureNote,
  AppSelect,
  AppShopCard,
  AppStep,
  AppSubmit,
} from "./app-mock";

export type ScreenProps = { activeTarget: string };

type NavRow = {
  icon: ComponentType;
  title: string;
  subtitle: string;
  target?: string;
};

type NavGroup = { title: string; rows: NavRow[] };

/**
 * `accounts.nav_defaults` (migration 0101) in the order the app renders it.
 * The labels are copied, not imported: the landing page is a separate deploy.
 */
const ACCOUNT_GROUPS: readonly NavGroup[] = [
  {
    title: "Profile settings",
    rows: [
      {
        icon: HiOutlineShoppingBag,
        title: "My Orders",
        subtitle: "Track and manage your orders",
      },
      {
        icon: HiOutlineIdentification,
        title: "My Profile",
        subtitle: "Manage your personal information",
      },
      { icon: HiOutlineMapPin, title: "Addresses", subtitle: "Manage saved addresses" },
      {
        icon: HiOutlineHeart,
        title: "Favourites",
        subtitle: "Your favourite items across all apps",
      },
    ],
  },
  {
    title: "Privacy and security",
    rows: [
      {
        icon: HiOutlineTrash,
        title: "Delete account",
        subtitle: "Permanently delete your Faazio account",
      },
      {
        icon: HiOutlineShieldCheck,
        title: "Request data deletion",
        subtitle: "Erase selected data and keep your account",
      },
    ],
  },
  {
    title: "Earn with us",
    rows: [
      {
        icon: HiOutlineBuildingStorefront,
        title: "Sell with us",
        subtitle: "Partner with Faazio & list your products",
        target: "sell-with-us",
      },
    ],
  },
  {
    title: "Terms and policies",
    rows: [
      {
        icon: HiOutlineDocumentText,
        title: "Terms & Conditions",
        subtitle: "How Faazio works and what you agree to",
      },
      {
        icon: HiOutlineLockClosed,
        title: "Privacy Policy",
        subtitle: "How we collect, use, and protect your data",
      },
      {
        icon: HiOutlineArrowUturnLeft,
        title: "Refund & Cancellation Policy",
        subtitle: "Returns, refunds, and cancellations",
      },
      { icon: HiOutlineGlobeAlt, title: "Cookie Policy", subtitle: "Cookies used on faazio.com" },
      {
        icon: HiOutlineInformationCircle,
        title: "Disclaimer",
        subtitle: "Health, pricing, and third-party notices",
      },
    ],
  },
];

/** Customer app "My Account" (`features/profile/AccountView.tsx`) and its entry row. */
export function AccountScreen({ activeTarget }: ScreenProps) {
  return (
    <AppPhone>
      <AppPageHeader title="My Account" />
      <AppScroll>
        <div className="ta-coins">
          <div className="ta-coins-head">
            <div className="ta-coins-title">
              <span className="ta-coins-icon" aria-hidden="true">
                <HiOutlineBanknotes />
              </span>
              <span>FaazioCoins</span>
            </div>
            <div className="ta-coins-balance">
              <strong>1,240</strong>
              <span>coins</span>
            </div>
          </div>
          <div className="ta-flames" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, index) => (
              <HiOutlineFire key={index} data-on={index < 3 ? "true" : undefined} />
            ))}
          </div>
          <p className="ta-coins-caption">3 of 7 days — order today to keep your streak</p>
        </div>

        {ACCOUNT_GROUPS.map((group) => (
          <div key={group.title} className="ta-nav-group">
            <p className="ta-nav-group-title">{group.title}</p>
            <div className="ta-nav-card">
              {group.rows.map((row) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.title}
                    className="ta-nav-row"
                    data-tour-target={row.target}
                    data-active={row.target && row.target === activeTarget ? "true" : undefined}
                  >
                    <span className="ta-nav-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="ta-nav-text">
                      <span className="ta-nav-name">{row.title}</span>
                      <span className="ta-nav-sub">{row.subtitle}</span>
                    </span>
                    <svg
                      className="ta-nav-chevron"
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M9 5.5 15.5 12 9 18.5"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="ta-nav-group">
          <p className="ta-nav-group-title">Partner</p>
          <div className="ta-nav-card">
            <div
              className="ta-nav-row"
              data-tour-target="fee-request-entry"
              data-active={activeTarget === "fee-request-entry" || undefined}
            >
              <span className="ta-nav-icon" aria-hidden="true">
                <HiOutlineReceiptPercent />
              </span>
              <span className="ta-nav-text">
                <span className="ta-nav-name">Request a fee change</span>
                <span className="ta-nav-sub">Ask for a new platform fee per shop</span>
              </span>
              <svg
                className="ta-nav-chevron"
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 5.5 15.5 12 9 18.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="ta-nav-group">
          <p className="ta-nav-group-title">Preferences</p>
          <div className="ta-nav-card">
            <div className="ta-nav-row">
              <span className="ta-nav-icon" aria-hidden="true">
                <HiOutlineSwatch />
              </span>
              <span className="ta-nav-text">
                <span className="ta-nav-name">Appearance</span>
                <span className="ta-nav-sub">Auto — Light</span>
              </span>
              <svg
                className="ta-nav-chevron"
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 5.5 15.5 12 9 18.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <span className="ta-logout">
          <HiOutlineArrowRightOnRectangle aria-hidden="true" />
          Log out
        </span>
      </AppScroll>
    </AppPhone>
  );
}

/**
 * Customer app `SellWithUs` (`features/seller-onboarding/SellerRegistrationScreen.tsx`).
 * One scrolling screen with two numbered parts — step 1 (business account) and step 2
 * (your shops). Each tour step is a scroll position on this same screen.
 */
export function RegistrationScreen({ activeTarget }: ScreenProps) {
  const on = (t: string) => activeTarget === t;
  return (
    <AppPhone>
      <AppHeader title="Sell with us" back />
      <AppScroll>
        <AppHero />

        <AppStep index={1} title="Business account" />

        <AppSection
          title="Business identity"
          note="The account that owns your shops. PAN is required; GSTIN is optional."
        >
          <AppField
            label="Business name"
            value="Sharma Traders"
            target="business-name"
            active={on("business-name")}
          />
          <AppField label="Owner / contact name" value="Rohit Sharma" />
          <AppField label="GSTIN (optional)" value="34ABCDE1234F1Z5" mono />
          <AppField label="PAN" value="ABCDE1234F" mono />
          <AppField label="Business address" value="12, Bharathiar Road, Karaikal" />
          <AppField label="Contact phone" value="+91 98436 31722" readOnly />
          <AppField label="Contact email" value="owner@business.com" />
        </AppSection>

        <AppSection
          title="KYC documents"
          note="Images are uploaded to a private bucket and shown only to you and the review team. Your state and district are set from the first shop pin in Part 2."
        >
          <AppDocRow label="Bank passbook" status="Captured" done />
        </AppSection>

        <AppSection
          title="Payout account"
          note="The default account for every shop. A shop can override it in Part 2. The full account number is sent to Razorpay and never stored by Faazio."
        >
          <AppField
            label="Bank name"
            value="HDFC Bank"
            target="payout-account"
            active={on("payout-account")}
          />
          <AppField label="Account number" value="•••• •••• 4821" mono />
          <AppField label="IFSC" value="HDFC0001234" mono />
          <AppField label="Beneficiary name" value="Rohit Sharma" />
        </AppSection>

        <AppSection
          title="Contract & terms"
          note="Pick a rate card, then accept the agreements that apply to every shop."
        >
          <AppSelect
            label="Contract tier"
            required
            value="Standard · 10%"
            target="contract-tier"
            active={on("contract-tier")}
          />
          <AppContractSummary
            commission="10%"
            payout="T+2 business days"
            terms="Payouts settle T+2 business days after delivery, net of commission, TCS and TDS."
            version="v1"
          />
          <AppClickwrap label="I accept the Terms of Service" checked />
          <AppClickwrap label="I accept the Seller / Partner Agreement" checked />
          <AppClickwrap label="I grant Faazio the content and IP licence" checked />
        </AppSection>

        <AppSection
          title="Digital signature"
          note="We send a one-time code to +91 98436 31722. Verifying it signs the application."
        >
          <AppOtpRow target="otp" active={on("otp")} />
          <p className="ta-link">Resend OTP in 42s</p>
        </AppSection>

        <AppStep index={2} title="Your shops" />
        <AppSection note="Add every shop you run. Each shop picks its own app, category, platform fee, documents, optional bank account and map pin.">
          <AppShopCard app="Mart" name="Sharma Traders" active={on("shop-app")} />
          <span className="ta-add-shop">
            <HiOutlinePlus aria-hidden="true" />
            Add another shop
          </span>
          <AppGeoNote />
        </AppSection>

        <AppSubmit target="submit-for-review" active={on("submit-for-review")} />
        <AppSecureNote />
      </AppScroll>
    </AppPhone>
  );
}

/** The PENDING_REVIEW state the same screen swaps to after `POST /sellers`. */
export function ReviewScreen({ activeTarget }: ScreenProps) {
  return (
    <AppPhone>
      <AppHeader title="Sell with us" back />
      <AppScroll>
        <AppReviewCard active={activeTarget === "review-done"} />
      </AppScroll>
    </AppPhone>
  );
}

/**
 * Seller app `SellerPlatformFeeRequestScreen`
 * (`features/seller-onboarding/SellerPlatformFeeRequestScreen.tsx`): the store's
 * current platform fee, the requested-percent field, the reason, `Submit
 * request`, then the request history as old → requested percent with a status.
 * One pending request per store; a second submit is refused.
 */
export function FeeRequestScreen({ activeTarget }: ScreenProps) {
  return (
    <AppPhone>
      <AppHeader title="Platform fee" back />
      <AppScroll>
        <AppSection
          title="Request a fee change"
          note="Your platform fee is fixed when your store is approved. Ask for a new rate per shop here and an admin will review it."
        >
          <div
            className="ta-field"
            data-tour-target="fee-current"
            data-active={activeTarget === "fee-current" || undefined}
          >
            <span className="ta-field-label">Current fee · Sharma Mart</span>
            <span className="ta-field-box">10%</span>
          </div>
          <AppField
            label="Requested fee (%)"
            value="12"
            target="fee-amount"
            active={activeTarget === "fee-amount"}
          />
          <div
            className="ta-field"
            data-tour-target="fee-reason"
            data-active={activeTarget === "fee-reason" || undefined}
          >
            <span className="ta-field-label">Why should the fee change?</span>
            <span className="ta-field-box">
              Higher packaging and delivery costs in our area this quarter.
            </span>
          </div>
          <p className="ta-note">A request for 12% is pending review.</p>
          <span
            className="ta-submit"
            data-tour-target="fee-submit"
            data-active={activeTarget === "fee-submit" || undefined}
          >
            Submit request
          </span>
        </AppSection>

        <AppSection title="History" note="One request per store can be pending at a time.">
          <div
            className="ta-field"
            data-tour-target="fee-history"
            data-active={activeTarget === "fee-history" || undefined}
          >
            <span className="ta-field-label">10% → 12%</span>
            <span className="ta-field-box">PENDING · 17 Nov 2026</span>
          </div>
          <div className="ta-field">
            <span className="ta-field-label">10% → 8%</span>
            <span className="ta-field-box">REJECTED · 4 Sep 2026</span>
          </div>
        </AppSection>
      </AppScroll>
    </AppPhone>
  );
}
