import {
  AlertTriangle,
  ArrowLeft,
  BadgePercent,
  Beaker,
  Bike,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Flame,
  Hourglass,
  LifeBuoy,
  LayoutGrid,
  Link2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Megaphone,
  MessageSquareText,
  Package,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Repeat,
  Search,
  ShieldCheck,
  Settings,
  Star,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import {
  PortalActionBar,
  PortalActionRow,
  PortalBadge,
  PortalBars,
  PortalBottomNav,
  PortalCard,
  PortalCardHead,
  PortalChips,
  PortalDlRow,
  PortalDishRow,
  PortalEmpty,
  PortalField,
  PortalHeaderAction,
  PortalHubHeader,
  PortalHubTabs,
  PortalInlineButton,
  PortalInviteCard,
  PortalKpi,
  PortalKpis,
  PortalLoginScreen,
  PortalNote,
  PortalOrderCard,
  PortalOrdersHeader,
  PortalOutline,
  PortalPageHeader,
  PortalPhone,
  PortalPillTabs,
  PortalPrimary,
  PortalProductRow,
  PortalProductsEmpty,
  PortalProgress,
  PortalQr,
  PortalRadioRow,
  PortalScroll,
  PortalSearchRow,
  PortalSheet,
  PortalStatePicker,
  PortalStoreSwitcher,
  PortalSwitchRow,
  PortalTags,
  PortalTile,
  PortalTileGrid,
  PortalTimeline,
  PortalUnderlineTabs,
  PortalNotifRow,
  PortalPicker,
  PortalUpload,
  PortalVendorHead,
  PortalWizard,
} from "./portal-mock";
import type { ScreenProps } from "./screens";

const is = (activeTarget: string, target: string) => activeTarget === target;

/**
 * Portal `/seller/stores` (`app/seller/stores/page.client.tsx`): the `Account /
 * Stores` header with its `Add shop` action, then one card per vendor — name,
 * address and platform fee, sector badge, the live and pure-veg switches, the
 * opening-hours field and `Save profile`. Pharmacy vendors add their drug-licence
 * block.
 */
export function StoreScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader
        sub="Account"
        title="Stores"
        action={
          <PortalHeaderAction
            label="Add shop"
            icon={<Plus />}
            target="store-add"
            active={is(activeTarget, "store-add")}
          />
        }
      />
      <PortalScroll>
        <PortalCard>
          <PortalVendorHead
            name="Sharma Mart"
            sub="12, Bharathiar Road, Karaikal · 10% platform fee"
            sector="mart"
            sectorLabel="Mart"
            target="store-list"
            active={is(activeTarget, "store-list")}
          />
          <div className="tp-vendor-body">
            <PortalSwitchRow label="Vendor live in the app" on top />
            <PortalSwitchRow label="Pure vegetarian" />
            <PortalField label="Opening hours" value="8:00 AM - 10:00 PM" />
            <PortalPrimary block>Save profile</PortalPrimary>
          </div>
        </PortalCard>

        <PortalCard>
          <PortalVendorHead
            name="Sharma Pharmacy"
            sub="5, Nehru Street, Karaikal · 8% platform fee"
            sector="pharma"
            sectorLabel="Pharmacy"
          />
          <div className="tp-vendor-body">
            <PortalSwitchRow label="Vendor live in the app" top />
            <PortalSwitchRow label="Pure vegetarian" />
            <PortalField label="Opening hours" value="9:00 AM - 9:00 PM" />
            <PortalPrimary block>Save profile</PortalPrimary>
          </div>
          <div className="tp-licence">
            <p className="tp-card-title">Drug licence</p>
            <p className="tp-card-note">
              Pharmacy shops can add or update their drug-selling licence here.
            </p>
            <PortalField label="Drug licence number" value="TN-KAR-2019-004821" />
            <p className="tp-upload-label">Licence document</p>
            <PortalUpload status="Document uploaded ✓" />
            <PortalPrimary block>Save licence</PortalPrimary>
          </div>
        </PortalCard>
      </PortalScroll>
      <PortalBottomNav mode="orders" />
    </PortalPhone>
  );
}

/**
 * Portal `/seller/onboarding` (`app/seller/onboarding/page.client.tsx`) — the
 * `Add a vendor` form: vendor details, the app chips, the state picker, address,
 * phone, opening hours, the publish switch, the Food-only FSSAI card and the
 * fixed `Create vendor` action bar. The form is the Food path, so the card the
 * fourth step types into is the one the real page renders for a Food vendor.
 */
export function StoreCreateScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader sub="Onboarding" title="Add a vendor" />
      <PortalScroll action>
        <PortalCard>
          <PortalCardHead
            title="Vendor details"
            note="A vendor is one shop in one app. Your account can own several vendors."
            target="new-store"
            active={is(activeTarget, "new-store")}
          />
          <PortalField
            label="Vendor name"
            value="Sharma Kitchen"
            target="store-name"
            active={is(activeTarget, "store-name")}
          />
          <p className="tp-apps-label">App</p>
          <PortalChips
            items={[{ label: "Mart" }, { label: "Food", on: true }, { label: "Pharma" }]}
          />
          <PortalStatePicker value="TN · Tamil Nadu" />
          <PortalField label="Address" value="12, Bharathiar Road, Karaikal" />
          <PortalField label="Phone" value="+91 98436 31722" />
          <PortalField label="Opening hours" value="10:00 AM - 9:30 PM" />
          <PortalSwitchRow label="Publish this vendor now" />
        </PortalCard>

        <PortalCard>
          <p className="tp-card-title">FSSAI compliance (optional)</p>
          <p className="tp-card-note">
            Add both now or later; an admin verifies compliance during review.
          </p>
          <PortalField
            label="FSSAI number"
            value="12345678901234"
            target="store-licence"
            active={is(activeTarget, "store-licence")}
          />
          <p className="tp-upload-label">FSSAI certificate</p>
          <PortalUpload status="Certificate uploaded ✓" />
        </PortalCard>
      </PortalScroll>
      <PortalActionBar target="store-save" active={is(activeTarget, "store-save")}>
        Create vendor
      </PortalActionBar>
      <PortalBottomNav mode="hub" food />
    </PortalPhone>
  );
}

/**
 * The seller partner app on open: the native WebView shell (`SellerWebViewScreen`)
 * pointed at the portal `/login` card. This is the real first paint — a shop
 * owner signs in with the credentials a superadmin issued on approval.
 */
export function StoreLoginScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalLoginScreen target="store-login" active={is(activeTarget, "store-login")} />
    </PortalPhone>
  );
}

/**
 * `/seller/orders` on an empty console (`app/seller/orders/page.client.tsx`):
 * the orders top bar with the shop switcher and `Online` chip, the status pill
 * tabs, and the new order card with its Reject / Accept actions.
 */
export function StoreOrdersScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalOrdersHeader
        shop="Your shop"
        area="Seller console"
        switcherTarget="store-orders"
        switcherActive={is(activeTarget, "store-orders")}
      />
      <PortalScroll>
        <PortalPillTabs
          items={[
            { label: "New", on: true },
            { label: "Packed" },
            { label: "Out for delivery" },
            { label: "Delivered" },
          ]}
        />
        <div className="tp-empty">
          <span className="tp-empty-art" aria-hidden="true">
            <ClipboardList />
          </span>
          <p className="tp-empty-text">No new orders right now</p>
        </div>
      </PortalScroll>
      <PortalBottomNav mode="orders" />
    </PortalPhone>
  );
}

/**
 * `/seller/products` with no vendor yet (`app/seller/products/new/page.client.tsx`
 * empty state): listings belong to a shop, so the console asks for one first and
 * links to `Add a vendor`. This is the console's own create-shop entry.
 */
export function StoreProductsEmptyScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader sub="Catalog" title="List a new product" />
      <PortalScroll>
        <PortalProductsEmpty
          target="store-create-shop"
          active={is(activeTarget, "store-create-shop")}
        />
      </PortalScroll>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/**
 * The multi-shop switcher (`sellers/StoreSwitcher.tsx`) opened from the orders
 * header: every shop the account owns, each with its live dot, address, sector
 * chip and the active tick — how a seller moves between the shops they created.
 */
export function StoreSwitcherScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalOrdersHeader
        switcherTarget="store-switcher"
        switcherActive={is(activeTarget, "store-switcher")}
      />
      <PortalScroll>
        <PortalPillTabs
          items={[
            { label: "Preparing", on: true, count: 1 },
            { label: "Ready" },
            { label: "Out for delivery" },
            { label: "Delivered" },
          ]}
        />
        <PortalOrderCard />
      </PortalScroll>
      <PortalStoreSwitcher
        target="store-switcher-list"
        active={is(activeTarget, "store-switcher-list")}
      />
      <PortalBottomNav mode="orders" food />
    </PortalPhone>
  );
}

/** `/seller/products` (`Catalog`): search, filter, and one row per listing. */
export function CatalogListScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader
        sub="Catalog"
        title="Products"
        action={
          <span className="tp-header-pair">
            <PortalHeaderAction label="Trash" icon={<Trash2 />} tone="soft" />
            <PortalHeaderAction
              label="Add"
              icon={<Plus />}
              target="product-add"
              active={is(activeTarget, "product-add")}
            />
          </span>
        }
      />
      <PortalScroll>
        <PortalSearchRow placeholder="Search name or product id" />
        <PortalChips
          items={[
            { label: "All", on: true },
            { label: "Mart" },
            { label: "Food" },
            { label: "Pharmacy" },
          ]}
        />
        <PortalProductRow
          name="Basmati rice 5 kg"
          productId="PRD-1042"
          category="Rice & grains"
          sector="Mart"
          price="₹520"
          status="Active"
          tone="success"
          emoji="🌾"
        />
        <PortalProductRow
          name="Toor dal 1 kg"
          productId="PRD-1043"
          category="Dals & pulses"
          sector="Mart"
          price="₹145"
          status="Pending review"
          tone="warning"
          emoji="🫘"
          target="product-pending"
          active={is(activeTarget, "product-pending")}
        />
        <PortalProductRow
          name="Cold-pressed sunflower oil 1 L"
          productId="PRD-1044"
          category="Cooking oil"
          sector="Mart"
          price="₹138"
          status="Active"
          tone="success"
          emoji="🧴"
        />
        <PortalProductRow
          name="Amul butter 500 g"
          productId="PRD-1045"
          category="Dairy"
          sector="Mart"
          price="₹275"
          status="Active"
          tone="success"
          emoji="🧈"
          target="catalog-row"
          active={is(activeTarget, "catalog-row")}
        />
        <PortalProductRow
          name="Dolo 650 strip"
          productId="PRD-1046"
          category="Fever"
          sector="Pharmacy"
          price="₹32"
          status="Delisted"
          tone="muted"
          emoji="💊"
        />
      </PortalScroll>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

const WIZARD_STEPS = ["Category", "Details", "Pricing", "Inventory", "Review"] as const;

/** The wizard step the stage is on, derived from the active target. */
function wizardStep(activeTarget: string): number {
  if (["product-store", "product-category", "product-gst"].includes(activeTarget)) return 0;
  if (["product-name", "product-image"].includes(activeTarget)) return 1;
  if (activeTarget === "product-price") return 2;
  if (activeTarget === "product-stock") return 3;
  if (["product-review", "product-submit"].includes(activeTarget)) return 4;
  return 0;
}

/**
 * Portal `/seller/products/new` — `List a new product`, the five-step wizard.
 * The step shown follows the active step so one screen covers the whole flow:
 * Category → Details → Pricing → Inventory → Review, with the fixed
 * `Submit for review` bar.
 */
