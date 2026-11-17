import {
  HiOutlineArrowPath,
  HiOutlineBanknotes,
  HiOutlineBell,
  HiOutlineBolt,
  HiOutlineBuildingStorefront,
  HiOutlineCheckCircle,
  HiOutlineClipboardDocumentCheck,
  HiOutlineCog6Tooth,
  HiOutlineCreditCard,
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlineFire,
  HiOutlineInbox,
  HiOutlineLifebuoy,
  HiOutlineLink,
  HiOutlineMapPin,
  HiOutlineMegaphone,
  HiOutlinePhoto,
  HiOutlinePlus,
  HiOutlineQrCode,
  HiOutlineReceiptPercent,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineTag,
  HiOutlineTrash,
  HiOutlineTruck,
  HiOutlineUserGroup,
  HiOutlineUsers,
  HiOutlineWallet,
} from "react-icons/hi2";
import {
  MockAppBar,
  MockBars,
  MockButton,
  MockCard,
  MockCheck,
  MockChips,
  MockField,
  MockGroup,
  MockHint,
  MockQR,
  MockRow,
  MockStat,
  MockSteps,
  MockToggle,
} from "./mock";
import type { ScreenProps } from "./screens";

const is = (activeTarget: string, target: string) => activeTarget === target;

export function StoreScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Stores" />
      <div className="tour-screen-body">
        <MockGroup title="Your vendors">
          <MockCard>
            <MockRow
              icon={<HiOutlineBuildingStorefront />}
              title="Sharma Mart"
              subtitle="Mart · live"
              target="store-list"
              active={is(activeTarget, "store-list")}
            />
            <MockRow
              icon={<HiOutlineBuildingStorefront />}
              title="Sharma Pharmacy"
              subtitle="Pharmacy · pending"
              muted
            />
          </MockCard>
        </MockGroup>
        <MockButton block target="new-store" active={is(activeTarget, "new-store")}>
          <HiOutlinePlus aria-hidden="true" /> Create a store
        </MockButton>
        <MockHint>Products and orders always belong to one of these vendors.</MockHint>
      </div>
    </>
  );
}

export function StoreCreateScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="New store" back />
      <div className="tour-screen-body">
        <MockGroup title="Store details">
          <MockCard>
            <MockField
              label="Store name"
              value="Sharma Mart"
              target="store-name"
              active={is(activeTarget, "store-name")}
            />
            <MockField label="Address" value="12 Bharathiar Road, Karaikal" />
            <MockField label="Phone" value="+91 98436 31722" />
            <MockField label="Hours" value="8:00 – 22:00, all days" />
          </MockCard>
        </MockGroup>
        <MockGroup title="App and category">
          <MockChips
            items={[{ label: "Mart", on: true }, { label: "Food" }, { label: "Pharma" }]}
          />
        </MockGroup>
        <MockGroup title="Licence">
          <MockCard>
            <MockField
              label="FSSAI licence"
              value="12345678901234"
              mono
              target="store-licence"
              active={is(activeTarget, "store-licence")}
            />
          </MockCard>
        </MockGroup>
        <MockButton block target="store-save" active={is(activeTarget, "store-save")}>
          Save store
        </MockButton>
      </div>
    </>
  );
}

export function CatalogAddScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Add product" back />
      <div className="tour-screen-body">
        <MockGroup title="Placement">
          <MockCard>
            <MockRow
              icon={<HiOutlineBuildingStorefront />}
              title="Sharma Mart"
              subtitle="Selling from"
              target="product-store"
              active={is(activeTarget, "product-store")}
            />
            <MockRow
              icon={<HiOutlineTag />}
              title="Rice & grains"
              subtitle="Category leaf"
              target="product-category"
              active={is(activeTarget, "product-category")}
            />
            <MockRow
              icon={<HiOutlineReceiptPercent />}
              title="GST 5%"
              subtitle="Tax bucket"
              target="product-gst"
              active={is(activeTarget, "product-gst")}
            />
          </MockCard>
        </MockGroup>
        <MockGroup title="Listing">
          <MockCard>
            <MockField
              label="Product name"
              value="Basmati rice 5 kg"
              target="product-name"
              active={is(activeTarget, "product-name")}
            />
            <MockField label="Price" value="₹520" mono />
            <MockField label="Unit" value="1 bag" />
          </MockCard>
        </MockGroup>
        <MockGroup title="Photo">
          <MockCard>
            <MockRow
              icon={<HiOutlinePhoto />}
              title="Add a photo"
              subtitle="JPG or PNG, clear and well lit"
              target="product-image"
              active={is(activeTarget, "product-image")}
              chevron={false}
            />
          </MockCard>
        </MockGroup>
        <MockButton block target="product-save" active={is(activeTarget, "product-save")}>
          Save — send for review
        </MockButton>
      </div>
    </>
  );
}

