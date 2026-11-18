import type { ReactNode } from "react";
import {
  HiOutlineCheckBadge,
  HiOutlineCamera,
  HiOutlineChevronDown,
  HiOutlineEnvelope,
  HiOutlineLockClosed,
  HiOutlineMapPin,
  HiOutlinePlus,
  HiOutlineBuildingStorefront,
} from "react-icons/hi2";

/**
 * Primitives that reproduce the customer app's onboarding screens in the
 * `/help-centre` stage. Sizes follow `client/mobile/src` (dp scaled to the 330px
 * stage); colours are the `--ta-*` tokens in `styles.css`, which mirror
 * `client/mobile/src/theme/theme.ts`. Nothing here renders a focusable control:
 * the stage is decorative and `aria-hidden`.
 */

type TargetProps = { target?: string | undefined; active?: boolean };

export function AppPhone({ children }: { children: ReactNode }) {
  return <div className="ta-device">{children}</div>;
}

export function AppHeader({ title, back = false }: { title: string; back?: boolean }) {
  return (
    <div className="ta-header">
      {back ? (
        <span className="ta-back" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none">
            <path
              d="M15 5.5 8.5 12l6.5 6.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : null}
      <span className="ta-header-title">{title}</span>
      {back ? <span className="ta-header-spacer" aria-hidden="true" /> : null}
    </div>
  );
}

/** The tab-mode "You" page header: one large left-aligned title, no back arrow. */
export function AppPageHeader({ title }: { title: string }) {
  return (
    <div className="ta-header ta-header--page">
      <span className="ta-page-title">{title}</span>
    </div>
  );
}

/**
 * The app scrolls a screen taller than the phone. `TourStage` owns the scroll
 * placement (it must run before the ring is measured in the same commit) and
 * shifts this column so the step's target sits at the screen's focus line.
 */
export function AppScroll({ children }: { children: ReactNode }) {
  return (
    <div className="ta-scroll">
      <div className="ta-scroll-inner">{children}</div>
    </div>
  );
}

export function AppHero() {
  return (
    <div className="ta-hero">
      <span className="ta-hero-icon" aria-hidden="true">
        <HiOutlineBuildingStorefront />
      </span>
      <p className="ta-hero-title">Partner with Faazio</p>
      <p className="ta-hero-sub">
        Complete your business account first, then add every shop you run. A district admin reviews
        the application before your shops go live.
      </p>
    </div>
  );
}

export function AppStep({ index, title }: { index: number; title: string }) {
  return (
    <div className="ta-step">
      <span className="ta-step-badge" aria-hidden="true">
        {index}
      </span>
      <span className="ta-step-title">{title}</span>
    </div>
  );
}

export function AppSection({
  title,
  note,
  children,
}: {
  title?: string;
  note: string;
  children?: ReactNode;
}) {
  return (
    <section className="ta-section">
      {title ? <h4 className="ta-section-title">{title}</h4> : null}
      <p className="ta-note">{note}</p>
      {children}
    </section>
  );
}

export function AppField({
  label,
  value,
  target,
  active = false,
  readOnly = false,
  mono = false,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  mono?: boolean;
} & Pick<TargetProps, "target" | "active">) {
  return (
    <div className="ta-field" data-tour-target={target} data-active={active ? "true" : undefined}>
      <span className="ta-field-label">{label}</span>
      <span
        className="ta-field-box"
        data-readonly={readOnly || undefined}
        data-mono={mono || undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function AppSelect({
  label,
  value,
  placeholder = false,
  required = false,
  target,
  active = false,
}: {
  label: string;
  value: string;
  /** Renders the value in the muted placeholder tone. */
  placeholder?: boolean;
  required?: boolean;
} & Pick<TargetProps, "target" | "active">) {
  return (
    <div className="ta-field" data-tour-target={target} data-active={active ? "true" : undefined}>
      <span className="ta-field-label">
        {label}
        {required ? <span className="ta-required"> *</span> : null}
      </span>
      <span className="ta-field-box" data-placeholder={placeholder || undefined}>
        {value}
        <HiOutlineChevronDown className="ta-field-chevron" aria-hidden="true" />
      </span>
    </div>
  );
}

export function AppDocRow({
  label,
  status,
  done = false,
}: {
  label: string;
  status: string;
  done?: boolean;
}) {
  return (
    <div className="ta-doc">
      <span className="ta-doc-icon" data-done={done || undefined} aria-hidden="true">
        {done ? <HiOutlineCheckBadge /> : <HiOutlineCamera />}
      </span>
      <span className="ta-doc-text">
        <span className="ta-doc-label">{label}</span>
        <span className="ta-doc-status">{status}</span>
      </span>
      <span className="ta-doc-btn">{done ? "Retake" : "Capture"}</span>
    </div>
  );
}

export function AppClickwrap({ label, checked = false }: { label: string; checked?: boolean }) {
  return (
    <div className="ta-clickwrap">
      <span className="ta-check" data-on={checked || undefined} aria-hidden="true">
        {checked ? (
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none">
            <path
              d="M5 12.5 9.5 17 19 7"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className="ta-clickwrap-body">
        <span className="ta-clickwrap-label">{label}</span>
        <span className="ta-read">Read the summary</span>
      </span>
    </div>
  );
}

export function AppContractSummary({
  commission,
  payout,
  terms,
  version,
}: {
  commission: string;
  payout: string;
  terms: string;
  version: string;
}) {
  return (
    <div className="ta-summary">
      <div className="ta-summary-row">
        <span className="ta-summary-key">Commission</span>
        <span className="ta-summary-value">{commission}</span>
      </div>
      <div className="ta-summary-row">
        <span className="ta-summary-key">Payout</span>
        <span className="ta-summary-value">{payout}</span>
      </div>
      <p className="ta-summary-terms">{terms}</p>
      <p className="ta-summary-version">Rate card {version}</p>
    </div>
  );
}

export function AppOtpRow({ target, active = false }: Pick<TargetProps, "target" | "active">) {
  return (
    <div className="ta-otp">
      <span
        className="ta-field-box"
        data-placeholder
        data-tour-target={target}
        data-active={active ? "true" : undefined}
      >
        6-digit OTP
      </span>
      <span className="ta-otp-btn">Send OTP</span>
    </div>
  );
}

export function AppShopCard({
  app,
  name,
  active = false,
}: {
  app: string;
  name: string;
  active?: boolean;
}) {
  return (
    <div className="ta-shop">
      <div className="ta-shop-head">
        <span className="ta-shop-badge" aria-hidden="true">
          <HiOutlineBuildingStorefront />
        </span>
        <span className="ta-shop-title">Shop 1</span>
      </div>

      <AppSelect label="App" required value={app} target="shop-app" active={active} />
      <AppField label="Shop name" value={name} />
      <AppField label="Shop address" value="12, Bharathiar Road, Karaikal" />
      <AppSelect label="Category" required value="Grocery" />
      <AppField label="Platform fee %" value="10" />
      <p className="ta-helper">
        The platform retains this share of each order; the rest is settled to your bank after the
        7-day buyer-protection hold.
      </p>

      <div className="ta-pin">
        <HiOutlineMapPin aria-hidden="true" />
        <span className="ta-pin-text">
          <span className="ta-pin-title">Shop location pinned</span>
          <span className="ta-pin-value">Karaikal, Puducherry</span>
        </span>
      </div>

      <div className="ta-bank-toggle">
        <span className="ta-check" data-on aria-hidden="true">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none">
            <path
              d="M5 12.5 9.5 17 19 7"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>Same as account bank details</span>
      </div>

      <span className="ta-add-shop">
        <HiOutlinePlus aria-hidden="true" />
        Add another shop
      </span>
    </div>
  );
}

export function AppGeoNote() {
  return (
    <p className="ta-geo">State &amp; district set from your pinned shop: Puducherry · Karaikal.</p>
  );
}

export function AppSubmit({ target, active = false }: Pick<TargetProps, "target" | "active">) {
  return (
    <span className="ta-submit" data-tour-target={target} data-active={active ? "true" : undefined}>
      <HiOutlineLockClosed aria-hidden="true" />
      Submit for review
    </span>
  );
}

export function AppSecureNote() {
  return (
    <p className="ta-secure">
      <HiOutlineEnvelope aria-hidden="true" />
      <span>
        Your bank details are sent over an authenticated connection. KYC images live in a private
        bucket; secrets and OTPs are never logged.
      </span>
    </p>
  );
}

export function AppReviewCard({ active = false }: Pick<TargetProps, "active">) {
  return (
    <div className="ta-review">
      <span className="ta-review-icon" aria-hidden="true">
        <HiOutlineBuildingStorefront />
      </span>
      <p className="ta-review-title">Your request is under review</p>
      <p className="ta-review-body">
        Our professionals will contact you soon regarding your seller application.
      </p>
      <div className="ta-review-meta">
        <span className="ta-review-key">Application ID</span>
        <span className="ta-review-value">sel_2f6c1a9d</span>
      </div>
      <div className="ta-review-meta">
        <span className="ta-review-key">Shops</span>
        <span className="ta-review-value">MART</span>
      </div>
      <div className="ta-review-meta">
        <span className="ta-review-key">Contract</span>
        <span className="ta-review-value">STANDARD</span>
      </div>
      <div className="ta-review-meta">
        <span className="ta-review-key">Compliance</span>
        <span className="ta-review-value">Pending verification</span>
      </div>
      <span
        className="ta-review-done"
        data-tour-target="review-done"
        data-active={active ? "true" : undefined}
      >
        Done
      </span>
    </div>
  );
}