export function CatalogAddScreen({ activeTarget }: ScreenProps) {
  const step = wizardStep(activeTarget);

  return (
    <PortalPhone>
      <PortalPageHeader sub={`Step ${step + 1} of 5`} title="List a new product" />
      <PortalScroll action>
        <PortalWizard steps={WIZARD_STEPS} current={step} />

        {step === 0 ? (
          <>
            <PortalCard>
              <p className="tp-field-label">Sector</p>
              <p className="tp-sector-line">
                Mart
                <small>Fixed by your registration.</small>
              </p>
            </PortalCard>
            <PortalCard>
              <PortalPicker
                label="Store"
                value="Sharma Mart"
                target="product-store"
                active={is(activeTarget, "product-store")}
              />
              <PortalPicker
                label="Category"
                value="Rice &amp; grains"
                note="The app-scoped taxonomy used by the home rail and category drill-in."
                target="product-category"
                active={is(activeTarget, "product-category")}
              />
              <PortalPicker
                label="GST category"
                value="Rice &amp; grains · GST 5%"
                target="product-gst"
                active={is(activeTarget, "product-gst")}
              />
            </PortalCard>
          </>
        ) : null}

        {step === 1 ? (
          <PortalCard>
            <PortalField
              label="Product name"
              value="Basmati rice 5 kg"
              target="product-name"
              active={is(activeTarget, "product-name")}
            />
            <PortalField label="Description" value="Long-grain basmati rice, 5 kg bag." />
            <PortalField label="Unit" value="1 bag" />
            <div
              className="tp-upload-dashed"
              data-tour-target="product-image"
              data-active={is(activeTarget, "product-image") || undefined}
            >
              <PortalUpload status="Photo uploaded ✓" />
              <p className="tp-upload-hint">
                At least one photo is required before this listing can go live.
              </p>
            </div>
          </PortalCard>
        ) : null}

        {step === 2 ? (
          <PortalCard>
            <PortalField
              label="Selling price (₹, GST included)"
              value="520"
              target="product-price"
              active={is(activeTarget, "product-price")}
            />
            <p className="tp-field-hint">
              Shoppers pay this final price. GST is included, not added on top.
            </p>
            <div className="tp-gstrate">
              <span className="tp-gstrate-label">GST rate</span>
              <span className="tp-gstrate-value">5%</span>
            </div>
            <div className="tp-deductions">
              <p className="tp-deductions-head">What you keep (per unit)</p>
              <dl className="tp-dl">
                <PortalDlRow label="Customer pays (GST incl.)" value="₹520.00" />
                <PortalDlRow label="Taxable value" value="₹495.24" />
                <PortalDlRow label="Product GST (remitted by you)" value="₹24.76" />
                <PortalDlRow label="Platform fee (10%)" value="− ₹46.19" />
                <PortalDlRow label="GST on platform fee (18%)" value="₹8.31" />
                <PortalDlRow label="TCS (1%)" value="− ₹4.95" />
                <PortalDlRow label="TDS (0.1%)" value="− ₹0.50" />
                <PortalDlRow label="Net seller payout per unit" value="₹435.29" bold />
              </dl>
              <p className="tp-deductions-note">
                Estimate using your shop's fee and the approved GST rate. The gateway recomputes the
                final split at settlement.
              </p>
            </div>
          </PortalCard>
        ) : null}

        {step === 3 ? (
          <PortalCard>
            <PortalField
              label="Stock quantity"
              value="24"
              target="product-stock"
              active={is(activeTarget, "product-stock")}
            />
            <p className="tp-field-hint">Delivery ETA is platform-owned (30 minutes by default).</p>
          </PortalCard>
        ) : null}

        {step === 4 ? (
          <div
            data-tour-target="product-review"
            data-active={is(activeTarget, "product-review") || undefined}
          >
            <PortalCard>
              <div className="tp-review-photos">
                <span className="tp-review-photo" aria-hidden="true" />
              </div>
              <dl className="tp-dl">
                <PortalDlRow label="Sector / category" value="Mart · Rice & grains" />
                <PortalDlRow label="GST category" value="Rice & grains" />
                <PortalDlRow label="Name" value="Basmati rice 5 kg" />
                <PortalDlRow label="Unit" value="1 bag" />
                <PortalDlRow label="Price (GST incl.)" value="₹520.00" />
                <PortalDlRow label="GST rate" value="5%" />
                <PortalDlRow label="Stock" value="24 units" />
                <PortalDlRow label="Status on submit" value="PENDING_REVIEW" />
              </dl>
              <div className="tp-deductions">
                <p className="tp-deductions-head">What you keep (per unit)</p>
                <dl className="tp-dl">
                  <PortalDlRow label="Customer pays (GST incl.)" value="₹520.00" />
                  <PortalDlRow label="Taxable value" value="₹495.24" />
                  <PortalDlRow label="Product GST (remitted by you)" value="₹24.76" />
                  <PortalDlRow label="Platform fee (10%)" value="− ₹46.19" />
                  <PortalDlRow label="GST on platform fee (18%)" value="₹8.31" />
                  <PortalDlRow label="TCS (1%)" value="− ₹4.95" />
                  <PortalDlRow label="TDS (0.1%)" value="− ₹0.50" />
                  <PortalDlRow label="Net seller payout per unit" value="₹435.29" bold />
                </dl>
              </div>
            </PortalCard>
          </div>
        ) : null}
      </PortalScroll>
      <PortalActionBar split target="product-submit" active={is(activeTarget, "product-submit")}>
        {step === 4 ? "Submit for review" : "Continue"}
      </PortalActionBar>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/**
 * Portal `/seller/products/[id]/edit` — `Edit product` with the status pill,
 * the photos card, listing details, the platform GST note, the veg toggle, and
 * the fixed Delete / Save bar under the delete-confirm sheet.
 */
export function CatalogEditScreen({ activeTarget }: ScreenProps) {
  const confirming = is(activeTarget, "delete-listing") || is(activeTarget, "delete-confirm");

  return (
    <PortalPhone>
      <PortalPageHeader
        sub="Basmati rice 5 kg"
        title="Edit product"
        action={<PortalBadge tone="success">Active</PortalBadge>}
      />
      <PortalScroll action>
        <PortalCard>
          <p className="tp-card-title">Photos</p>
          <p className="tp-card-note">
            Exactly what shoppers see on the product page, cards and search results.
          </p>
          <PortalUpload status="1 photo ✓" />
        </PortalCard>
        <PortalCard>
          <p className="tp-card-title">Listing details</p>
          <p className="tp-card-note">PRD-1042 · Mart · Rice &amp; grains</p>
          <PortalField label="Name" value="Basmati rice 5 kg" />
          <PortalField
            label="Description"
            value="Long-grain basmati rice, 5 kg bag."
            target="edit-description"
            active={is(activeTarget, "edit-description")}
          />
          <PortalField label="Selling price (₹, GST included)" value="520" />
          <div className="tp-gst-note">
            <p className="tp-gst-label">GST</p>
            <p>Rate is set by the platform category master.</p>
          </div>
          <p className="tp-edit-shelf">
            New shelf price <b>₹520.00</b> · GST included
          </p>
        </PortalCard>
      </PortalScroll>
      <div className="tp-actionbar">
        <PortalActionRow>
          <PortalOutline
            tone="brand"
            target="delete-listing"
            active={is(activeTarget, "delete-listing")}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </PortalOutline>
          <PortalPrimary target="edit-save" active={is(activeTarget, "edit-save")} grow>
            Save changes
          </PortalPrimary>
        </PortalActionRow>
      </div>
      {confirming ? (
        <PortalSheet
          title="Delete Basmati rice 5 kg?"
          target="delete-confirm"
          active={is(activeTarget, "delete-confirm")}
          footer={
            <>
              <PortalOutline block>Keep listing</PortalOutline>
              <PortalPrimary block tone="brand">
                Delete
              </PortalPrimary>
            </>
          }
        >
          <p className="tp-sheet-note">
            Shoppers lose this listing immediately. It moves to Trash, where you can restore it for
            7 days before it is permanently removed. The action is written to the audit log.
          </p>
        </PortalSheet>
      ) : null}
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/**
 * `/seller/products/trash` — `Trash` under `Deleted listings · permanently
 * removed after 7 days`, the `Products` back action, then one card per deleted
 * listing: name + sector chip, sector/category/id, price, the `5d left` pill, the
 * grey deleted/auto-deletes block and the full-width `Restore listing` button.
 */
export function CatalogTrashScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader
        sub="Deleted listings · permanently removed after 7 days"
        title="Trash"
        action={<PortalHeaderAction label="Products" tone="soft" icon={<ArrowLeft />} />}
      />
      <PortalScroll>
        <PortalCard>
          <div className="tp-trash-head">
            <span className="tp-trash-text">
              <span className="tp-prow-name">
                <span>Basmati rice 5 kg</span>
                <small>Mart</small>
              </span>
              <p className="tp-prow-sub">Mart · Rice &amp; grains · PRD-1042</p>
              <p className="tp-trash-price">₹520.00</p>
            </span>
            <PortalBadge tone="warning">5d left</PortalBadge>
          </div>
          <div className="tp-trash-meta">
            <p>Deleted 2 days ago · Seller removed listing</p>
            <p>Auto-deletes on 24 Nov 2026.</p>
          </div>
          <PortalPrimary
            block
            target="restore-listing"
            active={is(activeTarget, "restore-listing")}
          >
            <Repeat aria-hidden="true" />
            Restore listing
          </PortalPrimary>
        </PortalCard>
        <PortalNote tone="warning">
          Listings stay restorable for seven days. After that they are removed permanently; past
          orders keep their record.
        </PortalNote>
      </PortalScroll>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/**
 * `/seller/pricing` — `Pricing` under `Catalog`, the header carrying the mass
 * `% cut` field and `Apply to all`, then one card per product with its price
 * field, the `vs median` rail and `Save`, and the audit-log history below.
 */
export function PricingScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader
        sub="Catalog"
        title="Pricing"
        action={
          <span className="tp-mass">
            <span
              className="tp-mass-input"
              data-tour-target="price-input"
              data-active={is(activeTarget, "price-input") || undefined}
            >
              Mass cut %
            </span>
            <PortalHeaderAction label="Apply to all" tone="soft" />
          </span>
        }
      />
      <PortalScroll>
        <PortalCard>
          <PortalProductRow
            name="Basmati rice 5 kg"
            productId="PRD-1042"
            category="Rice & grains"
            sector="Mart"
            price="₹520"
            status="Active"
            tone="success"
            emoji="🌾"
          />
          <PortalField label="Price (₹)" value="520" />
          <div className="tp-ratio">
            <span className="tp-ratio-rail">
              <span className="tp-ratio-fill" data-tone="success" style={{ width: "51%" }} />
            </span>
            <span className="tp-ratio-note">vs median 102%</span>
            <span className="tp-inline-save">Save</span>
          </div>
        </PortalCard>
        <PortalCard>
          <PortalProductRow
            name="Toor dal 1 kg"
            productId="PRD-1043"
            category="Dals & pulses"
            sector="Mart"
            price="₹145"
            status="Active"
            tone="success"
            emoji="🫘"
          />
          <PortalField label="Price (₹)" value="145" />
          <div className="tp-ratio">
            <span className="tp-ratio-rail">
              <span className="tp-ratio-fill" data-tone="success" style={{ width: "28%" }} />
            </span>
            <span className="tp-ratio-note">vs median 57%</span>
            <span className="tp-inline-save">Save</span>
          </div>
        </PortalCard>
        <PortalCard>
          <PortalProductRow
            name="Cold-pressed sunflower oil 1 L"
            productId="PRD-1044"
            category="Cooking oil"
            sector="Mart"
            price="₹138"
            status="Active"
            tone="success"
            emoji="🧴"
          />
          <PortalField label="Price (₹)" value="138" />
          <div className="tp-ratio">
            <span className="tp-ratio-rail">
              <span className="tp-ratio-fill" data-tone="success" style={{ width: "27%" }} />
            </span>
            <span className="tp-ratio-note">vs median 54%</span>
            <span className="tp-inline-save">Save</span>
          </div>
        </PortalCard>
        <PortalCard>
          <PortalCardHead
            title="Price change history"
            note="Written to the audit log on every save."
          />
          <div className="tp-audit">
            <span className="tp-audit-when">17 Nov, 4:12 PM</span>
            <span className="tp-audit-id">PRD-1042</span>
            <span className="tp-audit-delta">₹505 → ₹520</span>
          </div>
          <div className="tp-audit">
            <span className="tp-audit-when">16 Nov, 11:40 AM</span>
            <span className="tp-audit-id">PRD-1043</span>
            <span className="tp-audit-delta">₹150 → ₹145</span>
          </div>
        </PortalCard>
      </PortalScroll>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/**
 * `/seller/inventory` — the orders top bar, the "Want to edit your catalog?"
 * banner, search, the All items / Menu dishes / Add-ons tabs, then stock grouped
 * by category with a switch per item.
 */
export function InventoryScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalOrdersHeader />
      <PortalScroll>
        <div className="tp-edit-note">
          <span>Want to edit your catalog or items?</span>
          <span className="tp-edit-pill">Edit now</span>
        </div>
        <PortalSearchRow placeholder="Search catalog" />
        <PortalPillTabs
          items={[
            { label: "All items", on: true, count: 5 },
            { label: "Menu dishes" },
            { label: "Add-ons" },
          ]}
        />
        <PortalCard>
          <p className="tp-card-title">Rice &amp; grains · 3</p>
          <p className="tp-card-note">1 of 3 items is out of stock</p>
          <PortalSwitchRow
            label="Basmati rice 5 kg · 24 in stock"
            on
            top
            target="stock-toggle"
            active={is(activeTarget, "stock-toggle")}
          />
          <PortalSwitchRow label="Sona masoori 10 kg · 6 in stock" on />
          <PortalSwitchRow label="Brown rice 1 kg · out of stock" />
        </PortalCard>
        <PortalCard>
          <p className="tp-card-title">Dals &amp; pulses · 2</p>
          <p className="tp-card-note">All items in stock</p>
          <PortalSwitchRow label="Toor dal 1 kg · 18 in stock" on top />
          <PortalSwitchRow label="Moong dal 500 g · 9 in stock" on />
        </PortalCard>
        <PortalNote tone="warning">
          Turning an item back on writes 10 units with a 30-minute restock ETA. Turning it off asks
          when it returns.
        </PortalNote>
      </PortalScroll>
      <PortalBottomNav mode="orders" food />
    </PortalPhone>
  );
}

/**
 * `/seller/menus` — `HubHeader` with `Add dish` (Food) / `Add item`, the search
 * with the status filter, then one card per dish: veg mark, name,
 * `cuisine · dish id`, price with the MRP strike-through and status pill, and the
 * Submit / Delist / Edit footer. The editor sheet opens for `menu-price`.
 */
export function MenusScreen({ activeTarget }: ScreenProps) {
  const editing = is(activeTarget, "menu-price");

  return (
    <PortalPhone>
      <PortalHubHeader
        shop="Sharma Kitchen"
        action={
          <PortalHeaderAction
            label="Add dish"
            icon={<Plus />}
            target="menu-add"
            active={is(activeTarget, "menu-add")}
          />
        }
      />
      <PortalScroll>
        <PortalSearchRow placeholder="Search dish name or id" />
        <PortalCard>
          <PortalDishRow
            name="Chicken biryani"
            sub="Biryani · DSH-204"
            price="₹180.00"
            mrp="₹210.00"
            status="Active"
            tone="success"
            veg={false}
            target="menu-dish"
            active={is(activeTarget, "menu-dish")}
          />
          <div className="tp-menu-foot">
            <span className="tp-menu-actions">
              <span>Delist</span>
            </span>
            <span className="tp-menu-edit">Edit</span>
          </div>
        </PortalCard>
        <PortalCard>
          <PortalDishRow
            name="Veg meals"
            sub="Meals · DSH-205"
            price="₹120.00"
            status="Active"
            tone="success"
          />
          <div className="tp-menu-foot">
            <span className="tp-menu-actions">
              <span>Delist</span>
            </span>
            <span className="tp-menu-edit">Edit</span>
          </div>
        </PortalCard>
        <PortalCard>
          <PortalDishRow
            name="Extra raita"
            sub="No cuisine · DSH-206"
            price="₹30.00"
            status="Draft"
            tone="muted"
          />
          <div className="tp-menu-foot">
            <span className="tp-menu-actions">
              <span>Submit</span>
            </span>
            <span className="tp-menu-edit">Edit</span>
          </div>
        </PortalCard>
      </PortalScroll>
      <PortalBottomNav mode="hub" food />
      {editing ? (
        <PortalSheet
          title="Edit dish"
          footer={
            <>
              <PortalOutline>Cancel</PortalOutline>
              <PortalPrimary>Save changes</PortalPrimary>
            </>
          }
        >
          <PortalField label="Venue id" value="VEN-3321" />
          <PortalField label="Dish id" value="DSH-204" />
          <PortalField label="Dish name" value="Chicken biryani" />
          <PortalField label="Price (₹)" value="180" />
          <PortalField
            label="MRP (₹, optional)"
            value="210"
            target="menu-price"
            active={is(activeTarget, "menu-price")}
          />
          <PortalField label="Cuisine" value="Biryani" />
          <PortalSwitchRow label="Vegetarian" top />
        </PortalSheet>
      ) : null}
    </PortalPhone>
  );
}

/**
 * `/seller/offers` — `FestivalOptins` with `title="Offers"`: the intro line, the
 * campaign button (BadgePercent, name, dates + scope, LIVE pill, chevron), the
 * sector-cap card, the product search, then one card per product with its
 * `sector · cap · price` line, join state, `Live price` and the discount field.
 */
export function OffersScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader sub="Growth" title="Offers" />
      <PortalScroll>
        <p className="tp-intro">
          Pick a product, then join the live festival campaign with the discount you want to offer.
          Live prices change after a district admin approves the opt-in.
        </p>
        <div
          className="tp-campaign-btn"
          data-tour-target="offer-campaign"
          data-active={is(activeTarget, "offer-campaign") || undefined}
        >
          <BadgePercent aria-hidden="true" />
          <span className="tp-campaign-text">
            <span className="tp-campaign-name">Pongal festival</span>
            <span className="tp-campaign-sub">13 Jan 2027 → 17 Jan 2027 · All states</span>
          </span>
          <PortalBadge tone="success">Live</PortalBadge>
          <ChevronDown aria-hidden="true" />
        </div>
        <PortalCard>
          <div className="tp-captable" data-single="true">
            <span>
              <small>MART cap</small>
              <b>25%</b>
            </span>
          </div>
          <p className="tp-cap-note">
            Shoppers see the live price only after a district admin approves the opt-in.
          </p>
        </PortalCard>
        <PortalSearchRow placeholder="Search your products" filter={false} />
        <PortalCard>
          <div className="tp-offer-head">
            <span className="tp-thumb" aria-hidden="true">
              🌾
            </span>
            <span className="tp-outlet-text">
              <p className="tp-card-title">Basmati rice 5 kg</p>
              <p className="tp-card-note">MART · cap 25% · ₹520.00</p>
            </span>
            <span className="tp-offer-state">Not joined</span>
          </div>
          <div className="tp-offer-foot">
            <span className="tp-outlet-text">
              <p className="tp-offer-live">
                Live price · <b>₹442.00</b>
              </p>
              <PortalField
                label="Your discount (%)"
                value="15"
                target="offer-percent"
                active={is(activeTarget, "offer-percent")}
              />
            </span>
            <PortalPrimary target="offer-optin" active={is(activeTarget, "offer-optin")}>
              Opt in
            </PortalPrimary>
          </div>
        </PortalCard>
        <PortalCard>
          <div className="tp-offer-head">
            <span className="tp-thumb" aria-hidden="true">
              🫘
            </span>
            <span className="tp-outlet-text">
              <p className="tp-card-title">Toor dal 1 kg</p>
              <p className="tp-card-note">MART · cap 25% · ₹180.00</p>
            </span>
            <PortalBadge tone="warning">Pending</PortalBadge>
          </div>
          <div className="tp-offer-foot">
            <span className="tp-outlet-text">
              <p className="tp-offer-live">
                Live price · <b>₹171.00</b>
              </p>
              <PortalField label="Your discount (%)" value="5" />
            </span>
            <PortalPrimary>Update</PortalPrimary>
          </div>
        </PortalCard>
        <PortalNote tone="info">
          An opt-in returns to PENDING until a district admin approves it. Shoppers see the new
          price only after approval.
        </PortalNote>
      </PortalScroll>
      <PortalBottomNav mode="orders" />
    </PortalPhone>
  );
}