export function CatalogEditScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Products" back />
      <div className="tour-screen-body">
        <MockGroup title="Your listings">
          <MockCard>
            <MockRow
              icon={<HiOutlineCube />}
              title="Basmati rice 5 kg"
              subtitle="₹520 · Active"
              target="edit-row"
              active={is(activeTarget, "edit-row")}
            />
            <MockRow
              icon={<HiOutlineCube />}
              title="Toor dal 1 kg"
              subtitle="₹145 · Pending review"
              muted
            />
          </MockCard>
        </MockGroup>
        <MockGroup title="Edit listing">
          <MockCard>
            <MockField
              label="Description"
              value="Long-grain basmati rice, 5 kg bag."
              target="edit-description"
              active={is(activeTarget, "edit-description")}
            />
            <MockField label="Category" value="Rice & grains" />
          </MockCard>
        </MockGroup>
        <MockCard>
          <MockRow
            icon={<HiOutlineTrash />}
            title="Delete listing"
            subtitle="Hides it now; restorable for 7 days"
            target="delete-listing"
            active={is(activeTarget, "delete-listing")}
            chevron={false}
          />
        </MockCard>
      </div>
    </>
  );
}

export function CatalogTrashScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Trash" back />
      <div className="tour-screen-body">
        <MockGroup title="Deleted listings">
          <MockCard>
            <MockRow
              icon={<HiOutlineArrowPath />}
              title="Basmati rice 5 kg"
              subtitle="Restore it · purges in 5 days"
              target="restore-listing"
              active={is(activeTarget, "restore-listing")}
              chevron={false}
            />
          </MockCard>
        </MockGroup>
        <MockHint>
          Items stay restorable for seven days. After that they are removed, but order history is
          kept.
        </MockHint>
      </div>
    </>
  );
}

export function PricingScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Pricing" />
      <div className="tour-screen-body">
        <MockGroup title="Your prices">
          <MockCard>
            <MockField
              label="Basmati rice 5 kg"
              value="₹520"
              mono
              target="price-input"
              active={is(activeTarget, "price-input")}
            />
            <MockField label="Toor dal 1 kg" value="₹145" mono />
            <MockField label="Sunflower oil 1 L" value="₹138" mono />
          </MockCard>
        </MockGroup>
        <MockButton block>Save price</MockButton>
        <MockHint>
          A price change applies to that product only and is visible to shoppers once saved.
        </MockHint>
      </div>
    </>
  );
}

export function InventoryScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Inventory" />
      <div className="tour-screen-body">
        <MockGroup title="Stock">
          <MockCard>
            <MockField
              label="Basmati rice 5 kg"
              value="24 in stock"
              target="stock-qty"
              active={is(activeTarget, "stock-qty")}
            />
            <MockField label="Restock ETA" value="2 days" />
          </MockCard>
        </MockGroup>
        <MockGroup title="Add-ons" muted>
          <MockCard>
            <MockRow
              icon={<HiOutlinePlus />}
              title="Your add-ons"
              subtitle="Draft and live extras"
            />
          </MockCard>
        </MockGroup>
        <MockHint>Quantity and ETA are what customers see at checkout.</MockHint>
      </div>
    </>
  );
}

export function MenusScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Menu · Food" />
      <div className="tour-screen-body">
        <MockGroup title="Dishes">
          <MockCard>
            <MockRow
              icon={<HiOutlineFire />}
              title="Chicken biryani"
              subtitle="₹180 · Active"
              target="menu-dish"
              active={is(activeTarget, "menu-dish")}
            />
            <MockRow icon={<HiOutlineFire />} title="Veg meals" subtitle="₹120 · Active" muted />
          </MockCard>
        </MockGroup>
        <MockGroup title="Price and MRP">
          <MockCard>
            <MockField
              label="Selling price"
              value="₹180"
              mono
              target="menu-price"
              active={is(activeTarget, "menu-price")}
            />
            <MockField label="MRP (optional)" value="₹210" mono />
          </MockCard>
        </MockGroup>
        <MockButton block>Save dish</MockButton>
      </div>
    </>
  );
}

