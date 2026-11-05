"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { EmptyState } from "@/components/patterns/DataState";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
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
  setSellerStatus,
  updateVendorPlatformFee,
  verifySellerDocument,
  verifySellerKyc,
} from "@/lib/api";
import { useAnalyticsSeries, useSeller } from "@/lib/api/hooks";
import type { KycDocument, SellerDetail, SellerVendorRecord } from "@/data/types";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{2}$/;

function SellerReview() {
  const { id } = useParams<{ id: string }>();
  const local = useSeller(id);
  const series = useAnalyticsSeries("seller", id, 30);
  const [detail, setDetail] = useState<SellerDetail | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

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
  const bank = seller.bankAccount;

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

  const approve = async () => {
    setBusy(true);
    try {
      const next = await verifySellerKyc(seller.sellerId);
      if (next) setDetail(next);
      toast.success("KYC verified — seller activated");
    } catch {
      toast.error("Could not create the Razorpay linked account");
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
          </div>
        }
      />

      <KpiStrip
        items={[
          { label: "GMV (30d)", value: formatINR(sumGmv(series), { compact: true }) },
          { label: "Orders (30d)", value: formatNumber(sumOrders(series)) },
          { label: "Vendors", value: String(seller.vendors?.length ?? 0) },
          { label: "KYC", value: seller.razorpayLinkedAccountId ? "Route linked" : "Not linked" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="KYC documents"
          description="Passbook is mandatory; FSSAI and drug licences are optional and verified during review."
          actions={<ComponentHelp id="doc-row" label="About KYC documents" />}
        >
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
                      {doc.assetId ?? doc.fileKey ?? doc.fileUrl ?? "No file reference"}
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Registered details">
          <dl className="space-y-2 text-[13px]">
            <Row label="GSTIN" value={seller.gstin} {...(gstinOk ? {} : { tone: "bad" as const })} />
            <Row label="PAN" value={seller.pan} />
            <Row label="Address" value={seller.businessAddress} />
            <Row label="Phone" value={seller.contactPhone || "—"} />
            <Row label="Email" value={seller.contactEmail || "—"} />
            <Row
              label="Bank"
              value={bank ? `${bank.bankName ? `${bank.bankName} · ` : ""}${bank.accountNumberMasked} · ${bank.ifsc}` : "Not added"}
            />
            <Row label="OTP signature" value={seller.otpVerified ? "Verified" : "Missing"} />
            <Row label="Razorpay account" value={seller.razorpayLinkedAccountId || "Not linked"} />
          </dl>
        </SectionCard>
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
            onConfirm={() => {
              setSellerStatus(seller.sellerId, "SUSPENDED", reason.trim());
              toast.success("Seller suspended");
            }}
          />
        </div>
      </SectionCard>
    </div>
  );
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
  useEffect(() => setFee(String(vendor.platformFeePct)), [vendor.platformFeePct]);
  const floor = vendor.app === "FOOD" ? 5 : 1;
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium">{vendor.name}</p>
          <p className="num text-[11px] text-muted-foreground">
            {vendor.storeId} · {vendor.app}
            {vendor.fssaiNumber ? ` · FSSAI ${vendor.fssaiNumber}` : ""}
            {vendor.isLive ? " · live" : " · paused"}
          </p>
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