/**
 * `/seller/inventory` → the `Add-ons` tab. Same orders top bar and the same
 * `All items / Menu dishes / Add-ons` pills as the stock tab, then the
 * `Add-ons` section with `Create`, the add-on rows and `Add-ons per dish`.
 */
export function AddonsScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalOrdersHeader />
      <PortalScroll>
        <PortalPillTabs
          items={[
            { label: "All items", count: 5 },
            { label: "Menu dishes", count: 3 },
            { label: "Add-ons", on: true, count: 2 },
          ]}
        />
        <div className="tp-section-row">
          <span className="tp-section-text">
            <p className="tp-card-title">Add-ons</p>
            <p className="tp-card-note">
              Extras customers can add to a dish. Approved add-ons appear on the menu.
            </p>
          </span>
          <PortalHeaderAction
            label="Create"
            target="addon-create"
            active={is(activeTarget, "addon-create")}
          />
        </div>
        <div className="tp-list tp-list--boxed">
          <p className="tp-list-head">Your add-ons</p>
          <div className="tp-lrow" data-top="true">
            <span className="tp-veg" aria-hidden="true" />
            <span className="tp-lrow-main">
              <span className="tp-lrow-title">Extra raita</span>
              <span className="tp-lrow-sub">Add-on • ₹30</span>
              <span className="tp-lrow-actions">
                <span
                  data-tour-target="addon-submit"
                  data-active={is(activeTarget, "addon-submit") || undefined}
                >
                  Submit for review
                </span>
                <span data-muted="true">Delist</span>
              </span>
            </span>
            <PortalBadge tone="warning">Draft</PortalBadge>
          </div>
          <div className="tp-lrow">
            <span className="tp-veg" data-nonveg="true" aria-hidden="true" />
            <span className="tp-lrow-main">
              <span className="tp-lrow-title">Extra gravy</span>
              <span className="tp-lrow-sub">Sides • ₹40</span>
              <span className="tp-lrow-actions">
                <span data-muted="true">Delist</span>
              </span>
            </span>
            <PortalBadge tone="success">Active</PortalBadge>
          </div>
        </div>
        <p className="tp-sec-title">Add-ons per dish</p>
        <div
          className="tp-dishlink"
          data-tour-target="addon-link"
          data-active={is(activeTarget, "addon-link") || undefined}
        >
          <div className="tp-dishlink-head">
            <span className="tp-veg" data-nonveg="true" aria-hidden="true" />
            <p>Chicken biryani</p>
            <span className="tp-mini-btn">
              <Plus aria-hidden="true" />
              Add add-on
            </span>
          </div>
          <div className="tp-dishlink-row">
            <span className="tp-veg" aria-hidden="true" />
            <span className="tp-dishlink-text">
              Extra raita · ₹30
              <small>Draft</small>
            </span>
            <span className="tp-toggle" data-on="true" aria-hidden="true" />
          </div>
          <div className="tp-dishlink-row">
            <span className="tp-veg" data-nonveg="true" aria-hidden="true" />
            <span className="tp-dishlink-text">
              Extra gravy · ₹40
              <small>Active</small>
            </span>
            <span className="tp-toggle" data-on="true" aria-hidden="true" />
          </div>
        </div>
      </PortalScroll>
      <PortalBottomNav mode="orders" food />
    </PortalPhone>
  );
}

/**
 * `/seller/orders` — `OrdersTopBar` with the search + scan icons, the status
 * pills with their counts, then the order cards. The Pickup QR button only
 * exists on a packed card, so the `order-qr` step opens the Ready tab.
 */
export function OrdersBoardScreen({ activeTarget }: ScreenProps) {
  const ready = is(activeTarget, "order-qr");

  return (
    <PortalPhone>
      <PortalOrdersHeader />
      <PortalScroll>
        <PortalPillTabs
          items={
            ready
              ? [
                  { label: "Preparing", count: 1 },
                  { label: "Ready", on: true, count: 1 },
                  { label: "Out for delivery" },
                  { label: "Delivered", count: 6 },
                ]
              : [
                  { label: "Preparing", on: true, count: 1 },
                  { label: "Ready", count: 1 },
                  { label: "Out for delivery" },
                  { label: "Delivered", count: 6 },
                ]
          }
          target="order-tab-new"
          active={is(activeTarget, "order-tab-new")}
        />
        {ready ? (
          <PortalOrderCard
            stage="packed"
            qrTarget="order-qr"
            qrActive={is(activeTarget, "order-qr")}
          />
        ) : (
          <PortalOrderCard
            target="order-card"
            active={is(activeTarget, "order-card")}
            rejectTarget="order-reject"
            rejectActive={is(activeTarget, "order-reject")}
          />
        )}
      </PortalScroll>
      <PortalBottomNav mode="orders" food />
    </PortalPhone>
  );
}

/**
 * `/seller/orders/[id]` — `Order #FAZ10428` with the print action, the customer
 * card, the `Summary` definition list and the four-stage `Timeline`. The fixed
 * bar advances the flow, so the screen derives its state from the active step:
 * a new order offers Reject / Accept order, an accepted one Mark delivered.
 */