export function OffersScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Offers" />
      <div className="tour-screen-body">
        <MockGroup title="Campaign">
          <MockCard>
            <MockRow
              icon={<HiOutlineSparkles />}
              title="Pongal festival"
              subtitle="LIVE · cap 25%"
              target="offer-campaign"
              active={is(activeTarget, "offer-campaign")}
            />
          </MockCard>
        </MockGroup>
        <MockGroup title="Your products">
          <MockCard>
            <MockField
              label="Basmati rice 5 kg · ₹520"
              value="15% off → ₹442"
              target="offer-percent"
              active={is(activeTarget, "offer-percent")}
            />
          </MockCard>
        </MockGroup>
        <MockButton block target="offer-optin" active={is(activeTarget, "offer-optin")}>
          Opt in
        </MockButton>
        <MockHint>
          Opting in returns to Pending until a district admin approves the discount.
        </MockHint>
      </div>
    </>
  );
}

export function AddonsScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Add-ons" />
      <div className="tour-screen-body">
        <MockGroup title="Your add-ons">
          <MockCard>
            <MockRow icon={<HiOutlineCube />} title="Extra raita" subtitle="₹30 · Draft" />
          </MockCard>
        </MockGroup>
        <MockButton
          variant="outline"
          block
          target="addon-create"
          active={is(activeTarget, "addon-create")}
        >
          <HiOutlinePlus aria-hidden="true" /> Create add-on
        </MockButton>
        <MockGroup title="Link to a dish">
          <MockCard>
            <MockRow
              icon={<HiOutlineFire />}
              title="Chicken biryani"
              subtitle="2 add-ons linked"
              target="addon-link"
              active={is(activeTarget, "addon-link")}
            />
          </MockCard>
        </MockGroup>
        <MockButton block target="addon-submit" active={is(activeTarget, "addon-submit")}>
          Submit for review
        </MockButton>
      </div>
    </>
  );
}

export function OrdersBoardScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Orders" />
      <div className="tour-screen-body">
        <MockChips
          items={[{ label: "New", on: true }, { label: "Packed" }, { label: "Shipped" }]}
        />
        <MockGroup title="Waiting">
          <MockCard>
            <MockRow
              icon={<HiOutlineInbox />}
              title="New order · ₹640"
              subtitle="Paid · 2 items"
              target="order-row"
              active={is(activeTarget, "order-row")}
            />
          </MockCard>
        </MockGroup>
        <MockGroup title="Today">
          <MockCard>
            <MockRow
              icon={<HiOutlineTruck />}
              title="A. Kumar · 3 items"
              subtitle="Paid · awaiting accept"
              target="order-card"
              active={is(activeTarget, "order-card")}
            />
            <MockRow
              icon={<HiOutlineCheckCircle />}
              title="M. Devi · 1 item"
              subtitle="Packed · rider assigned"
              muted
            />
          </MockCard>
        </MockGroup>
      </div>
    </>
  );
}

export function OrdersDetailScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Order #1042" back />
      <div className="tour-screen-body">
        <MockGroup title="Items">
          <MockCard>
            <MockField label="Chicken biryani × 2" value="₹360" mono />
            <MockField label="Extra raita × 1" value="₹30" mono />
            <MockField label="Delivery" value="₹40" mono />
          </MockCard>
        </MockGroup>
        <MockGroup title="Status">
          <MockCard>
            <MockSteps
              items={["Packed", "Shipped", "Delivered"]}
              activeIndex={0}
              target="order-status"
              active={is(activeTarget, "order-status")}
            />
          </MockCard>
        </MockGroup>
        <MockButton block target="order-accept" active={is(activeTarget, "order-accept")}>
          Accept order
        </MockButton>
        <MockButton
          variant="outline"
          block
          target="order-reject"
          active={is(activeTarget, "order-reject")}
        >
          Reject order
        </MockButton>
        <MockHint>Packing is blocked until the payment reads Paid.</MockHint>
      </div>
    </>
  );
}

export function PickupQrScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Pickup" back />
      <div className="tour-screen-body">
        <MockGroup title="Order #1042 · Packed">
          <MockCard>
            <MockRow
              icon={<HiOutlineQrCode />}
              title="Show pickup QR"
              subtitle="Rider scans at handover"
              target="pickup-qr"
              active={is(activeTarget, "pickup-qr")}
              chevron={false}
            />
          </MockCard>
        </MockGroup>
        <MockQR target="qr-code" active={is(activeTarget, "qr-code")} />
        <MockHint>The code is short-lived (2 hours) and is never stored.</MockHint>
      </div>
    </>
  );
}

