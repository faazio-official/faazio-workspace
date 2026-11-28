"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { SellerCredentialCard } from "@/components/patterns/SellerCredentialCard";
import { maskPan } from "@/components/patterns/SellerIdentityCard";
import { SellerShopCard } from "@/components/patterns/SellerShopCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { sumGmv, sumOrders } from "@/lib/analytics/derive";
import {
  fetchPrivateDocumentUrl,
  fetchSellerDetail,
  getBankAccount,
  listKyc,
  rejectSellerApplication,
  requestSellerDocument,
  setSellerStatus,
  updateSeller,
  upsertBankAccount,
  updateVendorPlatformFee,
  verifySellerDocument,
  verifySellerKyc,
} from "@/lib/api";
import { useAnalyticsSeries, useSeller } from "@/lib/api/hooks";
import type {
  BankAccountInput,
  KycDocument,
  SellerDetail,
  SellerLoginCredential,
  SellerProfilePatch,
} from "@/data/types";

// A GSTIN is 15 chars: 2-digit state code + 10-char PAN + entity no. + 'Z' + check digit.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GSTIN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DOC_TYPES: KycDocument["docType"][] = ["GSTIN", "PAN", "BANK_PROOF", "SHOP_LICENSE", "PASSBOOK", "FSSAI"];