export function OrdersDetailScreen({ activeTarget }: ScreenProps) {
  const handedOver = is(activeTarget, "order-advance");

  return (
    <PortalPhone>
      <PortalPageHeader
        title="Order #FAZ10428"
        action={
          <span
            className="tp-icon-btn"
            data-tour-target="order-print"
            data-active={is(activeTarget, "order-print") || undefined}
          >
            <Printer />
          </span>
        }
      />
      <PortalScroll action>
        <PortalCard>
          <p className="tp-card-note">ID: FAZ10428 • 17 Nov 2026, 4:12 PM</p>
          <div className="tp-cust">
            <span>
              <p className="tp-cust-name">A. Kumar</p>
              <p className="tp-card-note">Karaikal, TN</p>
            </span>
            <PortalBadge tone="brand">Food</PortalBadge>
          </div>
        </PortalCard>
        <PortalCard>
          <p className="tp-card-title">Summary</p>
          <dl className="tp-dl">
            <PortalDlRow label="Order value" value="₹430" bold />
            <PortalDlRow label="Items" value="2" />
            <PortalDlRow label="Placed" value="17 Nov, 4:12 PM" />
            <PortalDlRow label="SLA due" value="17 Nov, 4:42 PM" />
            <PortalDlRow label="SLA countdown" value="28.4 h left" />
            <PortalDlRow
              label="Delivery address"
              value="Masked until dispatch · revealed on handover"
            />
            <PortalDlRow label="Store" value="STR-3321" />
          </dl>
        </PortalCard>
        <PortalCard>
          <p className="tp-card-title">Timeline</p>
          <PortalTimeline
            stages={["Preparing", "Ready", "Out for delivery", "Delivered"]}
            current={handedOver ? 2 : 0}
            target="order-status"
            active={is(activeTarget, "order-status")}
          />
        </PortalCard>
      </PortalScroll>
      <div className="tp-actionbar">
        <PortalActionRow>
          {handedOver ? (
            <PortalPrimary target="order-advance" active>
              Mark delivered
            </PortalPrimary>
          ) : (
            <>
              <PortalOutline target="order-reject" active={is(activeTarget, "order-reject")}>
                Reject
              </PortalOutline>
              <PortalPrimary target="order-accept" active={is(activeTarget, "order-accept")}>
                Accept order
              </PortalPrimary>
            </>
          )}
        </PortalActionRow>
      </div>
      <PortalBottomNav mode="orders" food />
    </PortalPhone>
  );
}

/**
 * `/seller/orders` with the reject sheet open (`orders/page.client.tsx`): the
 * new order card sits behind a `Reason for rejection` sheet whose radios are
 * the active shop's sector list, with `Back` / `Reject order` in the footer.
 */
export function OrdersRejectScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalOrdersHeader />
      <PortalScroll>
        <PortalPillTabs
          items={[
            { label: "Preparing", on: true, count: 1 },
            { label: "Ready", count: 1 },
            { label: "Out for delivery" },
            { label: "Delivered", count: 6 },
          ]}
        />
        <PortalOrderCard />
      </PortalScroll>
      <PortalSheet
        title="Reason for rejection"
        footer={
          <>
            <PortalOutline grow>Back</PortalOutline>
            <PortalPrimary grow target="reject-confirm" active={is(activeTarget, "reject-confirm")}>
              Reject order
            </PortalPrimary>
          </>
        }
      >
        <div
          data-tour-target="reject-reason"
          data-active={is(activeTarget, "reject-reason") || undefined}
        >
          <PortalRadioRow label="Items out of stock" on />
          <PortalRadioRow label="Kitchen is full" />
          <PortalRadioRow label="Restaurant closing soon" />
          <PortalRadioRow label="Customer requested" />
          <PortalRadioRow label="Other" />
        </div>
      </PortalSheet>
      <PortalBottomNav mode="orders" food />
    </PortalPhone>
  );
}

/**
 * `/seller/order-history` — the back arrow + outlet header, the search box, the
 * range row that opens the `Select date range` sheet, then the order cards
 * newest first.
 */
export function OrderHistoryScreen({ activeTarget }: ScreenProps) {
  const picking = is(activeTarget, "history-range-sheet");

  return (
    <PortalPhone>
      <PortalPageHeader title="Order history" />
      <PortalScroll>
        <PortalSearchRow
          placeholder="Search by order ID"
          filter={false}
          target="history-search"
          active={is(activeTarget, "history-search")}
        />
        <div
          className="tp-rangebar"
          data-tour-target="history-range"
          data-active={is(activeTarget, "history-range") || undefined}
        >
          <span>
            <b>{picking ? "Last 30 days" : "Last 7 days"}</b>
            <small>{picking ? "218 orders" : "128 orders"}</small>
          </span>
          <Calendar aria-hidden="true" />
        </div>
        <div className="tp-order">
          <div className="tp-order-top">
            <span className="tp-sector" data-sector="food">
              Delivered
            </span>
            <p className="tp-order-id">#FAZ10425</p>
            <p className="tp-order-customer">A. Kumar</p>
            <span className="tp-order-time">17 Nov, 4:12 PM</span>
          </div>
          <div className="tp-order-rows">
            <span>
              <ClipboardList />
              Items
              <b>2 items</b>
            </span>
            <span>
              <Receipt />
              Total
              <b>₹640</b>
            </span>
          </div>
        </div>
        <div className="tp-order">
          <div className="tp-order-top">
            <span className="tp-sector" data-sector="mart">
              Delivered
            </span>
            <p className="tp-order-id">#FAZ10419</p>
            <p className="tp-order-customer">M. Devi</p>
            <span className="tp-order-time">16 Nov, 9:40 AM</span>
          </div>
          <div className="tp-order-rows">
            <span>
              <ClipboardList />
              Items
              <b>5 items</b>
            </span>
            <span>
              <Receipt />
              Total
              <b>₹1,240</b>
            </span>
          </div>
        </div>
      </PortalScroll>
      {picking ? (
        <PortalSheet title="Select date range" target="history-range-sheet" active>
          <PortalRadioRow label="Last 7 days" />
          <PortalRadioRow label="Last 30 days" on />
          <PortalRadioRow label="All time" />
        </PortalSheet>
      ) : null}
      <PortalBottomNav mode="orders" />
    </PortalPhone>
  );
}

/**
 * `/seller/orders` with the pickup-QR sheet open: the Ready tab's packed card
 * sits behind a `Pickup QR` sheet, exactly where the console opens it.
 */
export function PickupQrScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalOrdersHeader />
      <PortalScroll>
        <PortalPillTabs
          items={[
            { label: "Preparing", count: 1 },
            { label: "Ready", on: true, count: 1 },
            { label: "Out for delivery" },
            { label: "Delivered", count: 6 },
          ]}
        />
        <PortalOrderCard stage="packed" />
      </PortalScroll>
      <PortalSheet title="Pickup QR" target="qr-code" active={is(activeTarget, "qr-code")}>
        <p className="tp-sheet-note tp-sheet-note--center">
          Order #FAZ10428 — ask the delivery partner to scan this code at pickup.
        </p>
        <PortalQr />
        <p className="tp-sheet-note">
          The code is short-lived, so a stale one is refused at the door.
        </p>
      </PortalSheet>
      <PortalBottomNav mode="orders" food />
    </PortalPhone>
  );
}

/**
 * `/seller/notifications` — `Notifications` with the unread count as its sub and
 * `Mark all read` on the right, then the full-bleed alert rows: an unread one is
 * tinted and keeps its dot, and each deep-links to the surface it describes.
 */
export function NotificationsScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader
        sub="3 unread"
        title="Notifications"
        action={
          <span
            className="tp-header-textaction"
            data-tour-target="notif-readall"
            data-active={is(activeTarget, "notif-readall") || undefined}
          >
            Mark all read
          </span>
        }
      />
      <PortalScroll bleed>
        <div data-tour-target="notif-row" data-active={is(activeTarget, "notif-row") || undefined}>
          <PortalNotifRow
            title="New order #FAZ10429"
            body="A. Kumar · 2 items · ₹640"
            time="17 Nov 2026, 4:12 PM"
            unread
          />
        </div>
        <PortalNotifRow
          title="Basmati rice 5 kg was approved"
          body="Your listing is live in Sharma Mart."
          time="17 Nov 2026, 2:04 PM"
          unread
          target="notif-deeplink"
          active={is(activeTarget, "notif-deeplink")}
        />
        <PortalNotifRow
          title="SLA reminder — 12 minutes left"
          body="Order #FAZ10427 is still waiting to be packed."
          time="17 Nov 2026, 1:48 PM"
          unread
        />
        <PortalNotifRow
          title="Payout for 5 – 11 Nov is paid"
          body="₹18,420 credited to your bank account."
          time="16 Nov 2026, 6:30 PM"
        />
      </PortalScroll>
      <PortalBottomNav mode="hub" food />
    </PortalPhone>
  );
}

/**
 * `/seller/payments` — `HubHeader` with `Print statement`, the `Payouts` /
 * `Invoices & Taxes` pills, the all-time settlement card, the cycle picker with
 * `Get report`, the per-cycle ledger cards, then the payout schedule whose PAID
 * row carries the payout invoice.
 */
export function PayoutsScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalHubHeader
        shop="Sharma Mart"
        action={<PortalHeaderAction label="Print statement" tone="soft" />}
      />
      <div className="tp-pillwrap">
        <PortalPillTabs
          items={[{ label: "Payouts", on: true }, { label: "Invoices & Taxes" }]}
          target="payout-tab"
          active={is(activeTarget, "payout-tab")}
        />
      </div>
      <PortalScroll>
        <PortalCard>
          <p className="tp-bignum-label">All-time settlement · 6 cycles</p>
          <p className="tp-bignum">₹2,38,377</p>
          <p className="tp-bignum-note">Net payout after commission &amp; taxes</p>
          <div
            className="tp-kpis tp-kpis--2"
            data-tour-target="payout-ledger"
            data-active={is(activeTarget, "payout-ledger") || undefined}
          >
            <span className="tp-kpi">
              <small>Gross order value</small>
              <b>₹2,84,120</b>
            </span>
            <span className="tp-kpi">
              <small>Platform commission</small>
              <b data-brand="true">−₹28,412</b>
            </span>
            <span className="tp-kpi">
              <small>Product GST</small>
              <b>₹14,206</b>
            </span>
            <span className="tp-kpi">
              <small>TCS 1%</small>
              <b data-brand="true">−₹2,841</b>
            </span>
            <span className="tp-kpi">
              <small>TDS 0.1%</small>
              <b data-brand="true">−₹284</b>
            </span>
          </div>
        </PortalCard>
        <div
          className="tp-cyclepick"
          data-tour-target="payout-cycle"
          data-active={is(activeTarget, "payout-cycle") || undefined}
        >
          <span className="tp-cyclepick-field">
            <Calendar aria-hidden="true" />
            2026-W46
            <ChevronDown aria-hidden="true" />
          </span>
          <span className="tp-cyclepick-get">
            <Download aria-hidden="true" />
            Get report
          </span>
        </div>
        <p className="tp-sec-title">Cycles · 2026-W46</p>
        <PortalCard>
          <div className="tp-kpis tp-kpis--2">
            <span className="tp-kpi">
              <small>Net payout</small>
              <b data-big="true">₹26,240</b>
              <small>Cycle 2026-W46</small>
            </span>
            <span className="tp-kpi">
              <small>Order value</small>
              <b>₹31,480</b>
            </span>
            <span className="tp-kpi">
              <small>TCS</small>
              <b data-brand="true">−₹315</b>
            </span>
            <span className="tp-kpi">
              <small>Product GST</small>
              <b>₹1,574</b>
            </span>
          </div>
          <p className="tp-linkrow tp-linkrow--center">
            View details
            <ChevronRight aria-hidden="true" />
          </p>
        </PortalCard>
        <p className="tp-sec-title">Payout schedule</p>
        <PortalCard>
          <div className="tp-payout-head">
            <p className="tp-payout-amount">₹18,420</p>
            <PortalBadge tone="success">Paid</PortalBadge>
          </div>
          <p className="tp-payout-meta">Paid ₹18,420</p>
          <p className="tp-payout-id">PAY-3391 · cycle 2026-W45 · 12 Nov 2026 · paid 14 Nov 2026</p>
          <span
            className="tp-payout-invoice"
            data-tour-target="payout-invoice"
            data-active={is(activeTarget, "payout-invoice") || undefined}
          >
            <Download aria-hidden="true" />
            Payout invoice
          </span>
        </PortalCard>
        <PortalCard>
          <div className="tp-payout-head">
            <p className="tp-payout-amount">₹14,100</p>
            <PortalBadge tone="warning">Partial</PortalBadge>
          </div>
          <p className="tp-payout-meta">Paid ₹9,240 · Balance ₹4,860</p>
          <p className="tp-payout-id">PAY-3388 · cycle 2026-W44 · 5 Nov 2026</p>
        </PortalCard>
        <PortalNote
          tone="warning"
          target="payout-status"
          active={is(activeTarget, "payout-status")}
        >
          There is no automatic transfer: an admin marks a payout PAID after the bank transfer, so a
          part-paid week shows PARTIAL with a balance.
        </PortalNote>
      </PortalScroll>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/** The six Settings tabs, in the console's order; the key is the step target. */
