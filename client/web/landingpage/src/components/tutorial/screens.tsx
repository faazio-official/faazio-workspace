import {
  HiOutlineBanknotes,
  HiOutlineBuildingStorefront,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineHeart,
  HiOutlineLockClosed,
  HiOutlineMapPin,
  HiOutlineShoppingBag,
  HiOutlineTag,
  HiOutlineUser,
} from "react-icons/hi2";
import {
  MockAppBar,
  MockButton,
  MockCard,
  MockCheck,
  MockChips,
  MockField,
  MockGroup,
  MockHint,
  MockRow,
} from "./mock";

export type ScreenProps = { activeTarget: string };

/**
 * The customer app's My Account menu. Labels come from
 * `data/account/accountNav.ts`; every row except the target stays muted so the
 * eye lands on "Sell with us" without blanking the list.
 */
export function AccountScreen({ activeTarget }: ScreenProps) {
  const active = activeTarget === "sell-with-us";
  return (
    <>
      <MockAppBar title="My Account" />
      <div className="tour-screen-body">
        <MockGroup title="Profile settings" muted>
          <MockCard>
            <MockRow
              icon={<HiOutlineShoppingBag />}
              title="My Orders"
              subtitle="Track and manage your orders"
              muted
            />
            <MockRow
              icon={<HiOutlineUser />}
              title="My Profile"
              subtitle="Manage your personal information"
              muted
            />
            <MockRow
              icon={<HiOutlineMapPin />}
              title="Addresses"
              subtitle="Manage saved addresses"
              muted
            />
            <MockRow
              icon={<HiOutlineHeart />}
              title="Favourites"
              subtitle="Your favourite items across all apps"
              muted
            />
          </MockCard>
        </MockGroup>

        <MockGroup title="Earn with us">
          <MockCard>
            <MockRow
              icon={<HiOutlineBuildingStorefront />}
              title="Sell with us"
              subtitle="Partner with Faazio & list your products"
              target="sell-with-us"
              active={active}
            />
          </MockCard>
        </MockGroup>

        <MockGroup title="Terms and policies" muted>
          <MockCard>
            <MockRow icon={<HiOutlineDocumentText />} title="Terms & Conditions" muted />
            <MockRow icon={<HiOutlineLockClosed />} title="Privacy Policy" muted />
          </MockCard>
        </MockGroup>
      </div>
    </>
  );
}

export function BusinessScreen({ activeTarget }: ScreenProps) {
  const active = activeTarget === "business-name";
  return (
    <>
      <MockAppBar title="Sell with us" back />
      <div className="tour-screen-body">
        <MockGroup title="Business account">
          <MockCard>
            <MockField
              label="Business name"
              value="Sharma Traders"
              target="business-name"
              active={active}
            />
            <MockField label="Owner / contact name" value="A. Sharma" />
            <MockField label="PAN" value="ABCDE1234F" mono />
            <MockField label="GSTIN (optional)" value="22ABCDE1234F1Z5" mono />
          </MockCard>
        </MockGroup>
        <MockGroup title="Payout account">
          <MockCard>
            <MockField label="Bank" value="HDFC Bank" />
            <MockField label="Account number" value="•••• 4821" mono />
          </MockCard>
        </MockGroup>
        <MockHint>Bank proof and passbook are uploaded before you submit.</MockHint>
      </div>
    </>
  );
}

export function ShopsScreen({ activeTarget }: ScreenProps) {
  const active = activeTarget === "add-shop";
  return (
    <>
      <MockAppBar title="Sell with us" back />
      <div className="tour-screen-body">
        <MockGroup title="Your shops">
          <MockCard>
            <MockRow
              icon={<HiOutlineBuildingStorefront />}
              title="Sharma Traders"
              subtitle="Mart · pending review"
            />
          </MockCard>
        </MockGroup>

        <MockButton variant="outline" block target="add-shop" active={active}>
          Add another shop
        </MockButton>

        <MockGroup title="Shop details">
          <MockCard>
            <MockField label="Shop name" value="Sharma Traders" />
            <div className="tour-field">
              <span className="tour-field-label">Category</span>
              <MockChips
                items={[{ label: "Mart", on: true }, { label: "Food" }, { label: "Pharma" }]}
              />
            </div>
            <MockField label="FSSAI licence" value="12345678901234" mono />
          </MockCard>
        </MockGroup>

        <MockGroup title="Location">
          <MockCard>
            <MockRow
              icon={<HiOutlineMapPin />}
              title="Pin the shop"
              subtitle="Your pin sets the delivery district"
              chevron={false}
            />
          </MockCard>
        </MockGroup>
      </div>
    </>
  );
}

export function ContractScreen({ activeTarget }: ScreenProps) {
  const active = activeTarget === "contract-tier";
  return (
    <>
      <MockAppBar title="Sell with us" back />
      <div className="tour-screen-body">
        <MockGroup title="Contract tier">
          <MockCard>
            <MockRow
              icon={<HiOutlineTag />}
              title="Rate card from Faazio"
              subtitle="Commission and payout terms are set by Faazio"
              target="contract-tier"
              active={active}
            />
          </MockCard>
        </MockGroup>

        <MockGroup title="Agreements">
          <MockCard>
            <MockCheck label="I accept the Terms of Service" />
            <MockCheck label="I accept the Seller / Partner Agreement" />
            <MockCheck label="I grant Faazio the content and IP licence" />
          </MockCard>
        </MockGroup>

        <MockHint>The public Seller &amp; Partner Terms are on faazio.com/seller-terms.</MockHint>
      </div>
    </>
  );
}

export function VerifyScreen({ activeTarget }: ScreenProps) {
  const active = activeTarget === "otp";
  return (
    <>
      <MockAppBar title="Sell with us" back />
      <div className="tour-screen-body">
        <MockGroup title="Verify your phone">
          <MockCard>
            <MockField label="One-time code" value="••••••" mono target="otp" active={active} />
          </MockCard>
          <MockHint>Sent to +91 98436 31722. The code signs the application.</MockHint>
        </MockGroup>

        <MockButton block>Submit for review</MockButton>

        <MockGroup title="Application status">
          <MockCard>
            <MockRow
              icon={<HiOutlineBanknotes />}
              title="Payouts"
              subtitle="Set up after approval"
              chevron={false}
            />
            <MockRow
              icon={<HiOutlineClock />}
              title="Pending review"
              subtitle="A district admin checks your documents"
              chevron={false}
            />
          </MockCard>
        </MockGroup>

        <div className="tour-status">
          <HiOutlineCheckCircle aria-hidden="true" />
          Sent to Faazio
        </div>
      </div>
    </>
  );
}
