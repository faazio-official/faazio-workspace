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
import { SellerIdentityCard, maskPan } from "@/components/patterns/SellerIdentityCard";
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
  SellerVendorRecord,
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
  const bank = seller.bankAccount;
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
        title={seller.businessName}
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

      <SellerIdentityCard seller={seller} revealed={revealed} />

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

      <KpiStrip
        items={[
          { label: "GMV (30d)", value: formatINR(sumGmv(series), { compact: true }) },
          { label: "Orders (30d)", value: formatNumber(sumOrders(series)) },
          { label: "Vendors", value: String(seller.vendors?.length ?? 0) },
          {
            label: "KYC",
            value:
              docs.length === 0 ? "No docs" : docs.every((d) => d.verified) ? "Verified" : "In review",
          },
        ]}
      />

      <SectionCard
        title="KYC documents"
        description="Passbook is mandatory; FSSAI and drug licences are optional and verified during review."
        actions={<ComponentHelp id="doc-row" label="About KYC documents" />}
      >
          {isInquiry ? (
            <p className="text-[13px] text-muted-foreground">
              An enquiry has no KYC documents. They are uploaded by the merchant in the app.
            </p>
          ) : (
            <>
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
                            : (doc.assetId ? `…${doc.assetId.slice(-6)}` : "file on record")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill status={doc.verified ? "VERIFIED" : "PENDING"} />
                        <Button size="sm" variant="outline" onClick={() => void openDoc(doc)}>
                          View
                        </Button>
                        {!doc.verified ? (
                          <Button size="sm" disabled={busy} onClick={() => void verifyDoc(doc)}>
                            Verify
                          </Button>
                        ) : null}
                        <RequestDocButton
                          busy={busy}
                          requested={pendingDocRequests.has(doc.docType)}
                          onRequest={() => void requestDoc(doc.docType)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {missingDocTypes.length > 0 ? (
                <div className="mt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Request a missing document
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {missingDocTypes.map((docType) => (
                      <div
                        key={docType}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                      >
                        <span className="text-[13px] font-medium">
                          {docType.replace(/_/g, " ")}
                        </span>
                        <RequestDocButton
                          busy={busy}
                          requested={pendingDocRequests.has(docType)}
                          onRequest={() => void requestDoc(docType)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
      </SectionCard>

      <SectionCard
        title="Vendors"
        description="One account can own several shops. The platform fee and licences are per vendor."
      >
        {(seller.vendors ?? []).length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No vendor attached to this account yet.</p>
        ) : (
          <div className="space-y-3">
            {(seller.vendors ?? []).map((vendor) => (
              <SellerShopCard
                key={vendor.storeId}
                vendor={vendor}
                busy={busy}
                onSave={async (pct) => {
                  setBusy(true);
                  try {
                    await updateVendorPlatformFee(seller.sellerId, vendor.storeId, pct);
                    toast.success(`${vendor.name}: platform fee set to ${pct}%`);
                    await loadDetail();
                  } catch {
                    toast.error("Could not update the platform fee");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {seller.rejectionReason ? (
        <SectionCard title="Last rejection" description="The seller can edit and resubmit.">
          <p className="text-[13px]">{seller.rejectionReason}</p>
        </SectionCard>
      ) : null}

      <RegisteredDetails
        seller={seller}
        busy={busy}
        onSave={saveProfile}
        onSaveBank={saveBank}
      />

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
            businessName={seller.businessName}
            phone={seller.contactPhone}
          />
        </SectionCard>
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
    return (
      <span className="text-[11px] font-medium text-muted-foreground">Requested</span>
    );
  }
  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={onRequest}>
      Request
    </Button>
  );
}

function RegisteredDetails({
  seller,
  busy,
  onSave,
  onSaveBank,
}: {
  seller: SellerDetail;
  busy: boolean;
  onSave: (patch: SellerProfilePatch) => Promise<void>;
  onSaveBank: (input: BankAccountInput) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SellerProfilePatch>({
    businessName: seller.businessName,
    ownerName: seller.ownerName,
    gstin: seller.gstin,
    pan: seller.pan,
    businessAddress: seller.businessAddress,
    contactPhone: seller.contactPhone,
  });
  const bank = seller.bankAccount;
  const [bankDraft, setBankDraft] = useState({
    bankName: bank?.bankName ?? "",
    ifsc: bank?.ifsc ?? "",
    beneficiaryName: bank?.beneficiaryName ?? "",
  });

  useEffect(() => {
    setDraft({
      businessName: seller.businessName,
      ownerName: seller.ownerName,
      gstin: seller.gstin,
      pan: seller.pan,
      businessAddress: seller.businessAddress,
      contactPhone: seller.contactPhone,
    });
    setBankDraft({
      bankName: bank?.bankName ?? "",
      ifsc: bank?.ifsc ?? "",
      beneficiaryName: bank?.beneficiaryName ?? "",
    });
  }, [seller, bank]);

  const gstinOk = gstinValid(draft.gstin);
  const ifscOk = !bank || IFSC_RE.test(bankDraft.ifsc.trim().toUpperCase());
  const bankChanged =
    !!bank &&
    (bankDraft.ifsc.trim().toUpperCase() !== bank.ifsc ||
      bankDraft.bankName.trim() !== (bank.bankName ?? "") ||
      bankDraft.beneficiaryName.trim() !== bank.beneficiaryName);

  return (
    <SectionCard
      title="Correct registered details"
      description="The merchant record above is the read-only summary. Edits here change the KYC-bearing facts; a GSTIN, PAN or address change re-enters review."
      actions={
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Edit"}
        </Button>
      }
    >
      {editing ? (
        <div className="space-y-3">
          <Field label="Business name">
            <Input
              value={draft.businessName ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, businessName: e.target.value }))}
            />
          </Field>
          <Field label="Owner name">
            <Input
              value={draft.ownerName ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, ownerName: e.target.value }))}
            />
          </Field>
          <Field label="GSTIN">
            <Input
              className="num"
              placeholder="e.g. 27AAPFU0939F1ZV (optional)"
              value={draft.gstin ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, gstin: e.target.value.toUpperCase() }))}
            />
            {!gstinOk ? (
              <p className="mt-1 text-[11px] text-destructive">
                Not a valid GSTIN (15 characters, e.g. 27AAPFU0939F1ZV). Leave blank if unregistered.
              </p>
            ) : null}
          </Field>
          <Field label="PAN">
            <Input
              className="num"
              value={draft.pan ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, pan: e.target.value.toUpperCase() }))}
            />
          </Field>
          <Field label="Business address">
            <Textarea
              rows={2}
              value={draft.businessAddress ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, businessAddress: e.target.value }))}
            />
          </Field>
          <Field label="Contact phone">
            <Input
              className="num"
              inputMode="numeric"
              value={draft.contactPhone ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contactPhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))
              }
            />
          </Field>
          {bank ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Payout account
              </p>
              <Field label="Bank name">
                <Input
                  value={bankDraft.bankName}
                  onChange={(e) => setBankDraft((d) => ({ ...d, bankName: e.target.value }))}
                />
              </Field>
              <Field label="IFSC">
                <Input
                  className="num"
                  maxLength={11}
                  placeholder="e.g. HDFC0001234"
                  value={bankDraft.ifsc}
                  onChange={(e) => setBankDraft((d) => ({ ...d, ifsc: e.target.value.toUpperCase() }))}
                />
                {!ifscOk ? (
                  <p className="mt-1 text-[11px] text-destructive">
                    Not a valid IFSC format (4 letters, 0, then 6 alphanumerics), e.g. HDFC0001234.
                  </p>
                ) : null}
              </Field>
              <Field label="Account holder">
                <Input
                  value={bankDraft.beneficiaryName}
                  onChange={(e) => setBankDraft((d) => ({ ...d, beneficiaryName: e.target.value }))}
                />
              </Field>
              <p className="text-[11px] text-muted-foreground">
                Account {bank.accountNumberMasked} stays masked. A corrected IFSC clears a compliance block
                on save.
              </p>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (!gstinOk) {
                  toast.error("Enter a valid 15-character GSTIN (e.g. 27AAPFU0939F1ZV), or leave it blank.");
                  return;
                }
                if (!ifscOk) {
                  toast.error("Enter a valid 11-character IFSC (e.g. HDFC0001234).");
                  return;
                }
                try {
                  await onSave(draft);
                  if (bankChanged && bank) {
                    await onSaveBank({
                      bankName: bankDraft.bankName.trim(),
                      accountNumber: bank.accountNumberMasked,
                      ifsc: bankDraft.ifsc.trim().toUpperCase(),
                      beneficiaryName: bankDraft.beneficiaryName.trim(),
                    });
                  }
                  setEditing(false);
                } catch {
                  // The parent already surfaced the error; keep the editor open for correction.
                }
              }}
            >
              Save details
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[14px] leading-5 text-muted-foreground">
            Business name, owner, GSTIN, PAN, address, phone, bank and the acceptance record are all in the
            merchant record at the top of this page. Choose{" "}
            <span className="font-medium text-foreground">Edit</span> to correct them.
          </p>
          {seller.inquiryAssignedTo ? (
            <p className="text-[14px] leading-5 text-muted-foreground">
              Enquiry owner:{" "}
              <span className="font-medium text-foreground">{seller.inquiryAssignedTo}</span>
            </p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
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