const SETTINGS_TABS = [
  { key: "settings-profile", label: "Profile" },
  { key: "settings-bank", label: "Bank" },
  { key: "settings-notify", label: "Notifications" },
  { key: "settings-theme", label: "Appearance" },
  { key: "settings-subusers", label: "Sub-users" },
  { key: "settings-security", label: "Security" },
] as const;

/** Targets that live inside a tab but are not the tab's own key. */
const SETTINGS_TAB_ALIASES: Record<string, string> = {
  "profile-save": "settings-profile",
  "invite-link": "settings-subusers",
  "subuser-resend": "settings-subusers",
  "subuser-remove": "settings-subusers",
  "settings-email": "settings-security",
  "email-new": "settings-security",
  "email-password": "settings-security",
  "email-save": "settings-security",
  "settings-password": "settings-security",
};

/** `/seller/settings` — `Settings` under `Account` with the six underline tabs. */
export function SettingsScreen({ activeTarget }: ScreenProps) {
  const aliased = SETTINGS_TAB_ALIASES[activeTarget] ?? activeTarget;
  const active = SETTINGS_TABS.find((t) => aliased === t.key)?.key ?? "settings-profile";
  const only = (key: string) => active === key;
  const emailing = activeTarget === "email-save";

  return (
    <PortalPhone>
      <PortalPageHeader sub="Account" title="Settings" />
      <div className="tp-tabwrap">
        <PortalUnderlineTabs
          items={SETTINGS_TABS.map((t) => ({
            label: t.label,
            on: t.key === active,
            target: t.key,
          }))}
          activeTarget={activeTarget}
        />
      </div>
      <PortalScroll>
        {only("settings-profile") ? (
          <div>
            <PortalCard>
              <p className="tp-card-title">Business profile</p>
              <p className="tp-card-note">
                Profile changes that affect KYC need admin re-verification.
              </p>
              <PortalField label="Shop name" value="Sharma Mart" />
              <PortalField label="Owner name" value="R. Sharma" />
              <PortalField label="GSTIN" value="33AACCS1234M1Z5" />
              <PortalField label="PAN" value="AACCS1234M" />
              <PortalField label="Contact phone" value="+91 98436 31722" />
              <PortalField label="Registered address" value="12, Bharathiar Road, Karaikal" />
              <PortalActionRow>
                <PortalOutline>Cancel</PortalOutline>
                <PortalPrimary target="profile-save" active={is(activeTarget, "profile-save")}>
                  Save changes
                </PortalPrimary>
              </PortalActionRow>
            </PortalCard>
          </div>
        ) : null}

        {only("settings-bank") ? (
          <div>
            <PortalCard>
              <p className="tp-card-title">Settlement account</p>
              <p className="tp-card-note">Payouts are transferred to this account each cycle.</p>
              <dl className="tp-dl">
                <PortalDlRow label="Beneficiary" value="Sharma Mart" />
                <PortalDlRow label="Account number" value="•••• •••• 4471" />
                <PortalDlRow label="IFSC" value="HDFC0001234" />
              </dl>
              <PortalPrimary block>Change account</PortalPrimary>
            </PortalCard>
          </div>
        ) : null}

        {only("settings-notify") ? (
          <div>
            <PortalCard>
              <p className="tp-card-title">Notifications</p>
              <p className="tp-card-note">Choose which alerts you want to receive.</p>
              <PortalSwitchRow
                label="New order alerts"
                sub="A new order lands in your queue"
                on
                top
              />
              <PortalSwitchRow label="Low stock alerts" sub="An item is running out" on />
              <PortalSwitchRow
                label="SLA breach warnings"
                sub="A pickup or delivery is at risk"
                on
              />
              <PortalSwitchRow label="Festival campaign news" sub="Promotions you can join" />
            </PortalCard>
          </div>
        ) : null}

        {only("settings-theme") ? (
          <div>
            <PortalCard>
              <p className="tp-card-title">Appearance</p>
              <p className="tp-card-note">
                Applies to this browser, on every console you sign in to.
              </p>
              <div className="tp-switchrow">
                <span className="tp-switchrow-text">
                  Theme
                  <small>Auto follows your device&apos;s light or dark setting.</small>
                </span>
                <PortalChips
                  items={[{ label: "System", on: true }, { label: "Light" }, { label: "Dark" }]}
                />
              </div>
            </PortalCard>
          </div>
        ) : null}

        {only("settings-subusers") ? (
          <div>
            <PortalCard>
              <p className="tp-card-title">Invite a sub-user</p>
              <p className="tp-card-note">
                Staff can run the console; viewers are read-only. They choose their own password.
              </p>
              <PortalField label="Name" value="Priya N" />
              <PortalField label="Email" value="priya@sharmamart.in" />
              <p className="tp-field-label">Role</p>
              <div className="tp-radios">
                <PortalRadioRow label="Staff" sub="Orders and inventory" on />
                <PortalRadioRow label="Viewer" sub="Read-only access" />
              </div>
              <PortalPrimary block target="invite-link" active={is(activeTarget, "invite-link")}>
                <Link2 aria-hidden="true" />
                Create invite link
              </PortalPrimary>
            </PortalCard>
            <PortalCard>
              <p className="tp-card-title">Your team</p>
              <p className="tp-card-note">1 invited · 1 active</p>
              <div className="tp-lrow" data-top="true">
                <span className="tp-lrow-main">
                  <span className="tp-lrow-title">Priya N</span>
                  <span className="tp-lrow-sub">priya@sharmamart.in · Staff</span>
                  <span className="tp-lrow-actions">
                    <span
                      data-tour-target="subuser-resend"
                      data-active={is(activeTarget, "subuser-resend") || undefined}
                    >
                      New link
                    </span>
                    <span
                      data-muted="true"
                      data-tour-target="subuser-remove"
                      data-active={is(activeTarget, "subuser-remove") || undefined}
                    >
                      Remove
                    </span>
                  </span>
                </span>
                <PortalBadge tone="warning">Invited</PortalBadge>
              </div>
              <div className="tp-lrow">
                <span className="tp-lrow-main">
                  <span className="tp-lrow-title">Arun K</span>
                  <span className="tp-lrow-sub">arun@sharmamart.in · Viewer</span>
                  <span className="tp-lrow-actions">
                    <span data-muted="true">Remove</span>
                  </span>
                </span>
                <PortalBadge tone="success">Active</PortalBadge>
              </div>
            </PortalCard>
          </div>
        ) : null}

        {only("settings-security") ? (
          <div>
            <PortalCard>
              <p className="tp-card-title">Security</p>
              <p className="tp-card-note">Changing either signs other sessions out.</p>
              <dl className="tp-dl">
                <PortalDlRow label="Email" value="ravi@sharmamart.in" />
                <PortalDlRow label="Password" value="••••••••••••" />
              </dl>
              <PortalOutline
                block
                target="settings-email"
                active={is(activeTarget, "settings-email")}
              >
                <Mail aria-hidden="true" />
                Change email
              </PortalOutline>
              <div className="tp-security-gap" />
              <PortalOutline
                block
                target="settings-password"
                active={is(activeTarget, "settings-password")}
              >
                <ShieldCheck aria-hidden="true" />
                Change password
              </PortalOutline>
            </PortalCard>
          </div>
        ) : null}
      </PortalScroll>
      <PortalBottomNav mode="orders" />
      {emailing ? (
        <PortalSheet
          title="Change email"
          target="settings-email"
          footer={
            <>
              <PortalOutline block>Cancel</PortalOutline>
              <PortalPrimary block target="email-save" active={is(activeTarget, "email-save")}>
                Save email
              </PortalPrimary>
            </>
          }
        >
          <PortalField
            label="New email"
            value="ravi.sharma@sharmamart.in"
            target="email-new"
            active={is(activeTarget, "email-new")}
          />
          <PortalField
            label="Current password"
            value="••••••••••••"
            target="email-password"
            active={is(activeTarget, "email-password")}
          />
          <p className="tp-sheet-note">
            Every other session is signed out. This device stays signed in.
          </p>
        </PortalSheet>
      ) : null}
    </PortalPhone>
  );
}

/** `/seller/ads` — `HubHeader`, the four KPI cards (`Impressions`, `Clicks`,
 * `CTR`, `Orders attributed`), the `New hero campaign` wizard rail, then
 * `My campaigns` with one card per published campaign.
 */
export function AdsScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalHubHeader shop="Sharma Mart" />
      <PortalScroll>
        <div className="tp-kpis tp-kpis--2">
          <span className="tp-kpi">
            <small>Impressions</small>
            <b data-big="true">1,24,880</b>
          </span>
          <span className="tp-kpi">
            <small>Clicks</small>
            <b data-big="true">6,204</b>
          </span>
          <span className="tp-kpi">
            <small>CTR</small>
            <b data-big="true">4.97%</b>
          </span>
          <span className="tp-kpi">
            <small>Orders attributed</small>
            <b data-big="true">318</b>
          </span>
        </div>
        <PortalCard>
          <div className="tp-rowhead">
            <b>New hero campaign</b>
            <span
              className="tp-rowhead-action"
              data-tour-target="ad-new"
              data-active={is(activeTarget, "ad-new") || undefined}
            >
              Start
            </span>
          </div>
          <p className="tp-card-note">
            Promote one of your own items — goes live instantly, machine-checked (owner, placement
            fit, poster, length, caps).
          </p>
          <div className="tp-steprail">
            <span className="tp-steprail-item" data-on="true">
              1 What
            </span>
            <span className="tp-steprail-item">2 Where</span>
            <span className="tp-steprail-item">3 Creative</span>
            <span className="tp-steprail-item">4 When</span>
            <span className="tp-steprail-item">5 Review</span>
          </div>
          <div className="tp-tabpills">
            <span className="tp-tabpill" data-on="true">
              Products
            </span>
            <span className="tp-tabpill">Dishes</span>
            <span className="tp-tabpill">Stores</span>
          </div>
          <PortalField label="Search your items…" value="Basmati rice 5 kg" />
          <div className="tp-lrowbox">
            <div
              className="tp-lrow"
              data-tour-target="ad-campaign"
              data-active={is(activeTarget, "ad-campaign") || undefined}
            >
              <span className="tp-lrow-main">
                <span className="tp-lrow-title">Basmati rice 5 kg</span>
                <span className="tp-lrow-sub">PRD-1042 · Mart</span>
              </span>
              <CheckCircle2 aria-hidden="true" />
            </div>
          </div>
        </PortalCard>
        <p className="tp-sec-title">My campaigns</p>
        <PortalCard>
          <div className="tp-camp-head">
            <span className="tp-camp-thumb" aria-hidden="true">
              <Megaphone />
            </span>
            <span className="tp-outlet-text">
              <p className="tp-card-title">Home hero</p>
              <p className="tp-card-note">Weekend boost on basmati rice</p>
              <p className="tp-camp-target">PRODUCT · PRD-1042</p>
            </span>
            <PortalBadge tone="success">Live</PortalBadge>
          </div>
          <div className="tp-kpis tp-kpis--4">
            <span className="tp-kpi">
              <small>Impressions</small>
              <b>84,210</b>
            </span>
            <span className="tp-kpi">
              <small>Clicks</small>
              <b>4,120</b>
            </span>
            <span className="tp-kpi">
              <small>CTR</small>
              <b>4.89%</b>
            </span>
            <span className="tp-kpi">
              <small>Orders</small>
              <b>212</b>
            </span>
          </div>
        </PortalCard>
        <PortalCard>
          <div className="tp-camp-head">
            <span className="tp-camp-thumb" aria-hidden="true">
              <Megaphone />
            </span>
            <span className="tp-outlet-text">
              <p className="tp-card-title">Category rail</p>
              <p className="tp-card-note">Festive rice push</p>
              <p className="tp-camp-target">DISH · DSH-204</p>
            </span>
            <PortalBadge tone="info">Requested</PortalBadge>
          </div>
          <div className="tp-kpis tp-kpis--4">
            <span className="tp-kpi">
              <small>Impressions</small>
              <b>40,670</b>
            </span>
            <span className="tp-kpi">
              <small>Clicks</small>
              <b>2,084</b>
            </span>
            <span className="tp-kpi">
              <small>CTR</small>
              <b>5.12%</b>
            </span>
            <span className="tp-kpi">
              <small>Orders</small>
              <b>106</b>
            </span>
          </div>
        </PortalCard>
        <PortalNote tone="info">
          Slots are placements in the customer app. There is no tracking pixel; attribution is
          per-slot impressions and taps.
        </PortalNote>
      </PortalScroll>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/** The step rail of the ad wizard: `What / Where / Creative / When / Review`. */
const AD_STEPS = ["What", "Where", "Creative", "When", "Review"] as const;

