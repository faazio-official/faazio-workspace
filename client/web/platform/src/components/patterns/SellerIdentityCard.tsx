import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { SectorPill } from "@/components/patterns/Pills";
import type { SellerDetail } from "@/data/types";

/** PAN is identity-grade PII: hidden behind the reveal toggle, with only the last 4 visible by default. */
export function maskPan(pan: string, revealed: boolean): string {
  if (!pan) return "";
  if (revealed) return pan;
  return pan.length > 4 ? `${"•".repeat(pan.length - 4)}${pan.slice(-4)}` : pan;
}

/** One labelled fact. Values sit at 14px console body size — never squeezed into meta size. */
function Fact({
  label,
  value,
  mono = false,
  wide = false,
  children,
}: {
  label: string;
  value?: string | undefined;
  mono?: boolean | undefined;
  wide?: boolean | undefined;
  children?: React.ReactNode;
}) {
  const text = value?.trim();
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-[14px] leading-5 text-foreground",
          mono && "num",
          !text && !children && "text-muted-foreground",
        )}
      >
        {text ? text : (children ?? "Not provided")}
      </dd>
    </div>
  );
}

function passbookLabel(seller: SellerDetail): string {
  const passbook = (seller.kycDocuments ?? []).find((doc) => doc.docType === "PASSBOOK");
  if (!passbook) return "Not uploaded";
  return passbook.verified ? "Uploaded · verified" : "Uploaded · in review";
}

/**
 * The merchant record at a glance: every business fact the "Sell with us" form asks for, shown at
 * body size instead of buried in a key/value list. Bank data stays masked; PAN honours the page's
 * reveal toggle.
 */
export function SellerIdentityCard({
  seller,
  revealed,
}: {
  seller: SellerDetail;
  revealed: boolean;
}) {
  const bank = seller.bankAccount;
  const vendors = seller.vendors ?? [];
  const hasPin = typeof seller.latitude === "number" && typeof seller.longitude === "number";
  const pinUrl = hasPin
    ? `https://www.google.com/maps/search/?api=1&query=${seller.latitude},${seller.longitude}`
    : null;

  const tier = [
    seller.contractTier,
    seller.rateCardVersion ? `rate card ${seller.rateCardVersion}` : "",
    typeof seller.commissionPct === "number" && seller.commissionPct > 0
      ? `${seller.commissionPct}% commission`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const signature = [
    seller.otpVerified ? "Phone verified" : "Phone not verified",
    seller.termsAcceptedAt ? `terms accepted ${formatDate(seller.termsAcceptedAt)}` : "",
    seller.partnerAgreementAcceptedAt ? "partner agreement accepted" : "",
    seller.ipLicenseGrantedAt ? "content/IP licence granted" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium text-foreground">Merchant record</h2>
          <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
            Owner <span className="font-medium text-foreground">{seller.ownerName}</span>
            {vendors.length > 0 ? (
              <>
                {" · "}
                {vendors.length === 1 ? "1 shop" : `${vendors.length} shops`}:{" "}
                <span className="font-medium text-foreground">
                  {vendors.map((vendor) => vendor.name).join(", ")}
                </span>
              </>
            ) : (
              " · no shop attached yet"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {vendors.map((vendor) => (
            <SectorPill key={vendor.storeId} sector={vendor.app} />
          ))}
          <span className="text-[12px] text-muted-foreground">
            {seller.source === "web" ? "Web enquiry" : "App application"} · applied{" "}
            {formatDate(seller.createdAt)}
          </span>
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Shop name" value={seller.shopName} />
        <Fact label="Owner name" value={seller.ownerName} />
        <Fact label="Owner PAN" value={maskPan(seller.pan, revealed)} mono />
        <Fact
          label="GSTIN"
          value={seller.gstin}
          mono
          {...(seller.gstin ? {} : { children: "Not registered (optional)" })}
        />
        <Fact label="Contact phone" value={seller.contactPhone} mono />
        <Fact label="Contact email" value={seller.contactEmail} />
        <Fact label="Business address" value={seller.businessAddress} wide />
        <Fact
          label="State · district"
          value={[seller.stateCode, seller.districtCode].filter(Boolean).join(" · ")}
        />
        <Fact label="Shop pin">
          {pinUrl ? (
            <a
              href={pinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="num inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {seller.latitude?.toFixed(5)}, {seller.longitude?.toFixed(5)}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : (
            "Not pinned"
          )}
        </Fact>
        <Fact
          label="Payout bank"
          value={
            bank
              ? [bank.bankName, bank.accountNumberMasked, bank.ifsc].filter(Boolean).join(" · ")
              : "Not added"
          }
          mono
        />
        <Fact label="Account holder" value={bank?.beneficiaryName} />
        <Fact label="Bank passbook" value={passbookLabel(seller)} />
        <Fact label="Contract tier" value={tier} />
        <Fact label="Signature & acceptance" value={signature} wide />
        <Fact
          label="Settlement"
          value={seller.settlementTerms}
          wide
          {...(seller.settlementTerms ? {} : { children: "Not on a rate card yet" })}
        />
        <Fact label="Compliance check" value={seller.complianceStatus || "Pending"} />
        {revealed ? <Fact label="Seller ID" value={seller.sellerId} mono /> : null}
      </dl>
    </section>
  );
}