/** Mirrors the gateway's GSTIN mod-36 checksum so the portal accepts exactly what the server does. */
function gstinChecksumValid(gstin: string): boolean {
  if (gstin.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = GSTIN_ALPHABET.indexOf(gstin.charAt(i));
    if (value < 0) return false;
    const product = value * (i % 2 === 1 ? 2 : 1);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return gstin.charAt(14) === GSTIN_ALPHABET.charAt((36 - (sum % 36)) % 36);
}

/** GSTIN is optional (small/unregistered shops); only a non-empty value has to be well-formed. */
function gstinValid(gstin?: string): boolean {
  const value = (gstin ?? "").trim().toUpperCase();
  return value === "" || (GSTIN_RE.test(value) && gstinChecksumValid(value));
}

function SellerReview() {
  const { id } = useParams<{ id: string }>();
  const local = useSeller(id);
  const series = useAnalyticsSeries("seller", id, 30);
  const [detail, setDetail] = useState<SellerDetail | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [credential, setCredential] = useState<SellerLoginCredential | null>(null);
  const [revealed, setRevealed] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      const next = await fetchSellerDetail(id);
      if (next) setDetail(next);
    } catch {
      toast.error("Could not refresh the live review");
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const seller = useMemo<SellerDetail | undefined>(
    () =>
      detail ??
      (local
        ? {
            ...local,
            bankAccount: getBankAccount(local.sellerId),
            kycDocuments: listKyc(local.sellerId),
            verificationLog: [],
            vendors: [],
          }
        : undefined),
    [detail, local],
  );

  if (!seller) {
    return (
      <EmptyState
        title="Seller not found"
        description="This application may have been removed."
        action={
          <Link href="/admin/district/sellers" className="text-[13px] font-medium text-primary">
            Back to sellers
          </Link>
        }
      />
    );
  }

  const docs = seller.kycDocuments ?? [];
  const pendingDocRequests = new Set(
    (seller.documentRequests ?? []).filter((r) => r.status === "PENDING").map((r) => r.docType),
  );
  const missingDocTypes = DOC_TYPES.filter((t) => !docs.some((doc) => doc.docType === t));
  const isInquiry = seller.status === "INQUIRY";

  const verifyDoc = async (doc: KycDocument) => {
    setBusy(true);
    try {
      const next = await verifySellerDocument(seller.sellerId, doc.docType);
      if (next) setDetail(next);
      toast.success(`${doc.docType.replace(/_/g, " ")} verified`);
    } catch {
      toast.error("Could not verify this document");
    } finally {
      setBusy(false);
    }
  };

  const openDoc = async (doc: KycDocument) => {
    try {
      const url = doc.assetId ? await fetchPrivateDocumentUrl(doc.assetId) : doc.fileUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("This document has no downloadable file");
    } catch {
      toast.error("Could not open this document");
    }
  };

  const requestDoc = async (docType: KycDocument["docType"]) => {
    setBusy(true);
    try {
      const next = await requestSellerDocument(seller.sellerId, docType);
      setDetail(next);
      toast.success(`Requested ${docType.replace(/_/g, " ")} re-upload from the seller`);
    } catch {
      toast.error("Could not send the document request");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (patch: SellerProfilePatch) => {
    setBusy(true);
    try {
      await updateSeller(seller.sellerId, patch);
      await loadDetail();
      toast.success("Registered details updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save those details");
    } finally {
      setBusy(false);
    }
  };

  const saveBank = async (input: BankAccountInput) => {
    setBusy(true);
    try {
      await upsertBankAccount(seller.sellerId, input);
      await loadDetail();
      toast.success("Payout account updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the payout account");
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    setBusy(true);
    try {
      const next = await verifySellerKyc(seller.sellerId);
      if (next) {
        setDetail(next);
        if (next.credential) setCredential(next.credential);
      }
      toast.success("KYC verified — seller activated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not activate the seller");
    } finally {
      setBusy(false);
    }
  };

  const suspend = async (why: string) => {
    setBusy(true);
    try {
      await setSellerStatus(seller.sellerId, "SUSPENDED", why);
      toast.success("Seller suspended");
      await loadDetail();
    } catch {
      toast.error("Could not suspend the seller");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (reason.trim().length < 4) return;
    setBusy(true);
    try {
      await rejectSellerApplication(seller.sellerId, reason.trim());
      toast.success("Application rejected");
      await loadDetail();
    } catch {
      toast.error("Could not reject this application");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={seller.shopName || seller.ownerName}
        description={`${seller.ownerName} · ${seller.districtCode ?? seller.stateCode} · applied ${formatDate(seller.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={seller.status} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRevealed((v) => !v)}
              aria-pressed={revealed}
            >
              {revealed ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
              {revealed ? "Hide sensitive details" : "Show hidden details"}
            </Button>
          </div>
        }
      />

      <KpiStrip
        items={[
          { label: "GMV (30d)", value: formatINR(sumGmv(series), { compact: true }) },
          { label: "Orders (30d)", value: formatNumber(sumOrders(series)) },
          { label: "Vendors", value: String(Math.min(seller.vendors?.length ?? 0, 1)) },
          {
            label: "KYC",
            value:
              docs.length === 0 ? "No docs" : docs.every((d) => d.verified) ? "Verified" : "In review",
          },
        ]}
      />

      {isInquiry ? (
        <SectionCard
          title="This is a web enquiry, not an application yet"
          description="The merchant has not submitted KYC. Work the call-back from Seller enquiries; the record becomes an application when they apply in the app."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/district/seller-inquiries">Open the enquiry queue</Link>
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void approve()}>
              Verify KYC &amp; activate
            </Button>
            <span className="text-[12px] text-muted-foreground">
              Activation is refused while no KYC exists — ask the merchant to finish onboarding first.
            </span>
          </div>
        </SectionCard>
      ) : null}

      <BusinessAccountForm
        seller={seller}
        revealed={revealed}
        busy={busy}
        onSave={saveProfile}
        onSaveFee={async (storeId, pct) => {
          setBusy(true);
          try {
            await updateVendorPlatformFee(seller.sellerId, storeId, pct);
            toast.success(`Platform fee set to ${pct}%`);
            await loadDetail();
          } catch {
            toast.error("Could not update the platform fee");
          } finally {
            setBusy(false);
          }
        }}
      />

      <OwnerPanLicenceForm
        seller={seller}
        revealed={revealed}
        busy={busy}
        onSave={saveProfile}
        documents={
          <DocumentsOnFile
            seller={seller}
            docs={docs}
            isInquiry={isInquiry}
            revealed={revealed}
            busy={busy}
            pendingDocRequests={pendingDocRequests}
            missingDocTypes={missingDocTypes}
            onVerify={(doc) => void verifyDoc(doc)}
            onOpen={(doc) => void openDoc(doc)}
            onRequest={(docType) => void requestDoc(docType)}
          />
        }
      />

      <PayoutAccountForm seller={seller} revealed={revealed} busy={busy} onSave={saveBank} />

      {seller.rejectionReason ? (
        <SectionCard title="Last rejection" description="The seller can edit and resubmit.">
          <p className="text-[13px]">{seller.rejectionReason}</p>
        </SectionCard>
      ) : null}

      <SectionCard title="Decision" description="Approval creates the Razorpay Route linked account; every action is audited.">
        {seller.complianceStatus === "FAILED" ? (
          <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
            Activation is blocked by a compliance check: {seller.complianceNote || "checks failed"}. Correct
            the flagged bank or business detail above, then retry — the check re-runs automatically.
          </p>
        ) : null}
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection or suspension"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Button size="sm" disabled={busy || seller.status === "ACTIVE"} onClick={() => void approve()}>
              Verify KYC &amp; activate
            </Button>
            <ComponentHelp id="verify-kyc-button" label="About verifying KYC" />
          </div>
          <div className="flex items-center gap-1.5">
            <ConfirmButton
              label="Reject"
              variant="outline"
              disabled={busy || reason.trim().length < 4}
              description="The seller can re-apply with corrected documents."
              onConfirm={() => void reject()}
            />
            <ComponentHelp id="reject-button" label="About rejecting a seller" />
          </div>
          <ConfirmButton
            label="Suspend"
            variant="destructive"
            disabled={busy || reason.trim().length < 4}
            description="Listings go offline in the consumer app immediately."
            onConfirm={() => void suspend(reason.trim())}
          />
        </div>
      </SectionCard>

      {credential ? (
        <SectionCard
          title="Seller login"
          description="Provisioned automatically on approval. The password is shown once and never stored in the clear."
        >
          <SellerCredentialCard
            credential={credential}
            shopName={seller.shopName}
            phone={seller.contactPhone}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}

/**
 * Step 1 of the merchant's "Sell with us" form, laid out as the app's business-account sheet:
 * the owner, how to reach them, and the one shop (name, category, photo, pin) the account owns.
 */
function BusinessAccountForm({
  seller,
  revealed,
  busy,
  onSave,
  onSaveFee,
}: {
  seller: SellerDetail;
  revealed: boolean;
  busy: boolean;
  onSave: (patch: SellerProfilePatch) => Promise<void>;
  onSaveFee: (storeId: string, pct: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    ownerName: seller.ownerName,
    contactPhone: seller.contactPhone,
    businessAddress: seller.businessAddress,
  });

  useEffect(() => {
    setDraft({
      ownerName: seller.ownerName,
      contactPhone: seller.contactPhone,
      businessAddress: seller.businessAddress,
    });
  }, [seller]);

  const save = async () => {
    try {
      await onSave({
        ownerName: draft.ownerName,
        contactPhone: draft.contactPhone,
        businessAddress: draft.businessAddress,
      });
      setEditing(false);
    } catch {
      // The parent already surfaced the error; keep the form open for correction.
    }
  };

  return (
    <SectionCard
      title="1 · Business account"
      description="What the merchant enters in the first form of Sell with us. Corrections here change the KYC-bearing owner record; an address change re-enters review."
      actions={
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Edit"}
        </Button>
      }
    >
      {editing ? (
        <div className="space-y-3">
          <Field label="Owner name">
            <Input
              value={draft.ownerName}
              onChange={(e) => setDraft((d) => ({ ...d, ownerName: e.target.value }))}
            />
          </Field>
          <Field label="Owner number">
            <Input
              className="num"
              inputMode="numeric"
              value={draft.contactPhone}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contactPhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
              }
            />
          </Field>
          <Field label="Shop address">
            <Textarea
              rows={2}
              value={draft.businessAddress}
              onChange={(e) => setDraft((d) => ({ ...d, businessAddress: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              Save business account
            </Button>
          </div>
        </div>
      ) : (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fact label="Owner name" value={seller.ownerName} />
          <Fact label="Owner number" value={seller.contactPhone} mono />
          <Fact
            label="Contact email"
            value={revealed ? seller.contactEmail : maskEmail(seller.contactEmail)}
          />
          <Fact label="Shop name" value={seller.shopName} />
          <Fact label="Shop address" value={seller.businessAddress} className="sm:col-span-2" />
          <Fact
            label="OTP verified"
            value={
              seller.otpVerified
                ? seller.otpVerifiedAt
                  ? `Yes, ${formatDate(seller.otpVerifiedAt)}`
                  : "Yes"
                : "No"
            }
          />
          <Fact
            label="Terms accepted"
            value={seller.termsAcceptedAt ? formatDate(seller.termsAcceptedAt) : undefined}
          />
        </dl>
      )}

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          The one shop on this account
        </p>
        {(seller.vendors ?? []).length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No shop attached to this account yet.</p>
        ) : (
          (seller.vendors ?? []).map((vendor) => (
            <SellerShopCard
              key={vendor.storeId}
              vendor={vendor}
              busy={busy}
              onSave={(pct) => onSaveFee(vendor.storeId, pct)}
            />
          ))
        )}
      </div>
    </SectionCard>
  );
}

/** Step 2 of the app form, first sheet: the owner's PAN, the category licence and the KYC files. */
function OwnerPanLicenceForm({
  seller,
  revealed,
  busy,
  onSave,
  documents,
}: {
  seller: SellerDetail;
  revealed: boolean;
  busy: boolean;
  onSave: (patch: SellerProfilePatch) => Promise<void>;
  documents: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ pan: seller.pan, gstin: seller.gstin ?? "" });

  useEffect(() => {
    setDraft({ pan: seller.pan, gstin: seller.gstin ?? "" });
  }, [seller]);

  const vendor = seller.vendors?.[0];
  const licence =
    vendor?.app === "PHARMA"
      ? { label: "Drug licence", number: vendor.drugLicenseNumber }
      : vendor?.app === "FOOD"
        ? { label: "FSSAI licence", number: vendor.fssaiNumber }
        : { label: "Shop registration certificate", number: vendor?.fssaiNumber };
  const gstinOk = gstinValid(draft.gstin);

  const save = async () => {
    if (!gstinOk) {
      toast.error("Enter a valid 15-character GSTIN (e.g. 27AAPFU0939F1ZV), or leave it blank.");
      return;
    }
    try {
      await onSave({ pan: draft.pan.toUpperCase(), gstin: draft.gstin.toUpperCase() });
      setEditing(false);
    } catch {
      // The parent already surfaced the error; keep the form open for correction.
    }
  };

  return (
    <SectionCard
      title="2 · Owner PAN & licence"
      description="The second form of Sell with us: the owner's PAN, the licence that fits the category, and the documents uploaded with them."
      actions={
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Edit"}
        </Button>
      }
    >
      {editing ? (
        <div className="space-y-3">
          <Field label="Owner PAN number">
            <Input
              className="num"
              maxLength={10}
              value={draft.pan}
              onChange={(e) => setDraft((d) => ({ ...d, pan: e.target.value.toUpperCase() }))}
            />
          </Field>
          <Field label="GSTIN">
            <Input
              className="num"
              maxLength={15}
              placeholder="e.g. 27AAPFU0939F1ZV (optional)"
              value={draft.gstin}
              onChange={(e) => setDraft((d) => ({ ...d, gstin: e.target.value.toUpperCase() }))}
            />
            {!gstinOk ? (
              <p className="mt-1 text-[11px] text-destructive">
                Not a valid GSTIN (15 characters, e.g. 27AAPFU0939F1ZV). Leave blank if unregistered.
              </p>
            ) : null}
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              Save PAN &amp; licence
            </Button>
          </div>
        </div>
      ) : (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fact label="Owner PAN number" value={maskPan(seller.pan, revealed)} mono />
          <Fact label="GSTIN" value={seller.gstin} mono />
          <Fact label={licence.label} value={licence.number} mono />
          <Fact label="Contract tier" value={seller.contractTier} />
        </dl>
      )}

      <div className="mt-4 border-t border-border pt-4">{documents}</div>
    </SectionCard>
  );
}

/** Step 2 of the app form, second sheet: the bank account the shop is paid into. */
function PayoutAccountForm({
  seller,
  revealed,
  busy,
  onSave,
}: {
  seller: SellerDetail;
  revealed: boolean;
  busy: boolean;
  onSave: (input: BankAccountInput) => Promise<void>;
}) {
  const bank = seller.bankAccount;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    bankName: bank?.bankName ?? "",
    ifsc: bank?.ifsc ?? "",
    beneficiaryName: bank?.beneficiaryName ?? "",
  });

  useEffect(() => {
    setDraft({
      bankName: bank?.bankName ?? "",
      ifsc: bank?.ifsc ?? "",
      beneficiaryName: bank?.beneficiaryName ?? "",
    });
  }, [bank]);

  if (!bank) {
    return (
      <SectionCard
        title="2 · Payout account"
        description="The bank account the shop's payouts settle into."
      >
        <p className="text-[13px] text-muted-foreground">
          No payout account on record. The merchant adds it in the app; verification is refused until one exists.
        </p>
      </SectionCard>
    );
  }

  const ifscOk = IFSC_RE.test(draft.ifsc.trim().toUpperCase());

  const save = async () => {
    if (!ifscOk) {
      toast.error("Enter a valid 11-character IFSC (e.g. HDFC0001234).");
      return;
    }
    try {
      await onSave({
        bankName: draft.bankName.trim(),
        accountNumber: bank.accountNumberMasked,
        ifsc: draft.ifsc.trim().toUpperCase(),
        beneficiaryName: draft.beneficiaryName.trim(),
      });
      setEditing(false);
    } catch {
      // The parent already surfaced the error; keep the form open for correction.
    }
  };

  return (
    <SectionCard
      title="2 · Payout account"
      description="The bank account the shop's payouts settle into. A corrected IFSC clears a compliance block on save."
      actions={
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Edit"}
        </Button>
      }
    >
      {editing ? (
        <div className="space-y-3">
          <Field label="Beneficiary name">
            <Input
              value={draft.beneficiaryName}
              onChange={(e) => setDraft((d) => ({ ...d, beneficiaryName: e.target.value }))}
            />
          </Field>
          <Field label="Bank name">
            <Input
              value={draft.bankName}
              onChange={(e) => setDraft((d) => ({ ...d, bankName: e.target.value }))}
            />
          </Field>
          <Field label="IFSC">
            <Input
              className="num"
              maxLength={11}
              placeholder="e.g. HDFC0001234"
              value={draft.ifsc}
              onChange={(e) => setDraft((d) => ({ ...d, ifsc: e.target.value.toUpperCase() }))}
            />
            {!ifscOk ? (
              <p className="mt-1 text-[11px] text-destructive">
                Not a valid IFSC format (4 letters, 0, then 6 alphanumerics), e.g. HDFC0001234.
              </p>
            ) : null}
          </Field>
          <p className="text-[11px] text-muted-foreground">
            Account {bank.accountNumberMasked} stays masked; only the beneficiary, bank and IFSC are editable.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              Save payout account
            </Button>
          </div>
        </div>
      ) : (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fact label="Beneficiary name" value={bank.beneficiaryName} />
          <Fact label="Bank name" value={bank.bankName} />
          <Fact label="Account number" value={bank.accountNumberMasked} mono />
          <Fact label="IFSC" value={bank.ifsc} mono />
        </dl>
      )}
    </SectionCard>
  );
}

/** The KYC files that sit beside the PAN, licence and passbook in the app's second form. */
function DocumentsOnFile({
  seller,
  docs,
  isInquiry,
  revealed,
  busy,
  pendingDocRequests,
  missingDocTypes,
  onVerify,
  onOpen,
  onRequest,
}: {
  seller: SellerDetail;
  docs: KycDocument[];
  isInquiry: boolean;
  revealed: boolean;
  busy: boolean;
  pendingDocRequests: Set<KycDocument["docType"]>;
  missingDocTypes: KycDocument["docType"][];
  onVerify: (doc: KycDocument) => void;
  onOpen: (doc: KycDocument) => void;
  onRequest: (docType: KycDocument["docType"]) => void;
}) {
  if (isInquiry) {
    return (
      <p className="text-[13px] text-muted-foreground">
        An enquiry has no KYC documents. They are uploaded by the merchant in the app.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Documents on file
        </p>
        <ComponentHelp id="doc-row" label="About KYC documents" />
      </div>
      <p className="text-[12px] text-muted-foreground">
        Passbook is mandatory; FSSAI and drug licences are optional and verified during review.
      </p>
      {docs.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc.kycId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <div>
                <p className="text-[13px] font-medium">{doc.docType.replace(/_/g, " ")}</p>
                <p className="num text-[11px] text-muted-foreground">
                  {revealed
                    ? (doc.assetId ?? doc.fileKey ?? doc.fileUrl ?? "No file reference")
                    : doc.assetId
                      ? `…${doc.assetId.slice(-6)}`
                      : "file on record"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={doc.verified ? "VERIFIED" : "PENDING"} />
                <Button size="sm" variant="outline" onClick={() => onOpen(doc)}>
                  View
                </Button>
                {!doc.verified ? (
                  <Button size="sm" disabled={busy} onClick={() => onVerify(doc)}>
                    Verify
                  </Button>
                ) : null}
                <RequestDocButton
                  busy={busy}
                  requested={pendingDocRequests.has(doc.docType)}
                  onRequest={() => onRequest(doc.docType)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {missingDocTypes.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Request a missing document
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {missingDocTypes.map((docType) => (
              <div
                key={docType}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-[13px] font-medium">{docType.replace(/_/g, " ")}</span>
                <RequestDocButton
                  busy={busy}
                  requested={pendingDocRequests.has(docType)}
                  onRequest={() => onRequest(docType)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {seller.inquiryAssignedTo ? (
        <p className="text-[12px] text-muted-foreground">
          Enquiry owner: <span className="font-medium text-foreground">{seller.inquiryAssignedTo}</span>
        </p>
      ) : null}
    </div>
  );
}

function RequestDocButton({
  busy,
  requested,
  onRequest,
}: {
  busy: boolean;
  requested: boolean;
  onRequest: () => void;
}) {
  if (requested) {
    return <span className="text-[11px] font-medium text-muted-foreground">Requested</span>;
  }
  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={onRequest}>
      Request
    </Button>
  );
}

/** A labelled fact inside a form: the field label above its value, as the app's sheets render it. */
function Fact({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value?: string | undefined;
  mono?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={["min-w-0", className].filter(Boolean).join(" ")}>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd
        className={[
          "mt-0.5 text-[14px] leading-5",
          mono ? "num" : "",
          value ? "text-foreground" : "text-muted-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value || "Not provided"}
      </dd>
    </div>
  );
}

/** The contact email is only needed in full once the admin has confirmed identity. */
function maskEmail(email?: string): string {
  if (!email) return "";
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${"•".repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[12px] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ConfirmButton({
  label,
  description,
  onConfirm,
  variant,
  disabled,
}: {
  label: string;
  description: string;
  onConfirm: () => void;
  variant: "outline" | "destructive";
  disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={variant} disabled={disabled}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label} this seller?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default SellerReview;
