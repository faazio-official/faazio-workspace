import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BadgePercent,
  Bell,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  LayoutGrid,
  Lock,
  Mail,
  Menu,
  MessageSquareText,
  Plus,
  Receipt,
  ScanLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { FaazioLogo } from "@/components/faazio-logo";

/**
 * Replica of the seller portal's mobile chrome and kit for the `/help-centre`
 * stage. Sizes and spacing follow `client/web/platform` (PageHeader, Card,
 * Toggle, TextField, SellerBottomNav, FixedActionBar) scaled to the 330px
 * stage; colours come from the `--tp-*` tokens in `styles.css`, which mirror
 * `client/web/platform/src/styles.css` in light and dark. Nothing here renders
 * a focusable control: the stage is decorative and `aria-hidden`.
 */

type TargetProps = { target?: string | undefined; active?: boolean | undefined };

export function PortalPhone({ children }: { children: ReactNode }) {
  return <div className="tp-device">{children}</div>;
}

/** `PageHeader`: back arrow, small uppercase sub, title, optional actions, explore menu. */
export function PortalPageHeader({
  title,
  sub,
  target,
  active = false,
  action,
  menu = true,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  menu?: boolean;
} & TargetProps) {
  return (
    <header
      className="tp-header"
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      <span className="tp-header-back" aria-hidden="true">
        <ArrowLeft />
      </span>
      <span className="tp-header-text">
        {sub ? <span className="tp-header-sub">{sub}</span> : null}
        <span className="tp-header-title">{title}</span>
      </span>
      {action}
      {menu ? (
        <span className="tp-header-action" aria-hidden="true">
          <Menu />
        </span>
      ) : null}
    </header>
  );
}

/**
 * The portal `main` scrolls. `TourStage` owns the scroll placement, so this
 * reuses the `.ta-scroll` helpers and only overrides their padding.
 */