export function NotificationsScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Notifications" />
      <div className="tour-screen-body">
        <MockCard>
          <MockRow
            icon={<HiOutlineBell />}
            title="3 unread"
            subtitle="Newest first"
            target="notif-bell"
            active={is(activeTarget, "notif-bell")}
            chevron={false}
          />
        </MockCard>
        <MockGroup title="Inbox">
          <MockCard>
            <MockRow
              icon={<HiOutlineInbox />}
              title="New order #1042"
              subtitle="Just now · unread"
              target="notif-row"
              active={is(activeTarget, "notif-row")}
            />
            <MockRow
              icon={<HiOutlineCheckCircle />}
              title="Product approved"
              subtitle="2 hours ago"
              target="notif-deeplink"
              active={is(activeTarget, "notif-deeplink")}
            />
            <MockRow icon={<HiOutlineTruck />} title="SLA reminder" subtitle="Yesterday" muted />
          </MockCard>
        </MockGroup>
        <MockButton
          variant="outline"
          block
          target="notif-readall"
          active={is(activeTarget, "notif-readall")}
        >
          Mark all read
        </MockButton>
      </div>
    </>
  );
}

export function PayoutsScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Payments" />
      <div className="tour-screen-body">
        <MockGroup title="This cycle">
          <MockCard>
            <MockRow
              icon={<HiOutlineWallet />}
              title="Cycle 12–18 Nov"
              subtitle="Net payable ₹18,420"
              target="payout-cycle"
              active={is(activeTarget, "payout-cycle")}
            />
          </MockCard>
        </MockGroup>
        <MockGroup title="Ledger">
          <MockCard>
            <MockField
              label="Delivered orders"
              value="42 orders · ₹18,420"
              target="payout-ledger"
              active={is(activeTarget, "payout-ledger")}
            />
            <MockRow
              icon={<HiOutlineDocumentText />}
              title="Invoice INV-2041"
              subtitle="Seller-scoped JSON"
              target="payout-invoice"
              active={is(activeTarget, "payout-invoice")}
              chevron={false}
            />
            <MockRow
              icon={<HiOutlineBanknotes />}
              title="Paid by bank transfer"
              subtitle="Marked by an admin"
              target="payout-status"
              active={is(activeTarget, "payout-status")}
              chevron={false}
            />
          </MockCard>
        </MockGroup>
        <MockHint>Payouts are manual today — there is no automatic transfer.</MockHint>
      </div>
    </>
  );
}

export function SettingsScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Settings" />
      <div className="tour-screen-body">
        <MockGroup title="Seller settings">
          <MockCard>
            <MockRow
              icon={<HiOutlineUserGroup />}
              title="Profile"
              subtitle="Business and contact details"
              target="settings-profile"
              active={is(activeTarget, "settings-profile")}
            />
            <MockRow
              icon={<HiOutlineCreditCard />}
              title="Bank account"
              subtitle="Masked payout account"
              target="settings-bank"
              active={is(activeTarget, "settings-bank")}
            />
            <MockRow
              icon={<HiOutlineBell />}
              title="Notifications"
              subtitle="Order and SLA alerts"
              target="settings-notify"
              active={is(activeTarget, "settings-notify")}
            />
            <MockRow
              icon={<HiOutlineBolt />}
              title="Appearance"
              subtitle="Light or dark"
              target="settings-theme"
              active={is(activeTarget, "settings-theme")}
            />
            <MockRow
              icon={<HiOutlineUsers />}
              title="Sub-users"
              subtitle="Staff and Viewer logins"
              target="settings-subusers"
              active={is(activeTarget, "settings-subusers")}
            />
            <MockRow
              icon={<HiOutlineCog6Tooth />}
              title="Security"
              subtitle="Sign-in email and password"
              target="settings-security"
              active={is(activeTarget, "settings-security")}
            />
          </MockCard>
        </MockGroup>
        <MockButton block target="profile-save" active={is(activeTarget, "profile-save")}>
          Save changed fields
        </MockButton>
        <MockGroup title="Team invite">
          <MockCard>
            <MockRow
              icon={<HiOutlineLink />}
              title="Copy invite link"
              subtitle="/accept-invite?token=… · 7 days"
              target="invite-link"
              active={is(activeTarget, "invite-link")}
              chevron={false}
            />
          </MockCard>
        </MockGroup>
      </div>
    </>
  );
}