/**
 * `/seller/ads` with the `New hero campaign` wizard open. The wizard is one
 * five-step form, so the screen derives its step from the active target instead
 * of remounting: What (targets) → Where (placements) → Creative (title,
 * subtitle, poster, CTA) → When (dates) → Review (Publish now).
 */
export function AdsWizardScreen({ activeTarget }: ScreenProps) {
  const stepOf = (target: string) => {
    if (target === "ad-where") return 1;
    if (target === "ad-creative") return 2;
    if (target === "ad-when") return 3;
    if (target === "ad-publish") return 4;
    return 0;
  };
  const step = stepOf(activeTarget);

  return (
    <PortalPhone>
      <PortalHubHeader shop="Sharma Mart" />
      <PortalScroll>
        <PortalCard>
          <p className="tp-card-title">New hero campaign</p>
          <p className="tp-card-note">
            Promote one of your own items — goes live instantly, machine-checked (owner, placement
            fit, poster, length, caps).
          </p>
          <div className="tp-steprail">
            {AD_STEPS.map((label, index) => (
              <span
                key={label}
                className="tp-steprail-item"
                data-on={index === step || undefined}
                data-done={index < step || undefined}
              >
                {index < step ? <CheckCircle2 aria-hidden="true" /> : index + 1} {label}
              </span>
            ))}
          </div>

          {step === 0 ? (
            <div
              data-tour-target="ad-target"
              data-active={is(activeTarget, "ad-target") || undefined}
            >
              <div className="tp-tabpills">
                <span className="tp-tabpill" data-on="true">
                  Products
                </span>
                <span className="tp-tabpill">Dishes</span>
                <span className="tp-tabpill">Stores</span>
              </div>
              <PortalSearchRow placeholder="Search your items…" filter={false} />
              <div className="tp-lrowbox">
                <div className="tp-lrow" data-selected="true">
                  <span className="tp-lrow-main">
                    <span className="tp-lrow-title">Basmati rice 5 kg</span>
                    <span className="tp-lrow-sub">PRD-1042 · MART</span>
                  </span>
                  <CheckCircle2 aria-hidden="true" />
                </div>
                <div className="tp-lrow">
                  <span className="tp-lrow-main">
                    <span className="tp-lrow-title">Sunflower oil 1 L</span>
                    <span className="tp-lrow-sub">PRD-1048 · MART</span>
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div
              data-tour-target="ad-where"
              data-active={is(activeTarget, "ad-where") || undefined}
            >
              <div className="tp-placements">
                <div className="tp-placement" data-on="true">
                  <span className="tp-placement-label">Home hero</span>
                  <span className="tp-placement-reach">Reach 42,000 shoppers</span>
                </div>
                <div className="tp-placement">
                  <span className="tp-placement-label">Category rail</span>
                  <span className="tp-placement-reach">Reach 18,400 shoppers</span>
                </div>
                <div className="tp-placement">
                  <span className="tp-placement-label">Search banner</span>
                  <span className="tp-placement-reach">Reach 9,200 shoppers</span>
                </div>
              </div>
              <p className="tp-card-note">
                A dish cannot take a Mart-only slot. A category placement also picks its category
                page.
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div
              data-tour-target="ad-creative"
              data-active={is(activeTarget, "ad-creative") || undefined}
            >
              <PortalField label="Title (max 40)" value="Big Savings Everyday" />
              <p className="tp-count">20/40</p>
              <PortalField label="Subtitle (max 60)" value="UP TO 50% OFF" />
              <p className="tp-count">13/60</p>
              <p className="tp-field-label">16:9 poster</p>
              <PortalUpload status="hero-rice.jpg · uploaded" />
              <p className="tp-field-label">Call to action</p>
              <div className="tp-chips">
                <span className="tp-chip" data-on="true">
                  Shop now
                </span>
                <span className="tp-chip">Order now</span>
                <span className="tp-chip">Know more</span>
              </div>
              <p className="tp-card-note">
                External image links are rejected; upload to Faazio so the poster is served from our
                CDN.
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div data-tour-target="ad-when" data-active={is(activeTarget, "ad-when") || undefined}>
              <PortalPicker label="Starts" value="18 Nov 2026" />
              <PortalPicker label="Ends (default +30 days, max 90)" value="18 Dec 2026" />
              <PortalNote tone="info">
                Your ad goes live the moment you publish. Position within a placement is by
                relevance and recency; impressions and clicks roll up on your dashboard.
              </PortalNote>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <dl className="tp-dl">
                <PortalDlRow label="Target" value="Basmati rice 5 kg" />
                <PortalDlRow label="Placement" value="Home hero" />
                <PortalDlRow label="Call to action" value="Shop now" />
                <PortalDlRow label="Window" value="18 Nov – 18 Dec 2026" />
              </dl>
              <div className="tp-review-live">
                <PortalBadge tone="success">Live</PortalBadge>
                <span className="tp-card-note">Publishes instantly — no admin approval.</span>
              </div>
              <PortalPrimary block target="ad-publish" active={is(activeTarget, "ad-publish")}>
                Publish now
              </PortalPrimary>
            </div>
          ) : null}
        </PortalCard>
      </PortalScroll>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/**
 * `/seller/analytics` — `HubHeader` with the 7d / 30d / 90d pills in its action
 * slot, the GMV and Orders cards with `vs previous period` and their sparkline,
 * the revenue bars, the status split, then category mix, cities and the product
 * leaderboard.
 */
export function AnalyticsScreen({ activeTarget }: ScreenProps) {
  const period = is(activeTarget, "analytics-period") ? "30d" : "7d";
  return (
    <PortalPhone>
      <PortalHubHeader
        shop="Sharma Mart"
        action={
          <span
            className="tp-period"
            data-tour-target="analytics-period"
            data-active={is(activeTarget, "analytics-period") || undefined}
          >
            <span data-on={period === "7d" || undefined}>7d</span>
            <span data-on={period === "30d" || undefined}>30d</span>
            <span>90d</span>
          </span>
        }
      />
      <PortalScroll>
        <div
          className="tp-kpis tp-kpis--2"
          data-tour-target="analytics-series"
          data-active={is(activeTarget, "analytics-series") || undefined}
        >
          <span className="tp-kpi">
            <small>GMV ({period})</small>
            <b data-big="true">
              ₹42.2K <small data-up="true">▲ 12%</small>
            </b>
            <small>vs previous period</small>
            <PortalBars values={[38, 52, 46, 64, 58, 81, 72]} compact />
          </span>
          <span className="tp-kpi">
            <small>Orders ({period})</small>
            <b data-big="true">
              128 <small data-up="true">▲ 8%</small>
            </b>
            <small>vs previous period</small>
            <PortalBars values={[30, 41, 39, 52, 48, 66, 60]} compact />
          </span>
        </div>
        <PortalCard>
          <PortalCardHead title="Revenue trend" note="Last 7 days, settled order value" />
          <PortalBars values={[38, 52, 46, 64, 58, 81, 72]} />
        </PortalCard>
        <PortalCard>
          <p className="tp-card-title">Order status split</p>
          <PortalProgress label="Delivered" value="112" percent={88} />
          <PortalProgress label="Out for delivery" value="9" percent={7} />
          <PortalProgress label="Preparing" value="5" percent={4} />
          <PortalProgress label="Cancelled" value="2" percent={2} tone="muted" />
        </PortalCard>
        <PortalCard>
          <PortalCardHead title="Category mix" note="GMV share by category" />
          <div className="tp-dl">
            <PortalDlRow label="Rice &amp; grains" value="₹16.8K" />
            <PortalDlRow label="Dals &amp; pulses" value="₹9.4K" />
            <PortalDlRow label="Cooking oil" value="₹7.1K" />
          </div>
        </PortalCard>
        <PortalCard>
          <PortalCardHead title="Top cities" note="GMV by delivery city" />
          <PortalProgress label="Karaikal" value="₹18.2K" percent={100} />
          <PortalProgress label="Nagapattinam" value="₹9.6K" percent={53} />
          <PortalProgress label="Thiruvarur" value="₹6.1K" percent={34} />
        </PortalCard>
        <PortalCard>
          <PortalCardHead title="Product performance" note="GMV and orders by product" />
          <div className="tp-list">
            <div className="tp-lrow">
              <span className="tp-lrow-main">
                <span className="tp-lrow-title">Basmati rice 5 kg</span>
                <span className="tp-lrow-sub">48 orders</span>
              </span>
              <span className="tp-lrow-end">₹16.8K</span>
            </div>
            <div className="tp-lrow">
              <span className="tp-lrow-main">
                <span className="tp-lrow-title">Toor dal 1 kg</span>
                <span className="tp-lrow-sub">36 orders</span>
              </span>
              <span className="tp-lrow-end">₹9.4K</span>
            </div>
            <div className="tp-lrow">
              <span className="tp-lrow-main">
                <span className="tp-lrow-title">Cold-pressed sunflower oil 1 L</span>
                <span className="tp-lrow-sub">29 orders</span>
              </span>
              <span className="tp-lrow-end">₹7.1K</span>
            </div>
          </div>
        </PortalCard>
      </PortalScroll>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/**
 * `/seller/reviews` — `HubHeader` with the `Reviews` / `Complaints` header tabs,
 * the average strip, the search + star pills, then one card per review with
 * `Reply` and `Flag to admin`.
 */
export function ReviewsScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalHubHeader
        shop="Sharma Mart"
        sticky={
          <PortalPillTabs
            items={[
              { label: "Reviews", on: true, count: 3 },
              { label: "Complaints", count: 1 },
            ]}
          />
        }
      />
      <PortalScroll>
        <div className="tp-rating-strip">
          <span className="tp-rating-badge">4.2★</span>
          <span className="tp-rating-text">
            <b>4.2 average • 3 ratings</b>
            <small>From shop ratings and reviews</small>
          </span>
          <span className="tp-rating-stars" aria-hidden="true">
            <span>
              5<Star />
            </span>
            <span>
              4<Star />
            </span>
            <span>
              3<Star />
            </span>
          </span>
        </div>
        <PortalSearchRow placeholder="Search reviews" filter={false} />
        <div className="tp-starpills">
          {[5, 4, 3, 2, 1].map((n) => (
            <span key={n} className="tp-starpill">
              {n}
              <Star />
            </span>
          ))}
        </div>
        <p className="tp-sec-title">Reviews (3)</p>
        <div
          data-tour-target="review-row"
          data-active={is(activeTarget, "review-row") || undefined}
        >
          <PortalCard>
            <div className="tp-review-head">
              <span className="tp-review-avatar">A</span>
              <span className="tp-outlet-text">
                <p className="tp-card-title">A. Kumar</p>
                <p className="tp-card-note">2 days ago</p>
              </span>
              <span className="tp-rating-pill" data-good="true">
                4★
              </span>
            </div>
            <p className="tp-review-body">Packed well, everything arrived intact.</p>
            <p className="tp-review-reply">
              <b>Your reply:</b> Thanks — we pack fragile items separately now.
            </p>
          </PortalCard>
        </div>
        <PortalCard>
          <div className="tp-review-head">
            <span className="tp-review-avatar">M</span>
            <span className="tp-outlet-text">
              <p className="tp-card-title">M. Devi</p>
              <p className="tp-card-note">Yesterday</p>
            </span>
            <span className="tp-rating-pill" data-good="true">
              5★
            </span>
          </div>
          <p className="tp-review-body">Very fresh stock, quick pickup.</p>
          <div className="tp-review-actions">
            <span
              data-tour-target="review-reply"
              data-active={is(activeTarget, "review-reply") || undefined}
            >
              Reply
            </span>
            <span
              data-brand="true"
              data-tour-target="review-flag"
              data-active={is(activeTarget, "review-flag") || undefined}
            >
              Flag to admin
            </span>
          </div>
          {is(activeTarget, "review-reply") ? (
            <p className="tp-review-reply">
              <b>Your reply:</b> Thank you — we restock fresh every morning.
            </p>
          ) : null}
        </PortalCard>
        <PortalCard>
          <div className="tp-review-head">
            <span className="tp-review-avatar">R</span>
            <span className="tp-outlet-text">
              <p className="tp-card-title">R. Iyer</p>
              <p className="tp-card-note">3 days ago</p>
            </span>
            <span className="tp-rating-pill">3★</span>
          </div>
          <p className="tp-review-body">Late pickup but the order was correct.</p>
          <div className="tp-review-actions">
            <span>Reply</span>
            <span data-brand="true">Flag to admin</span>
          </div>
        </PortalCard>
        <PortalNote tone="info">
          Reply publicly, or flag a review to an admin for moderation. A review cannot be deleted.
        </PortalNote>
      </PortalScroll>
      <PortalBottomNav mode="orders" />
    </PortalPhone>
  );
}

/**
 * `/seller/returns` — `Returns` under `Operations`: one card per returned or
 * cancelled order with the order value, the refund drawn from settlement and the
 * Reject / Approve pair.
 */
export function ReturnsScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader sub="Operations" title="Returns" />
      <PortalScroll>
        <PortalCard>
          <div className="tp-trash-head">
            <span className="tp-outlet-text">
              <p className="tp-card-title">#FAZ10425</p>
              <p className="tp-card-note">A. Kumar</p>
            </span>
            <PortalBadge tone="brand">Returned</PortalBadge>
          </div>
          <div className="tp-kpis tp-kpis--2">
            <span className="tp-kpi">
              <small>Order value</small>
              <b>₹145.00</b>
            </span>
            <span className="tp-kpi">
              <small>Refund from settlement</small>
              <b>₹145.00</b>
            </span>
          </div>
          <PortalActionRow>
            <PortalOutline target="return-row" active={is(activeTarget, "return-row")}>
              Reject
            </PortalOutline>
            <PortalPrimary>Approve</PortalPrimary>
          </PortalActionRow>
        </PortalCard>
        <PortalCard>
          <div className="tp-trash-head">
            <span className="tp-outlet-text">
              <p className="tp-card-title">#FAZ10412</p>
              <p className="tp-card-note">M. Devi</p>
            </span>
            <PortalBadge tone="warning">Cancelled</PortalBadge>
          </div>
          <div className="tp-kpis tp-kpis--2">
            <span className="tp-kpi">
              <small>Order value</small>
              <b>₹320.00</b>
            </span>
            <span className="tp-kpi">
              <small>Refund from settlement</small>
              <b>₹320.00</b>
            </span>
          </div>
        </PortalCard>
        <PortalNote tone="info">
          A refund is drawn from your next settlement, so approving never needs a card on file.
        </PortalNote>
      </PortalScroll>
      <PortalBottomNav mode="orders" />
    </PortalPhone>
  );
}

