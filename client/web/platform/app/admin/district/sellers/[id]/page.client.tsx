"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Eye, EyeOff, MapPin, Upload } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { EmptyState } from "@/components/patterns/DataState";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { SellerCredentialCard } from "@/components/patterns/SellerCredentialCard";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { sumGmv, sumOrders } from "@/lib/analytics/derive";
import {
  addSellerKycDocument,
  fetchPrivateDocumentUrl,
  fetchSellerDetail,
  getBankAccount,
  listKyc,
  rejectSellerApplication,
  requestSellerDocument,
  setSellerStatus,
  updateSeller,
  updateVendorPlatformFee,
  verifySellerDocument,
  verifySellerKyc,
} from "@/lib/api";
import { uploadPrivateDocument } from "@/lib/media/kyc";
import { useAnalyticsSeries, useSeller } from "@/lib/api/hooks";
import type {
  KycDocument,
  SellerDetail,
  SellerLoginCredential,
  SellerProfilePatch,
  SellerVendorRecord,
} from "@/data/types";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{2}$/;
const DOC_TYPES: KycDocument["docType"][] = ["GSTIN", "PAN", "BANK_PROOF", "SHOP_LICENSE", "PASSBOOK", "FSSAI"];

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

  const gstinOk = GSTIN_RE.test(seller.gstin);
  const docs = seller.kycDocuments ?? [];
  const pendingDocRequests = new Set(
    (seller.documentRequests ?? []).filter((r) => r.status === "PENDING").map((r) => r.docType),
  );
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

  const uploadDoc = async (docType: KycDocument["docType"], file: File) => {
    setBusy(true);
    try {
      const upload = await uploadPrivateDocument(file);
      const next = await addSellerKycDocument(seller.sellerId, docType, upload);
      setDetail(next);
      toast.success(`${docType.replace(/_/g, " ")} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload that document");
    } finally {
      setBusy(false);
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
            {(seller.vendors ?? []).map((vendor) => (
              <SectorPill key={vendor.storeId} sector={vendor.app} />
            ))}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="KYC documents"
          description="Passbook is mandatory; FSSAI and drug licences are optional and verified during review."
          actions={<ComponentHelp id="doc-row" label="About KYC documents" />}
        >
          {isInquiry ? (
            <p className="text-[13px] text-muted-foreground">
              An enquiry has no KYC documents. They are uploaded by the merchant in the app.
            </p>
          ) : docs.length === 0 ? (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">No documents uploaded yet.</p>
              <UploadDocRow busy={busy} taken={[]} onUpload={(docType, file) => uploadDoc(docType, file)} />
            </div>
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
              <li className="pt-1">
                <UploadDocRow
                  busy={busy}
                  taken={docs.map((d) => d.docType)}
                  onUpload={(docType, file) => uploadDoc(docType, file)}
                />
              </li>
            </ul>
          )}
        </SectionCard>

        <RegisteredDetails seller={seller} busy={busy} revealed={revealed} onSave={saveProfile} />
      </div>

      <SectionCard
        title="Vendors"
        description="One account can own several shops. The platform fee and licences are per vendor."
      >
        {(seller.vendors ?? []).length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No vendor attached to this account yet.</p>
        ) : (
          <div className="space-y-3">
            {(seller.vendors ?? []).map((vendor) => (
              <VendorFeeRow
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

      <SectionCard title="Decision" description="Approval creates the Razorpay Route linked account; every action is audited.">
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

/** One hidden file input reused for "upload a missing document" and "replace this document". */
function useFilePicker(onPick: (file: File) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="sr-only"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) onPick(file);
      }}
    />
  );
  return { input, open: () => ref.current?.click() };
}

function UploadDocRow({
  busy,
  taken,
  onUpload,
}: {
  busy: boolean;
  taken: KycDocument["docType"][];
  onUpload: (docType: KycDocument["docType"], file: File) => void;
}) {
  const available = DOC_TYPES.filter((d) => !taken.includes(d));
  const [docType, setDocType] = useState<KycDocument["docType"]>(available[0] ?? "PASSBOOK");
  const picker = useFilePicker((file) => onUpload(docType, file));
  if (available.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground">
        Every document type is on file. Use Replace on a row to re-upload one.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={docType} onValueChange={(v) => setDocType(v as KycDocument["docType"])}>
        <SelectTrigger className="h-9 w-[11rem] text-[12px]" aria-label="Document type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {available.map((d) => (
            <SelectItem key={d} value={d}>
              {d.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={busy} onClick={picker.open}>
        <Upload className="size-3.5" aria-hidden />
        Upload a missing document
      </Button>
      {picker.input}
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
  revealed,
  onSave,
}: {
  seller: SellerDetail;
  busy: boolean;
  revealed: boolean;
  onSave: (patch: SellerProfilePatch) => Promise<void>;
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

  useEffect(() => {
    setDraft({
      businessName: seller.businessName,
      ownerName: seller.ownerName,
      gstin: seller.gstin,
      pan: seller.pan,
      businessAddress: seller.businessAddress,
      contactPhone: seller.contactPhone,
    });
  }, [seller]);

  const gstinOk = GSTIN_RE.test(draft.gstin ?? "");
  const bank = seller.bankAccount;

  return (
    <SectionCard
      title="Registered details"
      description="These are the merchant's KYC-bearing business facts. A GSTIN/PAN/address edit re-enters review."
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
              value={draft.gstin ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, gstin: e.target.value.toUpperCase() }))}
            />
            {!gstinOk ? (
              <p className="mt-1 text-[11px] text-destructive">Not a valid GSTIN format.</p>
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
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={busy || !gstinOk}
              onClick={async () => {
                await onSave(draft);
                setEditing(false);
              }}
            >
              Save details
            </Button>
          </div>
        </div>
      ) : (
        <dl className="space-y-2 text-[13px]">
          <Row label="GSTIN" value={seller.gstin} {...(gstinOk ? {} : { tone: "bad" as const })} />
          <Row label="PAN" value={maskPan(seller.pan, revealed)} />
          <Row label="Address" value={seller.businessAddress} />
          <Row label="Phone" value={seller.contactPhone || "—"} />
          <Row label="Email" value={seller.contactEmail || "—"} />
          <Row
            label="Bank"
            value={
              bank
                ? `${bank.bankName ? `${bank.bankName} · ` : ""}${bank.accountNumberMasked} · ${bank.ifsc}`
                : "Not added"
            }
          />
          <Row label="OTP signature" value={seller.otpVerified ? "Verified" : "Missing"} />
          {seller.source ? <Row label="Source" value={seller.source === "web" ? "Landing page" : "App"} /> : null}
          {revealed ? (
            <>
              <Row label="Seller ID" value={seller.sellerId} />
              <Row label="Created" value={formatDate(seller.createdAt)} />
              {seller.inquiryAssignedTo ? (
                <Row label="Enquiry owner" value={seller.inquiryAssignedTo} />
              ) : null}
            </>
          ) : null}
        </dl>
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

/** PAN is identity-grade PII: hidden behind the reveal toggle, with only the last 4 visible by default. */
function maskPan(pan: string, revealed: boolean): string {
  if (!pan) return "—";
  if (revealed) return pan;
  return pan.length > 4 ? `${"•".repeat(pan.length - 4)}${pan.slice(-4)}` : pan;
}

function VendorFeeRow({
  vendor,
  busy,
  onSave,
}: {
  vendor: SellerVendorRecord;
  busy: boolean;
  onSave: (pct: number) => Promise<void>;
}) {
  const [fee, setFee] = useState(String(vendor.platformFeePct));
  const [openingLicence, setOpeningLicence] = useState(false);
  useEffect(() => setFee(String(vendor.platformFeePct)), [vendor.platformFeePct]);
  const floor = vendor.app === "FOOD" ? 5 : 1;
  const hasPin =
    typeof vendor.latitude === "number" && typeof vendor.longitude === "number";
  const mapUrl = hasPin
    ? `https://www.google.com/maps/search/?api=1&query=${vendor.latitude},${vendor.longitude}`
    : null;
  const photos = vendor.photoUrls ?? [];
  const photoKeys = vendor.photoKeys ?? [];
  const licence =
    vendor.app === "PHARMA"
      ? {
          label: "Drug licence",
          number: vendor.drugLicenseNumber ?? "",
          assetId: vendor.drugLicenseCertAssetId ?? "",
        }
      : {
          label: vendor.app === "FOOD" ? "FSSAI licence" : "Shop registration certificate",
          number: vendor.fssaiNumber ?? "",
          assetId: vendor.fssaiCertAssetId ?? "",
        };
  const openLicence = async () => {
    if (!licence.assetId) return;
    setOpeningLicence(true);
    try {
      const url = await fetchPrivateDocumentUrl(licence.assetId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("This licence has no downloadable file");
    } catch {
      toast.error("Could not open this licence");
    } finally {
      setOpeningLicence(false);
    }
  };
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">{vendor.name}</p>
          <p className="num text-[11px] text-muted-foreground">
            {vendor.storeId} · {vendor.app}
            {vendor.fssaiNumber ? ` · FSSAI ${vendor.fssaiNumber}` : ""}
            {vendor.drugLicenseNumber ? ` · Drug licence ${vendor.drugLicenseNumber}` : ""}
            {vendor.isLive ? " · live" : " · paused"}
          </p>
          {licence.number || licence.assetId ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-muted-foreground">
                {licence.label}: {licence.number || "number not provided"}
              </span>
              {licence.assetId ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || openingLicence}
                  onClick={() => void openLicence()}
                >
                  View certificate
                </Button>
              ) : (
                <span className="text-destructive">No certificate file uploaded</span>
              )}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">
              No {licence.label.toLowerCase()} on record.
            </p>
          )}
          {vendor.address ? (
            <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
              <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>{vendor.address}</span>
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">No shop address stored.</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <ExternalLink className="size-3" aria-hidden />
                View pin on map
              </a>
            ) : (
              <span>No map pin stored</span>
            )}
            {vendor.phone ? <span className="num">{vendor.phone}</span> : null}
            {vendor.hours ? <span>{vendor.hours}</span> : null}
          </div>
          {photos.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {photos.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Shop photo ${i + 1}`}
                >
                  <img
                    src={url}
                    alt={`${vendor.name} shop photo ${i + 1}`}
                    className="size-16 rounded-md border border-border object-cover"
                  />
                </a>
              ))}
            </div>
          ) : photoKeys.length ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {photoKeys.length} AVIF shop photo{photoKeys.length === 1 ? "" : "s"} stored (preview
              unavailable)
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">No shop photos stored.</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            className="num h-9 w-24"
            value={fee}
            inputMode="numeric"
            onChange={(e) => setFee(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              const pct = Number(fee);
              if (!Number.isInteger(pct) || pct < floor || pct > 100) {
                toast.error(`Allowed: ${floor}–100% for ${vendor.app}`);
                return;
              }
              void onSave(pct);
            }}
          >
            Save fee
          </Button>
          <ComponentHelp id="fee-input" label="About the platform fee" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={tone === "bad" ? "num text-right text-destructive" : "num text-right"}>{value}</dd>
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