export function ReturnsScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Returns" />
      <div className="tour-screen-body">
        <MockGroup title="Requests">
          <MockCard>
            <MockRow
              icon={<HiOutlineArrowPath />}
              title="Order #1039 · return requested"
              subtitle="1 item · refund pending"
              target="return-row"
              active={is(activeTarget, "return-row")}
            />
            <MockRow
              icon={<HiOutlineCheckCircle />}
              title="Order #1012 · completed"
              subtitle="Refunded"
              muted
            />
          </MockCard>
        </MockGroup>
        <MockButton variant="outline" block>
          Advance return
        </MockButton>
        <MockHint>Returns and cancellations advance with the order status.</MockHint>
      </div>
    </>
  );
}

export function AdsScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Ads" />
      <div className="tour-screen-body">
        <MockGroup title="Campaigns">
          <MockCard>
            <MockRow
              icon={<HiOutlineMegaphone />}
              title="Weekend boost · Mart"
              subtitle="ACTIVE · slot on Home"
              target="ad-campaign"
              active={is(activeTarget, "ad-campaign")}
            />
          </MockCard>
        </MockGroup>
        <MockGroup title="Budget">
          <MockCard>
            <MockField label="Daily budget" value="₹300" mono />
            <MockField label="Runs" value="Fri – Sun" />
          </MockCard>
        </MockGroup>
        <MockButton block>Launch campaign</MockButton>
        <MockHint>Ads are slot-based placements in the app; there is no tracking pixel.</MockHint>
      </div>
    </>
  );
}

export function AnalyticsScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Analytics" />
      <div className="tour-screen-body">
        <MockGroup title="Last 7 days">
          <MockCard>
            <MockStat label="Orders" value="128" />
            <MockStat label="Sales" value="₹42,180" />
          </MockCard>
        </MockGroup>
        <MockGroup title="Daily orders">
          <MockCard>
            <MockBars
              values={[38, 52, 46, 64, 58, 81, 72]}
              target="analytics-series"
              active={is(activeTarget, "analytics-series")}
            />
          </MockCard>
        </MockGroup>
        <MockHint>Charts read the gateway's analytics series for the range you pick.</MockHint>
      </div>
    </>
  );
}

export function ReviewsScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Reviews" />
      <div className="tour-screen-body">
        <MockGroup title="Recent">
          <MockCard>
            <MockRow
              icon={<HiOutlineStar />}
              title="4★ · Packed well"
              subtitle="Order #1039 · 2 days ago"
              target="review-row"
              active={is(activeTarget, "review-row")}
            />
            <MockRow icon={<HiOutlineStar />} title="5★ · Fresh stock" subtitle="Yesterday" muted />
            <MockRow
              icon={<HiOutlineStar />}
              title="3★ · Late pickup"
              subtitle="3 days ago"
              muted
            />
          </MockCard>
        </MockGroup>
        <MockHint>Reviews are read-only in the console today.</MockHint>
      </div>
    </>
  );
}

export function PrescriptionsScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Prescriptions" />
      <div className="tour-screen-body">
        <MockGroup title="New requests">
          <MockCard>
            <MockRow
              icon={<HiOutlineDocumentText />}
              title="Rx #882 · 3 items"
              subtitle="Awaiting your quote"
              target="rx-row"
              active={is(activeTarget, "rx-row")}
            />
            <MockRow
              icon={<HiOutlineDocumentText />}
              title="Rx #879 · 1 item"
              subtitle="Quoted"
              muted
            />
          </MockCard>
        </MockGroup>
        <MockButton block>Send quote</MockButton>
        <MockHint>Pharmacy stores only. Prescription details never appear in logs.</MockHint>
      </div>
    </>
  );
}

export function ExploreScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Explore" />
      <div className="tour-screen-body">
        <MockGroup title="All surfaces">
          <MockCard>
            <MockRow
              icon={<HiOutlineInbox />}
              title="Orders"
              subtitle="Take and fulfil"
              target="explore-grid"
              active={is(activeTarget, "explore-grid")}
            />
            <MockRow icon={<HiOutlineCube />} title="Products" subtitle="Add and maintain" />
            <MockRow icon={<HiOutlineMegaphone />} title="Ads" subtitle="Campaigns" muted />
            <MockRow
              icon={<HiOutlineWallet />}
              title="Payments"
              subtitle="Ledger and invoices"
              muted
            />
            <MockRow icon={<HiOutlineLifebuoy />} title="Support" subtitle="Local today" muted />
          </MockCard>
        </MockGroup>
        <MockHint>Explore is the map of the console — every surface is one tap away.</MockHint>
      </div>
    </>
  );
}