/**
 * `/seller/prescriptions` — `Prescriptions` under `Operations`: one card per
 * routed request with its `RX-` id, the `customer · fulfillment · N pages` line,
 * the status pill and the created-at / quote footer.
 */
export function PrescriptionsScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader sub="Operations" title="Prescriptions" />
      <PortalScroll>
        <PortalCard>
          <div
            className="tp-rx-head"
            data-tour-target="rx-row"
            data-active={is(activeTarget, "rx-row") || undefined}
          >
            <span className="tp-outlet-text">
              <p className="tp-card-title">RX-88214</p>
              <p className="tp-card-note">A. Kumar · PICKUP · 1 page</p>
            </span>
            <PortalBadge tone="warning">Received</PortalBadge>
          </div>
          <div className="tp-rx-foot">
            <span>17 Nov 2026, 4:02 PM</span>
            <b>Quote ₹380.00</b>
          </div>
        </PortalCard>
        <PortalCard>
          <div className="tp-rx-head">
            <span className="tp-outlet-text">
              <p className="tp-card-title">RX-88190</p>
              <p className="tp-card-note">M. Devi · DELIVERY · 2 pages</p>
            </span>
            <PortalBadge tone="info">Quoted</PortalBadge>
          </div>
          <div className="tp-rx-foot">
            <span>17 Nov 2026, 11:20 AM</span>
            <b>Quote ₹640.00</b>
          </div>
        </PortalCard>
        <PortalCard>
          <div className="tp-rx-head">
            <span className="tp-outlet-text">
              <p className="tp-card-title">RX-88174</p>
              <p className="tp-card-note">R. Iyer · DELIVERY · 1 page</p>
            </span>
            <PortalBadge tone="success">Ready</PortalBadge>
          </div>
          <div className="tp-rx-foot">
            <span>16 Nov 2026, 6:48 PM</span>
            <b>Quote ₹215.00</b>
          </div>
        </PortalCard>
        <PortalNote tone="info">
          Only this pharmacy store sees the scan and the patient note. Prescription details never
          appear in logs.
        </PortalNote>
      </PortalScroll>
      <PortalBottomNav mode="orders" />
    </PortalPhone>
  );
}

/**
 * `SellerPlatformFeeRequestScreen` (customer app): the vendor chip, the fee in
 * force, `Requested fee (%)`, the submit button, and the request `History` rows
 * with their status pills.
 */
export function FeeRequestScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader title="Platform fee" />
      <PortalScroll>
        <PortalCard>
          <p className="tp-fee-title">
            <BadgePercent aria-hidden="true" />
            Request a fee change
          </p>
          <p className="tp-card-note">
            Your platform fee is fixed when your store is approved. Ask for a new rate per shop here
            and an admin will review it.
          </p>
          <p className="tp-field-label">Vendor store</p>
          <div className="tp-chips">
            <span className="tp-chip" data-on="true">
              Sharma Mart · MART
            </span>
            <span className="tp-chip">Sharma Kitchen · FOOD</span>
          </div>
          <div
            className="tp-fee-current"
            data-tour-target="fee-current"
            data-active={is(activeTarget, "fee-current") || undefined}
          >
            <span className="tp-fee-current-label">Current fee · Sharma Mart</span>
            <span className="tp-fee-current-value">18%</span>
          </div>
          <PortalField
            label="Requested fee (%)"
            value="12"
            target="fee-amount"
            active={is(activeTarget, "fee-amount")}
          />
          <p className="tp-field-label">Why should the fee change?</p>
          <div
            className="tp-textarea"
            data-tour-target="fee-reason"
            data-active={is(activeTarget, "fee-reason") || undefined}
          >
            Margins on staples are thin at 18% — asking for 12% to stay competitive.
          </div>
          <PortalNote tone="warning">A request for 12% is pending review.</PortalNote>
          <PortalPrimary block target="fee-submit" active={is(activeTarget, "fee-submit")}>
            Submit request
          </PortalPrimary>
        </PortalCard>
        <p
          className="tp-sec-title"
          data-tour-target="fee-history"
          data-active={is(activeTarget, "fee-history") || undefined}
        >
          History
        </p>
        <PortalCard>
          <div className="tp-fee-row">
            <span className="tp-outlet-text">
              <p className="tp-card-title">18% → 12%</p>
              <p className="tp-card-note">12 Nov 2026</p>
            </span>
            <PortalBadge tone="warning">PENDING</PortalBadge>
          </div>
          <div className="tp-fee-row">
            <span className="tp-outlet-text">
              <p className="tp-card-title">22% → 18%</p>
              <p className="tp-card-note">3 Sep 2026 · Volume tier met</p>
            </span>
            <PortalBadge tone="success">APPROVED</PortalBadge>
          </div>
        </PortalCard>
        <PortalNote tone="info">
          A district or superadmin reviews it on the Fee change requests board. Only one request per
          shop can be pending.
        </PortalNote>
      </PortalScroll>
    </PortalPhone>
  );
}

/**
 * `/seller/prescriptions` with one request open: the sheet carries the patient
 * note, the `Rx images` row, the quote builder (item rows, `Quote total`,
 * `Save quote` / `Mark READY`) and, once it is READY, the audited PII block.
 */
export function RxDetailScreen({ activeTarget }: ScreenProps) {
  // Once the request is marked READY the customer's contact block appears — and it
  // stays for the PII step that follows, exactly as the console behaves.
  const ready = activeTarget === "rx-mark-ready" || activeTarget === "rx-pii";

  return (
    <PortalPhone>
      <PortalPageHeader sub="Operations" title="Prescriptions" />
      <PortalScroll>
        <PortalCard>
          <div className="tp-rx-head">
            <span className="tp-outlet-text">
              <p className="tp-card-title">RX-88214</p>
              <p className="tp-card-note">A. Kumar · PICKUP · 1 page</p>
            </span>
            <PortalBadge tone="warning">Received</PortalBadge>
          </div>
          <div className="tp-rx-foot">
            <span>17 Nov 2026, 4:02 PM</span>
            <b>Quote ₹380.00</b>
          </div>
        </PortalCard>
      </PortalScroll>
      <PortalSheet title="RX-88214 · RECEIVED">
        <p className="tp-sheet-note">A. Kumar · PICKUP · 1 page</p>
        <p className="tp-rx-label">Patient note</p>
        <div className="tp-rx-note">Take 1 tablet twice a day after food, 5 days.</div>

        <div className="tp-rx-rowhead">
          <p className="tp-rx-label">Rx images</p>
          <span
            className="tp-rx-action"
            data-tour-target="rx-images"
            data-active={is(activeTarget, "rx-images") || undefined}
          >
            View images
          </span>
        </div>
        <p className="tp-rx-hint">1 private Storage key(s)</p>
        <div className="tp-rx-thumbs">
          <span className="tp-rx-thumb" aria-hidden="true" />
        </div>

        <div className="tp-rx-rowhead">
          <p className="tp-rx-label">Quote</p>
          <span className="tp-rx-action">+ Add item</span>
        </div>
        <div
          className="tp-rx-quote"
          data-tour-target="rx-quote"
          data-active={is(activeTarget, "rx-quote") || undefined}
        >
          <div className="tp-rx-item">
            <span className="tp-rx-item-name">Paracetamol 500 mg</span>
            <span className="tp-rx-item-grid">
              <span>1</span>
              <span>₹40</span>
              <span>₹38</span>
              <span>₹2</span>
            </span>
          </div>
        </div>
        <div className="tp-rx-total">
          <span>Quote total</span>
          <b>₹380.00</b>
        </div>
        <div className="tp-rx-actions">
          <span
            className="tp-outline"
            data-tour-target="rx-save-quote"
            data-active={is(activeTarget, "rx-save-quote") || undefined}
          >
            Save quote
          </span>
          <span
            className="tp-primary"
            data-tour-target="rx-mark-ready"
            data-active={is(activeTarget, "rx-mark-ready") || undefined}
          >
            Mark READY
          </span>
        </div>

        {ready ? (
          <div
            className="tp-rx-pii"
            data-tour-target="rx-pii"
            data-active={is(activeTarget, "rx-pii") || undefined}
          >
            <p className="tp-rx-pii-head">
              <ShieldCheck aria-hidden="true" />
              PII revealed (audited)
            </p>
            <p className="tp-rx-pii-body">+91 98436 31722 · 12, Bharathiar Road, Karaikal</p>
            <p className="tp-rx-pii-when">Revealed 17 Nov 2026, 4:20 PM</p>
          </div>
        ) : null}
      </PortalSheet>
      <PortalBottomNav mode="orders" />
    </PortalPhone>
  );
}

/**
 * `/seller/explore` — `Explore more` with the search toggle and the initials
 * avatar in the header (the explore icon is hidden on this page itself), the
 * five section grids of 48px tiles, then the `Sign out` row.
 */
export function ExploreScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader
        title="Explore more"
        menu={false}
        action={
          <>
            <span
              className="tp-icon-btn"
              data-tour-target="explore-search"
              data-active={is(activeTarget, "explore-search") || undefined}
            >
              <Search />
            </span>
            <span className="tp-avatar" data-muted="true">
              R
            </span>
          </>
        }
      />
      <PortalScroll>
        <div className="tp-explore-sec">
          <p className="tp-explore-title">Overview</p>
          <PortalTileGrid>
            <PortalTile label="Business Hub" icon={<LayoutGrid />} />
            <PortalTile label="Analytics" icon={<TrendingUp />} />
            <PortalTile label="Order history" icon={<Clock />} />
          </PortalTileGrid>
        </div>
        <div className="tp-explore-sec">
          <p className="tp-explore-title">Orders</p>
          <PortalTileGrid>
            <PortalTile label="Orders" icon={<ClipboardList />} />
            <PortalTile label="Restaurant status" icon={<Bike />} />
            <PortalTile label="Rush hour" icon={<Hourglass />} badge="ON" />
            <PortalTile label="Returns" icon={<Repeat />} />
          </PortalTileGrid>
        </div>
        <div
          className="tp-explore-sec"
          data-tour-target="explore-grid"
          data-active={is(activeTarget, "explore-grid") || undefined}
        >
          <p className="tp-explore-title">Catalog</p>
          <PortalTileGrid>
            <PortalTile label="Products" icon={<Package />} />
            <PortalTile label="Pricing" icon={<Tag />} />
            <PortalTile label="Inventory" icon={<Beaker />} />
            <PortalTile label="Menu" icon={<BookOpen />} />
            <PortalTile label="Offers" icon={<BadgePercent />} />
          </PortalTileGrid>
        </div>
        <div className="tp-explore-sec">
          <p className="tp-explore-title">Operations</p>
          <PortalTileGrid>
            <PortalTile label="Prescriptions" icon={<FileText />} />
            <PortalTile label="Payments" icon={<Wallet />} />
            <PortalTile label="Promotions" icon={<BadgePercent />} />
            <PortalTile label="Ads" icon={<Megaphone />} />
          </PortalTileGrid>
        </div>
        <div className="tp-explore-sec">
          <p className="tp-explore-title">Account</p>
          <PortalTileGrid>
            <PortalTile label="Stores" icon={<Store />} />
            <PortalTile label="Reviews" icon={<Star />} />
            <PortalTile label="Settings" icon={<Settings />} />
            <PortalTile label="Support" icon={<LifeBuoy />} />
          </PortalTileGrid>
        </div>
        <div
          className="tp-signout"
          data-tour-target="explore-signout"
          data-active={is(activeTarget, "explore-signout") || undefined}
        >
          <span className="tp-signout-icon">
            <LogOut aria-hidden="true" />
          </span>
          <span>Sign out</span>
        </div>
      </PortalScroll>
    </PortalPhone>
  );
}