export function PortalScroll({
  children,
  action = false,
  bleed = false,
}: {
  children: ReactNode;
  action?: boolean;
  bleed?: boolean;
}) {
  return (
    <div className="ta-scroll tp-scroll">
      <div
        className={[
          "ta-scroll-inner tp-scroll-inner",
          action ? "tp-scroll-inner--action" : "",
          bleed ? "tp-scroll-inner--bleed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * One notification row from `/seller/notifications`: the unread dot, the bold
 * title, the body and the timestamp, tinted while unread. Rows are full-bleed.
 */
export function PortalNotifRow({
  title,
  body,
  time,
  unread = false,
  target,
  active = false,
}: {
  title: string;
  body?: string;
  time: string;
  unread?: boolean;
} & TargetProps) {
  return (
    <div
      className="tp-notif"
      data-unread={unread || undefined}
      data-tour-target={target}
      data-active={active || undefined}
    >
      <span className="tp-notif-dot" data-on={unread || undefined} aria-hidden="true" />
      <span className="tp-notif-body">
        <span className="tp-notif-title">{title}</span>
        {body ? <span className="tp-notif-text">{body}</span> : null}
        <span className="tp-notif-time">{time}</span>
      </span>
    </div>
  );
}

export function PortalCard({ children }: { children: ReactNode }) {
  return <div className="tp-card">{children}</div>;
}

/** The card's intro block: bold title over the muted note under it. */
export function PortalCardHead({
  title,
  note,
  target,
  active = false,
}: { title: string; note: string } & TargetProps) {
  return (
    <div
      className="tp-card-head"
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      <p className="tp-card-title">{title}</p>
      <p className="tp-card-note">{note}</p>
    </div>
  );
}

/** Vendor card head: name, address · platform fee, and the sector badge. */
export function PortalVendorHead({
  name,
  sub,
  sector,
  sectorLabel,
  target,
  active = false,
}: {
  name: string;
  sub: string;
  sector: "mart" | "food" | "pharma";
  sectorLabel: string;
} & TargetProps) {
  return (
    <div
      className="tp-vendor-head"
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      <span className="tp-vendor-text">
        <span className="tp-vendor-name">{name}</span>
        <span className="tp-vendor-sub">{sub}</span>
      </span>
      <span className="tp-sector" data-sector={sector}>
        {sectorLabel}
      </span>
    </div>
  );
}

/** `TextField`: muted label above a bordered 16px input box. */
export function PortalField({
  label,
  value,
  target,
  active = false,
}: {
  label: string;
  value: string;
} & TargetProps) {
  return (
    <div className="tp-field" data-tour-target={target} data-active={active ? "true" : undefined}>
      <span className="tp-field-label">{label}</span>
      <span className="tp-field-box">{value}</span>
    </div>
  );
}

/** `Toggle`: 40×24 pill, success fill when on. */
export function PortalSwitchRow({
  label,
  sub,
  on = false,
  top = false,
  target,
  active = false,
}: {
  label: string;
  sub?: string;
  on?: boolean;
  top?: boolean;
} & TargetProps) {
  return (
    <div
      className={top ? "tp-switch-row tp-switch-row--top" : "tp-switch-row"}
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      <span className="tp-switch-label">
        {label}
        {sub ? <small>{sub}</small> : null}
      </span>
      <span className="tp-toggle" data-on={on || undefined} aria-hidden="true" />
    </div>
  );
}

/** The App picker: rounded chips, the selected one filled with the ink colour. */
export function PortalChips({ items }: { items: { label: string; on?: boolean }[] }) {
  return (
    <div className="tp-chips">
      {items.map((item) => (
        <span key={item.label} className="tp-chip" data-on={item.on || undefined}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** The state picker button: small "State" label above the value. */
export function PortalStatePicker({ value }: { value: string }) {
  return (
    <span className="tp-state">
      <span className="tp-state-label">State</span>
      <span className="tp-state-value">{value}</span>
    </span>
  );
}

/** The dashed document drop zone with its upload glyph and status line. */
/**
 * A tappable picker card from the wizard: the field label, the chosen value in
 * semibold, and an optional helper note. The real console opens a sheet here.
 */
export function PortalPicker({
  label,
  value,
  note,
  muted = false,
  target,
  active = false,
}: {
  label: string;
  value: string;
  note?: string;
  muted?: boolean;
} & TargetProps) {
  return (
    <div className="tp-picker" data-tour-target={target} data-active={active ? "true" : undefined}>
      <span className="tp-picker-label">{label}</span>
      <span className="tp-picker-value" data-muted={muted || undefined}>
        {value}
      </span>
      {note ? <span className="tp-picker-note">{note}</span> : null}
    </div>
  );
}

export function PortalUpload({ status }: { status: string }) {
  return (
    <div className="tp-upload">
      <Upload aria-hidden="true" />
      <span>{status}</span>
    </div>
  );
}

/** `PrimaryButton` — rounded-xl ink button. */
export function PortalPrimary({
  children,
  block = false,
  grow = false,
  tone,
  target,
  active = false,
}: {
  children: ReactNode;
  block?: boolean;
  grow?: boolean;
  tone?: "brand";
} & TargetProps) {
  return (
    <span
      className="tp-primary"
      data-tone={tone}
      data-block={block || undefined}
      data-grow={grow || undefined}
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      {children}
    </span>
  );
}

/** `FixedActionBar`: the page's sticky footer above the floating nav. */
export function PortalActionBar({
  children,
  split = false,
  target,
  active = false,
}: {
  children: ReactNode;
  split?: boolean;
} & TargetProps) {
  return (
    <div className="tp-actionbar">
      {split ? <span className="tp-actionbar-back">Back</span> : null}
      <PortalPrimary block target={target} active={active} grow={split}>
        {children}
      </PortalPrimary>
    </div>
  );
}

type NavMode = "orders" | "hub";

/**
 * `SellerBottomNav` items. Food shops swap the third tab for `Menu` (the dish
 * editor); Mart and Pharmacy shops get `Offers` instead — exactly
 * `ordersNav` / `hubNav` in `components/sellers/shells.tsx`.
 */
function ordersNav(food: boolean) {
  return [
    { label: "Orders", icon: ClipboardList, active: true },
    { label: "Stock", icon: Boxes },
    food ? { label: "Menu", icon: BookOpen } : { label: "Offers", icon: BadgePercent },
    { label: "Reviews", icon: MessageSquareText },
  ];
}

function hubNav(food: boolean) {
  return [
    { label: "Home", icon: LayoutGrid, active: true },
    { label: "Ads", icon: TrendingUp },
    food ? { label: "Menu", icon: BookOpen } : { label: "Offers", icon: BadgePercent },
    { label: "Payments", icon: Wallet },
  ];
}

/**
 * `SellerBottomNav`: a round mode-switch button beside a dark pill of tabs. The
 * switch sits on the right in Orders mode and on the left in Home mode.
 */
export function PortalBottomNav({
  mode,
  food = false,
}: {
  mode: NavMode;
  /** Food shops: `Menu` instead of `Offers` in the third slot. */
  food?: boolean;
}) {
  const items = mode === "orders" ? ordersNav(food) : hubNav(food);
  const switchButton = (
    <span className="tp-nav-switch">
      <ArrowLeftRight />
      <span>{mode === "orders" ? "Home" : "Orders"}</span>
    </span>
  );
  return (
    <nav className="tp-nav" aria-hidden="true">
      {mode === "hub" ? switchButton : null}
      <span className="tp-nav-pill">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <span key={item.label} className="tp-nav-item" data-active={item.active || undefined}>
              <Icon />
              <span>{item.label}</span>
            </span>
          );
        })}
      </span>
      {mode === "orders" ? switchButton : null}
    </nav>
  );
}

/* ── Extra chrome for the store-setup chapter ───────────────────────────────
 * The store chapter starts before the console exists: the seller app's first
 * paint is the portal `/login` card inside the native WebView, then the console
 * (Orders), then Stores → Add a shop. These pieces mirror
 * `client/web/platform/app/login`, `sellers/kit.tsx` and the products/stores
 * pages at the 330px stage scale. */

/** A `PageHeader` `right` action — the ink pill (e.g. Stores' `Add shop`). */
export function PortalHeaderAction({
  label,
  icon,
  tone = "ink",
  target,
  active = false,
}: {
  label: string;
  icon?: ReactNode;
  tone?: "ink" | "soft";
} & TargetProps) {
  return (
    <span
      className="tp-header-btn"
      data-tone={tone}
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      {icon}
      {label}
    </span>
  );
}

/** A flat `+ Add shop` entry row, matching the console's dashed create row. */
export function PortalCreateRow({ target, active = false }: TargetProps) {
  return (
    <span
      className="tp-create-row"
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      <Plus />
      Add a shop
    </span>
  );
}

/**
 * Portal `/login` — the seller app's first paint. Brand rings, wordmark,
 * `Welcome back`, the email/password fields with their leading glyphs, the
 * remember checkbox, the ink `Sign in` button and the superadmin footer note.
 */
export function PortalLoginScreen({ target, active = false }: TargetProps) {
  return (
    <div className="tp-login">
      <span className="tp-login-rings" aria-hidden="true">
        <span className="tp-login-ring tp-login-ring--a" />
        <span className="tp-login-ring tp-login-ring--b" />
      </span>
      <div className="tp-login-card" data-tour-target={target} data-active={active || undefined}>
        <FaazioLogo className="tp-login-logo" />
        <p className="tp-login-title">Welcome back</p>
        <p className="tp-login-sub">Sign in to continue to Faazio</p>

        <span className="tp-login-label">Work email</span>
        <span className="tp-login-input">
          <Mail />
          you@faazio.com
        </span>

        <span className="tp-login-label">Password</span>
        <span className="tp-login-input">
          <Lock />
          Your password
        </span>

        <span className="tp-login-remember">
          <span className="tp-login-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="8" height="8" fill="none">
              <path
                d="M5 12.5 9.5 17 19 7"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Stay signed in on this device
        </span>

        <span className="tp-login-submit">
          Sign in
          <ArrowRight />
        </span>

        <p className="tp-login-legal">
          By continuing, you agree to our Terms &amp; Conditions and Privacy Policy
        </p>
      </div>
      <p className="tp-login-foot">
        <ShieldCheck />
        <span>Access is issued by a Faazio superadmin.</span>
      </p>
    </div>
  );
}

/**
 * Orders board header. The shop-name bar at top left is the `StoreSwitcher`
 * trigger; the `Online` chip beside it is a separate link to the outlet-status
 * page, so only the name bar may carry the switcher target.
 */
export function PortalOrdersHeader({
  shop = "Sharma Kitchen",
  area = "12, Bharathiar Road, Karaikal",
  switcherTarget,
  switcherActive = false,
}: {
  /** `StoreSwitcher` trigger text. The console shows `Your shop` before the first vendor exists. */
  shop?: string;
  area?: string;
  switcherTarget?: string;
  switcherActive?: boolean;
}) {
  return (
    <header className="tp-header">
      <span className="tp-orders-head">
        <span
          className="tp-orders-shop"
          data-tour-target={switcherTarget}
          data-active={switcherActive ? "true" : undefined}
        >
          <span className="tp-orders-name">
            {shop}
            <ChevronDown />
          </span>
          <span className="tp-orders-area">{area}</span>
        </span>
        <span className="tp-orders-online">
          <span className="tp-orders-dot" aria-hidden="true" />
          Online
          <ChevronRight />
        </span>
      </span>
      <span className="tp-header-action" aria-hidden="true">
        <ScanLine />
      </span>
      <span className="tp-header-action" aria-hidden="true">
        <Search />
      </span>
      <span className="tp-header-action" aria-hidden="true">
        <Menu />
      </span>
    </header>
  );
}

/** `PillTabs` on the orders board: Preparing / Ready / Out for delivery. */
export function PortalPillTabs({
  items,
  target,
  active = false,
}: {
  items: { label: string; on?: boolean; count?: number; target?: string }[];
} & TargetProps) {
  // A step that names one pill ("Sales") rings that pill; a step that names the
  // row ("Order status") rings the row. Never both — one target, one element.
  const perItem = items.some((item) => item.target);
  return (
    <div
      className="tp-pills"
      data-tour-target={perItem ? undefined : target}
      data-active={!perItem && active ? "true" : undefined}
    >
      {items.map((item) => (
        <span
          key={item.label}
          className="tp-pill"
          data-on={item.on || undefined}
          data-tour-target={item.target}
          data-active={item.target && active ? "true" : undefined}
        >
          {item.label}
          {item.count ? <span className="tp-pill-count">{item.count}</span> : null}
        </span>
      ))}
    </div>
  );
}

/**
 * One order card from `/seller/orders`: sector chip, `#id`, customer, placed time,
 * the `Details` / `Total bill` rows, then the footer — an SLA note with
 * `Reject` + `Accept` on a new order, or `Pickup QR` + the next-step button once
 * it is packed.
 */
export function PortalOrderCard({
  stage = "new",
  target,
  active = false,
  rejectTarget,
  rejectActive = false,
  qrTarget,
  qrActive = false,
  nextTarget,
  nextActive = false,
}: {
  stage?: "new" | "packed";
  rejectTarget?: string;
  rejectActive?: boolean;
  qrTarget?: string;
  qrActive?: boolean;
  nextTarget?: string;
  nextActive?: boolean;
} & TargetProps) {
  return (
    <div className="tp-order" data-tour-target={target} data-active={active || undefined}>
      <div className="tp-order-top">
        <span className="tp-sector" data-sector="food">
          Food
        </span>
        <p className="tp-order-id">#FAZ10428</p>
        <p className="tp-order-customer">A. Kumar</p>
        <span className="tp-order-time">4:12 PM</span>
      </div>
      <div className="tp-order-rows">
        <span>
          <ClipboardList />
          Details
          <b>2 items</b>
        </span>
        <span>
          <Receipt />
          Total bill
          <b>₹640</b>
        </span>
      </div>
      <div className="tp-order-actions">
        <span className="tp-order-sla">
          <Clock />
          {stage === "new" ? "11.4h left" : "SLA 8.2h left"}
        </span>
        {stage === "new" ? (
          <>
            <span
              className="tp-order-reject"
              data-tour-target={rejectTarget}
              data-active={rejectActive || undefined}
            >
              Reject
            </span>
            <span className="tp-order-accept">Accept</span>
          </>
        ) : (
          <>
            <span
              className="tp-order-reject"
              data-tour-target={qrTarget}
              data-active={qrActive || undefined}
            >
              Pickup QR
            </span>
            <span
              className="tp-order-accept"
              data-tour-target={nextTarget}
              data-active={nextActive || undefined}
            >
              Handed over
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** The empty console's first-run prompt on `/seller/products`. */
export function PortalProductsEmpty({ target, active = false }: TargetProps) {
  return (
    <div className="tp-empty-card">
      <span className="tp-empty-art" aria-hidden="true">
        🏪
      </span>
      <p className="tp-empty-text">
        Listings belong to a shop. Create your first vendor first, then come back to list products.
      </p>
      <span className="tp-empty-cta" data-tour-target={target} data-active={active || undefined}>
        Create a shop
      </span>
    </div>
  );
}

/** `StoreSwitcher` popover: the shop list with live dots and the active tick. */
export function PortalStoreSwitcher({ target, active = false }: TargetProps) {
  return (
    <div className="tp-switcher" data-tour-target={target} data-active={active || undefined}>
      <p className="tp-switcher-label">Switch shop</p>
      <div className="tp-switcher-row" data-active="true">
        <span className="tp-switcher-text">
          <span className="tp-switcher-name">
            Sharma Kitchen
            <span className="tp-switcher-dot" aria-hidden="true" />
          </span>
          <span className="tp-switcher-addr">12, Bharathiar Road, Karaikal</span>
        </span>
        <span className="tp-sector" data-sector="food">
          Food
        </span>
        <Check className="tp-switcher-tick" />
      </div>
      <div className="tp-switcher-row">
        <span className="tp-switcher-text">
          <span className="tp-switcher-name">
            Sharma Mart
            <span className="tp-switcher-dot" data-off aria-hidden="true" />
          </span>
          <span className="tp-switcher-addr">5, Nehru Street, Karaikal</span>
        </span>
        <span className="tp-sector" data-sector="mart">
          Mart
        </span>
      </div>
    </div>
  );
}

/* ── Console pages for the post-onboarding chapters ─────────────────────────
 * Chapters 3–10 paint the portal's own pages (`client/web/platform/app/seller/*`)
 * at stage scale: the hub-mode header, the products list, the five-step listing
 * wizard, order detail, payouts, settings, and the remaining surfaces. Same
 * rules as above — `--tp-*` tokens only, scaled to the 330px stage, and nothing
 * focusable because the whole stage is decorative. */

/**
 * `HubHeader` (`components/sellers/shells.tsx`): the shop block with the
 * `StoreSwitcher` corner, the bell with its unread count, the round shop avatar
 * that opens outlet info, and the explore menu.
 */
export function PortalHubHeader({
  caption = "Showing data for",
  shop = "Sharma Kitchen",
  target,
  bellTarget,
  bellActive = false,
  action,
  sticky,
}: {
  caption?: string;
  shop?: string;
  target?: string;
  bellTarget?: string;
  bellActive?: boolean;
  action?: ReactNode;
  sticky?: ReactNode;
} & TargetProps) {
  return (
    <header className="tp-hub-head" data-tour-target={target}>
      <span className="tp-hub-shop">
        <span className="tp-hub-text">
          <span className="tp-hub-caption">{caption}</span>
          <span className="tp-hub-name">{shop}</span>
        </span>
        <ChevronDown aria-hidden="true" />
      </span>
      <span
        className="tp-icon-btn"
        data-tour-target={bellTarget}
        data-active={bellActive ? "true" : undefined}
      >
        <Bell />
      </span>
      <span className="tp-avatar">SK</span>
      {action}
      <span className="tp-icon-btn">
        <Menu />
      </span>
      {sticky ? <div className="tp-hub-sticky">{sticky}</div> : null}
    </header>
  );
}

/** `PillTabs` laid out under the hub header (`Reviews`, `Payments`, `Home`). */
export function PortalHubTabs({
  items,
  target,
  active = false,
}: {
  items: { label: string; on?: boolean; count?: number; target?: string }[];
} & TargetProps) {
  return (
    <div className="tp-hub-tabs">
      <PortalPillTabs items={items} target={target} active={active} />
    </div>
  );
}

/** `UnderlineTabs` (Settings): six sections on one scrolling rail. */
export function PortalUnderlineTabs({
  items,
  activeTarget,
}: {
  items: { label: string; on?: boolean; target?: string }[];
  /** The step currently being played, so its tab carries the ring. */
  activeTarget?: string;
}) {
  return (
    <div className="tp-utabs">
      {items.map((item) => (
        <span
          key={item.label}
          className="tp-utab"
          data-on={item.on || undefined}
          data-tour-target={item.target}
          data-active={item.target && item.target === activeTarget ? "true" : undefined}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** A status pill in the card vocabulary (`ACTIVE`, `PENDING REVIEW`, `LIVE`). */
export function PortalBadge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "info" | "success" | "warning" | "brand";
}) {
  return (
    <span className="tp-badge" data-tone={tone}>
      {children}
    </span>
  );
}

/** One search + filter pair, matching the products and menu headers. */
export function PortalSearchRow({
  placeholder,
  filter = true,
  target,
  active = false,
}: {
  placeholder: string;
  filter?: boolean;
} & TargetProps) {
  return (
    <div className="tp-searchrow" data-tour-target={target} data-active={active || undefined}>
      <span className="tp-search">
        <Search />
        {placeholder}
      </span>
      {filter ? (
        <span className="tp-filter">
          <SlidersHorizontal />
        </span>
      ) : null}
    </div>
  );
}

/** A KPI tile, exactly the `/seller/ads` card grid. */
export function PortalKpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="tp-kpi">
      <p className="tp-kpi-label">{label}</p>
      <p className="tp-kpi-value">{value}</p>
    </div>
  );
}

/** The 2×2 KPI grid. */
export function PortalKpis({ children }: { children: ReactNode }) {
  return <div className="tp-kpis">{children}</div>;
}

/** A definition row: muted label left, value right. */
export function PortalDlRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="tp-dl-row" data-bold={bold || undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** The five-rail wizard header from `/seller/products/new`. */
export function PortalWizard({
  steps,
  current,
  target,
  active = false,
}: {
  steps: readonly string[];
  current: number;
} & TargetProps) {
  return (
    <div data-tour-target={target} data-active={active ? "true" : undefined}>
      <div className="tp-wizard">
        {steps.map((label, index) => (
          <span
            key={label}
            className="tp-wizard-step"
            data-done={index <= current || undefined}
            data-current={index === current || undefined}
          >
            <span className="tp-wizard-bar" />
            <span className="tp-wizard-label">{label}</span>
          </span>
        ))}
      </div>
      <p className="tp-wizard-current">{steps[current]}</p>
    </div>
  );
}

/**
 * A product row from `/seller/products`: thumbnail, name + sector, category ·
 * product id, price and status pill.
 */
export function PortalProductRow({
  name,
  productId,
  category,
  sector,
  price,
  status,
  tone,
  emoji = "🍚",
  target,
  active = false,
}: {
  name: string;
  productId: string;
  category: string;
  sector: string;
  price: string;
  status: string;
  tone: "muted" | "info" | "success" | "warning" | "brand";
  emoji?: string;
} & TargetProps) {
  return (
    <div className="tp-prow" data-tour-target={target} data-active={active || undefined}>
      <span className="tp-thumb" aria-hidden="true">
        {emoji}
      </span>
      <span className="tp-prow-body">
        <span className="tp-prow-name">
          <span>{name}</span>
          <small>{sector}</small>
        </span>
        <span className="tp-prow-sub">
          {category} · {productId}
        </span>
        <span className="tp-prow-foot">
          <b>{price}</b>
          <PortalBadge tone={tone}>{status}</PortalBadge>
        </span>
      </span>
      <ChevronRight aria-hidden="true" />
    </div>
  );
}

/** A menu dish / item row from `/seller/menus`. */
export function PortalDishRow({
  name,
  sub,
  price,
  mrp,
  status,
  tone,
  veg = true,
  target,
  active = false,
  action,
}: {
  name: string;
  sub: string;
  price: string;
  mrp?: string;
  status: string;
  tone: "muted" | "info" | "success" | "warning" | "brand";
  veg?: boolean;
  action?: ReactNode;
} & TargetProps) {
  return (
    <div className="tp-prow" data-tour-target={target} data-active={active || undefined}>
      <span className="tp-veg" data-nonveg={veg ? undefined : "true"} aria-hidden="true" />
      <span className="tp-prow-body">
        <span className="tp-prow-name">
          <span>{name}</span>
        </span>
        <span className="tp-prow-sub">{sub}</span>
        <span className="tp-prow-foot">
          <b>{price}</b>
          {mrp ? <span className="tp-prow-strike">{mrp}</span> : null}
          <PortalBadge tone={tone}>{status}</PortalBadge>
        </span>
      </span>
      {action}
    </div>
  );
}

/** The order timeline on `/seller/orders/[id]`. */
export function PortalTimeline({
  stages,
  current,
  target,
  active = false,
}: {
  stages: readonly string[];
  current: number;
} & TargetProps) {
  return (
    <div
      className="tp-timeline"
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      {stages.map((stage, index) => (
        <span key={stage} className="tp-tl-row" data-done={index <= current || undefined}>
          <span className="tp-tl-dot" aria-hidden="true" />
          {stage}
          {index === current ? <PortalBadge tone="info">Current</PortalBadge> : null}
        </span>
      ))}
    </div>
  );
}

/** A simple bar series (`Analytics`, `Home → Sales`). */
export function PortalBars({
  values,
  compact = false,
}: {
  values: readonly number[];
  compact?: boolean;
}) {
  return (
    <div className="tp-bars" data-compact={compact || undefined} aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={index}
          className="tp-bar"
          data-strong={value === Math.max(...values) || undefined}
          style={{ height: `${Math.max(6, value)}%` }}
        />
      ))}
    </div>
  );
}

/** A labelled progress rail: label + value on one line, the rail underneath. */
export function PortalProgress({
  label,
  value,
  percent,
  tone = "info",
}: {
  label?: string;
  value?: string;
  percent: number;
  tone?: "info" | "brand" | "muted";
}) {
  const rail = (
    <span className="tp-progress" data-tone={tone} aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(2, percent))}%` }} />
    </span>
  );
  if (!label) return rail;

  return (
    <div className="tp-progrow">
      <span className="tp-progrow-head">
        <span>{label}</span>
        <b>{value}</b>
      </span>
      {rail}
    </div>
  );
}

/** One icon tile from the Explore grid. */
export function PortalTile({
  label,
  icon,
  badge,
  target,
  active = false,
}: { label: string; icon: ReactNode; badge?: "ON" | "OFF" } & TargetProps) {
  return (
    <span className="tp-tile" data-tour-target={target} data-active={active || undefined}>
      <span className="tp-tile-icon">{icon}</span>
      <span className="tp-tile-label">{label}</span>
      {badge ? (
        <span className="tp-tile-badge" data-on={badge === "ON" || undefined}>
          {badge}
        </span>
      ) : null}
    </span>
  );
}

/** The four-column Explore grid. */
export function PortalTileGrid({ children }: { children: ReactNode }) {
  return <div className="tp-tile-grid">{children}</div>;
}

/** An inline note banner (`You are offline`, `Payouts are manual`). */
export function PortalNote({
  children,
  tone = "info",
  icon,
  target,
  active = false,
}: {
  children: ReactNode;
  tone?: "info" | "brand" | "warning";
  icon?: ReactNode;
} & TargetProps) {
  return (
    <p
      className="tp-note"
      data-tone={tone}
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      {icon}
      <span>{children}</span>
    </p>
  );
}

/** `EmptyState`: rounded muted art above the sentence. */
export function PortalEmpty({
  children,
  icon,
  target,
  active = false,
}: {
  children: ReactNode;
  icon: ReactNode;
} & TargetProps) {
  return (
    <div className="tp-empty" data-tour-target={target} data-active={active || undefined}>
      <span className="tp-empty-art" aria-hidden="true">
        {icon}
      </span>
      <p>{children}</p>
    </div>
  );
}

/** Small tags under a shop or heading (`Live in the app`, `Pure vegetarian`). */
export function PortalTags({ items }: { items: readonly string[] }) {
  return (
    <span className="tp-tagrow">
      {items.map((item) => (
        <span key={item} className="tp-tag">
          {item}
        </span>
      ))}
    </span>
  );
}

/** `PrimaryButton` variant="outline" — the secondary action beside the ink one. */
export function PortalOutline({
  children,
  block = false,
  grow = false,
  tone,
  target,
  active = false,
}: {
  children: ReactNode;
  block?: boolean;
  grow?: boolean;
  tone?: "brand";
} & TargetProps) {
  return (
    <span
      className="tp-outline"
      data-tone={tone}
      data-block={block || undefined}
      data-grow={grow || undefined}
      data-tour-target={target}
      data-active={active ? "true" : undefined}
      style={block ? { width: "100%" } : undefined}
    >
      {children}
    </span>
  );
}

/** A pair of actions inside one card strip (`Back` / `Submit for review`). */
export function PortalActionRow({ children }: { children: ReactNode }) {
  return <div className="tp-actionrow">{children}</div>;
}

/** The small ink action inside a card (`Edit`, `Submit`, `Delist`). */
export function PortalInlineButton({
  children,
  tone = "ink",
  icon,
  target,
  active = false,
}: {
  children: ReactNode;
  tone?: "ink" | "soft";
  icon?: ReactNode;
} & TargetProps) {
  return (
    <span
      className="tp-inline-btn"
      data-tone={tone === "soft" ? "soft" : undefined}
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * A bottom sheet over the page, matching `kit.tsx`'s `Sheet` (scrim + rounded
 * card + optional footer buttons).
 */
export function PortalSheet({
  title,
  children,
  footer,
  target,
  active = false,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
} & TargetProps) {
  return (
    <div className="tp-sheet" aria-hidden="true">
      <div className="tp-sheet-card" data-tour-target={target} data-active={active || undefined}>
        <span className="tp-sheet-grip" />
        <p className="tp-sheet-title">{title}</p>
        {children}
        {footer ? <div className="tp-sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/** `RadioRow` inside a sheet. */
export function PortalRadioRow({
  label,
  sub,
  on = false,
  target,
  active = false,
}: {
  label: string;
  sub?: string;
  on?: boolean;
} & TargetProps) {
  return (
    <div
      className="tp-radio-row"
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      <span className="tp-radio-text">
        <span className="tp-radio-label">{label}</span>
        {sub ? <span className="tp-radio-sub">{sub}</span> : null}
      </span>
      <span className="tp-radio" data-on={on || undefined} />
    </div>
  );
}

/** The pickup QR from the orders sheet (`qrcode.react` in the console). */
export function PortalQr({ target, active = false }: TargetProps) {
  return (
    <div className="tp-qrbox" data-tour-target={target} data-active={active || undefined}>
      <svg viewBox="0 0 29 29" aria-hidden="true">
        <g fill="currentColor">
          <rect x="0" y="0" width="7" height="7" />
          <rect x="22" y="0" width="7" height="7" />
          <rect x="0" y="22" width="7" height="7" />
        </g>
        <g fill="var(--tp-card)">
          <rect x="1" y="1" width="5" height="5" />
          <rect x="23" y="1" width="5" height="5" />
          <rect x="1" y="23" width="5" height="5" />
        </g>
        <g fill="currentColor">
          <rect x="2" y="2" width="3" height="3" />
          <rect x="24" y="2" width="3" height="3" />
          <rect x="2" y="24" width="3" height="3" />
          <rect x="9" y="2" width="2" height="2" />
          <rect x="13" y="5" width="2" height="2" />
          <rect x="9" y="9" width="2" height="2" />
          <rect x="12" y="12" width="2" height="2" />
          <rect x="15" y="9" width="2" height="2" />
          <rect x="18" y="13" width="2" height="2" />
          <rect x="21" y="10" width="2" height="2" />
          <rect x="25" y="9" width="2" height="2" />
          <rect x="9" y="15" width="2" height="2" />
          <rect x="12" y="18" width="2" height="2" />
          <rect x="15" y="16" width="2" height="2" />
          <rect x="18" y="19" width="2" height="2" />
          <rect x="21" y="15" width="2" height="2" />
          <rect x="25" y="18" width="2" height="2" />
          <rect x="9" y="21" width="2" height="2" />
          <rect x="13" y="24" width="2" height="2" />
          <rect x="16" y="22" width="2" height="2" />
          <rect x="18" y="25" width="2" height="2" />
          <rect x="22" y="22" width="2" height="2" />
          <rect x="25" y="24" width="2" height="2" />
          <rect x="20" y="5" width="2" height="2" />
          <rect x="5" y="10" width="2" height="2" />
          <rect x="5" y="14" width="2" height="2" />
          <rect x="5" y="18" width="2" height="2" />
        </g>
      </svg>
    </div>
  );
}

/**
 * `/accept-invite` — the teammate's own card: wordmark, `Join your team`, the
 * password fields a sub-user sets, and the single-use note.
 */
export function PortalInviteCard({ target, active = false }: TargetProps) {
  return (
    <div className="tp-invite">
      <div className="tp-invite-card" data-tour-target={target} data-active={active || undefined}>
        <FaazioLogo className="tp-invite-logo" />
        <p className="tp-invite-title">Join your team</p>
        <p className="tp-invite-sub">Choose a password for your Faazio seller console account.</p>

        <span className="tp-login-label">Password</span>
        <span className="tp-login-input">
          <Lock />
          At least 12 characters
        </span>

        <span className="tp-login-label">Confirm password</span>
        <span className="tp-login-input">
          <Lock />
          Repeat your password
        </span>

        <span className="tp-login-submit">
          Set password &amp; activate
          <ArrowRight />
        </span>
      </div>
      <p className="tp-invite-note">
        <ShieldCheck />
        This link works once and expires after 7 days.
      </p>
    </div>
  );
}