export function HubScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Home" />
      <div className="tour-screen-body">
        <MockGroup title="Today">
          <MockCard>
            <MockRow
              icon={<HiOutlineClipboardDocumentCheck />}
              title="3 tasks for today"
              subtitle="Checklist · local only"
              target="hub-checklist"
              active={is(activeTarget, "hub-checklist")}
              chevron={false}
            />
          </MockCard>
        </MockGroup>
        <MockGroup title="Sales">
          <MockCard>
            <MockStat label="Orders today" value="14" />
            <MockStat label="Sales today" value="₹4,260" />
          </MockCard>
        </MockGroup>
        <MockHint>The hub checklist is not saved to your account yet.</MockHint>
      </div>
    </>
  );
}

export function OutletInfoScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Outlet info" />
      <div className="tour-screen-body">
        <MockGroup title="Hours">
          <MockCard>
            <MockField
              label="Opening hours"
              value="Mon – Sun · 8:00 – 22:00"
              target="outlet-hours"
              active={is(activeTarget, "outlet-hours")}
            />
            <MockField label="Phone" value="+91 98436 31722" />
          </MockCard>
        </MockGroup>
        <MockGroup title="Location">
          <MockCard>
            <MockRow icon={<HiOutlineMapPin />} title="12 Bharathiar Road" subtitle="Karaikal" />
          </MockCard>
        </MockGroup>
        <MockHint>Keep hours current so customers know when you are open.</MockHint>
      </div>
    </>
  );
}

export function RestaurantStatusScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Restaurant status" />
      <div className="tour-screen-body">
        <MockGroup title="Service">
          <MockCard>
            <MockToggle
              label="Accepting orders"
              on
              target="status-toggle"
              active={is(activeTarget, "status-toggle")}
            />
          </MockCard>
        </MockGroup>
        <MockGroup title="Estimated prep">
          <MockCard>
            <MockField label="Prep time" value="25 minutes" />
          </MockCard>
        </MockGroup>
        <MockHint>
          Client-only today: this switch is not saved to your account, so it resets when you reload.
        </MockHint>
      </div>
    </>
  );
}

export function RushHourScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Rush hour" />
      <div className="tour-screen-body">
        <MockGroup title="Prep window">
          <MockCard>
            <MockField
              label="Busiest hours"
              value="18:00 – 21:00"
              target="rush-window"
              active={is(activeTarget, "rush-window")}
            />
          </MockCard>
        </MockGroup>
        <MockGroup title="Kitchen">
          <MockCard>
            <MockField label="Extra prep" value="+10 minutes" />
          </MockCard>
        </MockGroup>
        <MockHint>
          Client-only today: this window is not saved to your account, so it resets when you reload.
        </MockHint>
      </div>
    </>
  );
}

export function SupportScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Support" />
      <div className="tour-screen-body">
        <MockGroup title="Tickets">
          <MockCard>
            <MockRow
              icon={<HiOutlineLifebuoy />}
              title="New ticket"
              subtitle="Tell Faazio what went wrong"
              target="support-new"
              active={is(activeTarget, "support-new")}
            />
            <MockRow
              icon={<HiOutlineLifebuoy />}
              title="Payout question"
              subtitle="Local · earlier"
              muted
            />
          </MockCard>
        </MockGroup>
        <MockHint>
          Tickets stay on this device in this release — they are not sent to Faazio yet.
        </MockHint>
      </div>
    </>
  );
}

export function InviteAcceptScreen({ activeTarget }: ScreenProps) {
  return (
    <>
      <MockAppBar title="Join the team" />
      <div className="tour-screen-body">
        <MockGroup title="Choose a password">
          <MockCard>
            <MockField label="Invite" value="Sharma Mart · Staff" mono />
            <MockField label="Password" value="••••••••••••" mono />
            <MockField label="Confirm password" value="••••••••••••" mono />
          </MockCard>
        </MockGroup>
        <MockButton block target="accept-submit" active={is(activeTarget, "accept-submit")}>
          Activate account
        </MockButton>
        <MockHint>The link is single-use and expires after seven days.</MockHint>
        <MockCheck label="Your own email becomes your sign-in" />
      </div>
    </>
  );
}