/**
 * `/seller/hub` — `HubHeader` with the unread bell and the `My Feed / Sales /
 * Funnel / Service quality / Kitchen` pills, then Today so far, Shop health and
 * the Setup checklist.
 */
export function HubScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalHubHeader
        shop="Sharma Mart"
        bellTarget="notif-bell"
        bellActive={is(activeTarget, "notif-bell")}
        sticky={
          <PortalHubTabs
            items={[
              { label: "My Feed", on: true },
              { label: "Sales", target: "hub-tabs" },
              { label: "Funnel" },
              { label: "Service quality" },
              { label: "Kitchen" },
            ]}
            active={is(activeTarget, "hub-tabs")}
          />
        }
      />
      <PortalScroll>
        <div
          className="tp-rangebar"
          data-tour-target="hub-range"
          data-active={is(activeTarget, "hub-range") || undefined}
        >
          <span>
            <b>Last 30 days</b>
            <small>vs previous 30 days</small>
          </span>
          <Calendar aria-hidden="true" />
        </div>
        <PortalCard>
          <p className="tp-card-title">Today so far</p>
          <div className="tp-kpis tp-kpis--2">
            <span className="tp-kpi">
              <small>Total sales</small>
              <b data-big="true">₹4,260</b>
            </span>
            <span className="tp-kpi">
              <small>
                Total orders <em className="tp-live">● Live</em>
              </small>
              <b data-big="true">14</b>
            </span>
          </div>
        </PortalCard>
        <PortalCard>
          <div className="tp-health-head">
            <span>
              <p className="tp-card-title">Shop health</p>
              <p className="tp-card-note">
                Weighted score · <b>Good</b>
              </p>
            </span>
            <p className="tp-health-score">
              82 <small>/100</small>
            </p>
          </div>
          <PortalProgress percent={82} />
          <div className="tp-health-parts">
            <span>
              <CheckCircle2 aria-hidden="true" />
              Accept rate <b>96%</b>
            </span>
            <span>
              <CheckCircle2 aria-hidden="true" />
              Prep time on target <b>92%</b>
            </span>
            <span data-warn="true">
              <AlertTriangle aria-hidden="true" />
              SLA breaches <b>1</b>
            </span>
          </div>
        </PortalCard>
        <div
          data-tour-target="hub-checklist"
          data-active={is(activeTarget, "hub-checklist") || undefined}
        >
          <PortalCard>
            <p className="tp-card-title">Setup checklist</p>
            <p className="tp-card-note">3 of 5 done</p>
            <div className="tp-tasks">
              <span data-done="true">
                <CheckCircle2 aria-hidden="true" />
                Business KYC verified
              </span>
              <span data-done="true">
                <CheckCircle2 aria-hidden="true" />
                Bank account added
              </span>
              <span data-done="true">
                <CheckCircle2 aria-hidden="true" />
                Store hours confirmed
              </span>
              <span>
                <Circle aria-hidden="true" />
                First 5 products listed
              </span>
              <span>
                <Circle aria-hidden="true" />
                Festival opt-in submitted
              </span>
            </div>
          </PortalCard>
        </div>
      </PortalScroll>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/**
 * `/seller/outlet-info` — `Outlet info` with the `ID: …` right note, the shop card
 * (name, platform fee, sector badge, chips, address + `View on map`, then the
 * hours / delivery / phone rows), and the Stores / Reviews / Settings links.
 */
export function OutletInfoScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader
        title="Outlet info"
        action={<span className="tp-header-note">ID: STR-4412</span>}
      />
      <PortalScroll>
        <PortalCard>
          <div className="tp-outlet-head">
            <span className="tp-outlet-text">
              <p className="tp-outlet-name">Sharma Mart</p>
              <p className="tp-card-note">18% platform fee</p>
            </span>
            <PortalBadge tone="info">Mart</PortalBadge>
          </div>
          <PortalTags items={["Live in the app", "Pure vegetarian"]} />
          <div className="tp-outlet-rows">
            <p className="tp-outlet-addr">
              <MapPin aria-hidden="true" />
              12, Bharathiar Road, Karaikal
            </p>
            <p className="tp-outlet-map">View on map</p>
            <div
              data-tour-target="outlet-hours"
              data-active={is(activeTarget, "outlet-hours") || undefined}
            >
              <p className="tp-outlet-row">
                <Clock aria-hidden="true" />
                <span>Opening hours</span>
                <b>8:00 AM – 10:00 PM</b>
              </p>
              <p className="tp-outlet-row">
                <Bike aria-hidden="true" />
                <span>Delivery time</span>
                <b>30 min</b>
              </p>
              <p className="tp-outlet-row">
                <Phone aria-hidden="true" />
                <span>Phone</span>
                <b>+91 98436 31722</b>
              </p>
            </div>
          </div>
        </PortalCard>
        <div className="tp-linkrow">
          Stores
          <ChevronRight aria-hidden="true" />
        </div>
        <div className="tp-linkrow">
          View all reviews
          <ChevronRight aria-hidden="true" />
        </div>
        <div className="tp-linkrow">
          Settings
          <ChevronRight aria-hidden="true" />
        </div>
      </PortalScroll>
      <PortalBottomNav mode="hub" />
    </PortalPhone>
  );
}

/**
 * `/seller/restaurant-status` — `Restaurant status` with the shop card: the
 * delivery-status switch, self delivery, the Rush mode row, store hours, the
 * offline warning, then `Delivery settings` and the `App settings` link.
 */
export function RestaurantStatusScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader title="Restaurant status" />
      <PortalScroll>
        <PortalCard>
          <p className="tp-card-title">Sharma Kitchen</p>
          <p className="tp-card-note">12, Bharathiar Road, Karaikal</p>
          <PortalSwitchRow
            label="Delivery status"
            sub="Online — receiving orders"
            on
            top
            target="status-toggle"
            active={is(activeTarget, "status-toggle")}
          />
          <PortalSwitchRow label="Self delivery" sub="Deliver orders with your own riders" />
          <div className="tp-linkrow tp-linkrow--card">
            <b>Rush mode</b>
            <span className="tp-linkrow-end">
              ON till 9:30 PM
              <ChevronRight aria-hidden="true" />
            </span>
          </div>
          <div className="tp-linkrow tp-linkrow--card">
            <span>
              <span className="tp-card-note">Store hours</span>
              <b>8:00 AM – 10:00 PM</b>
            </span>
          </div>
        </PortalCard>
        <PortalCard>
          <div className="tp-rowhead">
            <b>Delivery settings</b>
            <span
              className="tp-rowhead-action"
              data-tour-target="delivery-edit"
              data-active={is(activeTarget, "delivery-edit") || undefined}
            >
              Edit
            </span>
          </div>
          <dl className="tp-dl">
            <PortalDlRow label="Minimum order" value="₹100" />
            <PortalDlRow label="Packaging charge" value="₹20" />
            <PortalDlRow label="Delivery radius" value="8 km" />
          </dl>
        </PortalCard>
        <div className="tp-linkrow">
          App settings
          <ChevronRight aria-hidden="true" />
        </div>
      </PortalScroll>
      <PortalBottomNav mode="orders" food />
    </PortalPhone>
  );
}

/**
 * `/seller/restaurant-status` with the offline sheet open: `Why are you going
 * offline?` over the shop card, the sector reason radios, and `Back` / `Go
 * offline` in the footer.
 */
export function StatusOfflineScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader title="Restaurant status" />
      <PortalScroll>
        <PortalCard>
          <p className="tp-card-title">Sharma Kitchen</p>
          <p className="tp-card-note">12, Bharathiar Road, Karaikal</p>
          <PortalSwitchRow label="Delivery status" sub="Online — receiving orders" on top />
          <PortalSwitchRow label="Self delivery" sub="Deliver orders with your own riders" />
          <div className="tp-linkrow tp-linkrow--card">
            <b>Rush mode</b>
            <span className="tp-linkrow-end">
              ON till 9:30 PM
              <ChevronRight aria-hidden="true" />
            </span>
          </div>
        </PortalCard>
      </PortalScroll>
      <PortalSheet
        title="Why are you going offline?"
        footer={
          <>
            <PortalOutline grow>Back</PortalOutline>
            <PortalPrimary
              grow
              target="offline-confirm"
              active={is(activeTarget, "offline-confirm")}
            >
              Go offline
            </PortalPrimary>
          </>
        }
      >
        <div
          data-tour-target="offline-reason"
          data-active={is(activeTarget, "offline-reason") || undefined}
        >
          <PortalRadioRow label="Kitchen is full" on />
          <PortalRadioRow label="Staff shortage" />
          <PortalRadioRow label="Closing early today" />
          <PortalRadioRow label="Technical issue" />
          <PortalRadioRow label="Other" />
        </div>
      </PortalSheet>
      <PortalBottomNav mode="orders" food />
    </PortalPhone>
  );
}

/**
 * `/seller/rush-hour` — `Rush in kitchen`: the `bg-info-soft` banner with the Zap
 * icon, the three benefits as ticked lines, then the four duration radios and
 * the fixed `Confirm` bar.
 */
export function RushHourScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader title="Rush in kitchen" />
      <PortalScroll action>
        <div className="tp-rush-banner">
          <Zap aria-hidden="true" />
          <p>Inform us when your kitchen is in rush and you need more time to manage orders</p>
        </div>
        <p className="tp-sec-title">How this helps you</p>
        <div className="tp-benefits">
          <span>
            <CheckCircle2 aria-hidden="true" />
            Get more time to prepare food
          </span>
          <span>
            <CheckCircle2 aria-hidden="true" />
            Show correct delivery time to customers
          </span>
          <span>
            <CheckCircle2 aria-hidden="true" />
            Avoid crowding of riders at your outlet
          </span>
        </div>
        <p className="tp-sec-title">How long do you expect the rush at your outlet?</p>
        <div
          data-tour-target="rush-window"
          data-active={is(activeTarget, "rush-window") || undefined}
        >
          <PortalRadioRow label="30 minutes" on />
          <PortalRadioRow label="1 hour" />
          <PortalRadioRow label="2 hours" />
          <PortalRadioRow label="3 hours" />
        </div>
      </PortalScroll>
      <PortalActionBar target="rush-confirm" active={is(activeTarget, "rush-confirm")}>
        Confirm
      </PortalActionBar>
      <PortalBottomNav mode="orders" food />
    </PortalPhone>
  );
}

/**
 * `/seller/support` — `Support` under `Help` with the `Raise a ticket` card
 * (subject, `What happened?` box, `Submit ticket`), then `My tickets`.
 */
export function SupportScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalPageHeader sub="Help" title="Support" />
      <PortalScroll>
        <PortalCard>
          <p className="tp-card-title">Raise a ticket</p>
          <p className="tp-card-note">Partner support replies inside working hours.</p>
          <PortalField
            label="Subject"
            value="Payout for 5–11 Nov"
            target="support-new"
            active={is(activeTarget, "support-new")}
          />
          <p className="tp-field-label">What happened?</p>
          <div className="tp-textarea">The bank credit is ₹1,200 short.</div>
          <PortalPrimary block target="support-submit" active={is(activeTarget, "support-submit")}>
            Submit ticket
          </PortalPrimary>
        </PortalCard>
        <p className="tp-sec-title">My tickets</p>
        <div className="tp-empty">
          <span className="tp-empty-art" aria-hidden="true">
            <LifeBuoy />
          </span>
          <p className="tp-empty-text">Raise a ticket and it will appear here with its status</p>
        </div>
      </PortalScroll>
      <PortalBottomNav mode="orders" />
    </PortalPhone>
  );
}

/** `/accept-invite` — the teammate sets a password and joins the console. */
export function InviteAcceptScreen({ activeTarget }: ScreenProps) {
  return (
    <PortalPhone>
      <PortalInviteCard target="accept-submit" active={is(activeTarget, "accept-submit")} />
    </PortalPhone>
  );
}
