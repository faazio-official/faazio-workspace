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
  sellerMetrics,
  setSellerStatus,
  updateSellerPlatformFee,
  verifySellerDocument,
  verifySellerKyc,
} from "@/lib/api";
import { useSeller } from "@/lib/api/hooks";
import type { KycDocument, SellerDetail } from "@/data/types";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{2}$/;

function SellerReview() {
  const { id } = useParams<{ id: string }>();
  const local = useSeller(id);
  const [detail, setDetail] = useState<SellerDetail | null>(null);
  const [fee, setFee] = useState("10");
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
          }
        : undefined),
    [detail, local],
  );

  useEffect(() => {
    if (seller) setFee(String(seller.platformFeePct ?? 10));
  }, [seller]);

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

  const series = sellerMetrics(seller.sellerId, 30);
  const gstinOk = GSTIN_RE.test(seller.gstin);
  const docs = seller.kycDocuments ?? [];
  const bank = seller.bankAccount;

  const saveFee = async () => {
    const pct = Number(fee);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100 || (seller.category === "FOOD" && pct < 5)) {
      toast.error("Platform fee is outside the allowed range for this category");
      return;
    }
    setBusy(true);
    try {
      await updateSellerPlatformFee(seller.sellerId, pct);
      toast.success(`Platform fee set to ${pct}%`);
      await loadDetail();
    } catch {
      toast.error("Could not update the platform fee");
    } finally {
      setBusy(false);
    }
  };

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
            <SectorPill sector={seller.category} />
            <StatusPill status={seller.status} />
          </div>
        }
      />

      <KpiStrip
        items={[
          { label: "GMV (30d)", value: formatINR(sumGmv(series), { compact: true }) },
          { label: "Orders (30d)", value: formatNumber(sumOrders(series)) },
          { label: "Platform fee", value: `${seller.platformFeePct ?? 10}%` },
          { label: "KYC", value: seller.razorpayLinkedAccountId ? "Route linked" : "Not linked" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="KYC documents"
          description="Passbook is mandatory; FSSAI is required for food."
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
            <Row label="FSSAI" value={seller.fssaiNumber || "Not applicable"} />
            <Row
              label="Bank"
              value={bank ? `${bank.bankName ? `${bank.bankName} · ` : ""}${bank.accountNumberMasked} · ${bank.ifsc}` : "Not added"}
            />
            <Row label="OTP signature" value={seller.otpVerified ? "Verified" : "Missing"} />
            <Row label="Razorpay account" value={seller.razorpayLinkedAccountId || "Not linked"} />
          </dl>
        </SectionCard>
      </div>

      <SectionCard title="Platform fee" description="Editable before approval; server enforces the category floor.">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[12px] font-medium" htmlFor="platform-fee">
            Platform fee %
          </label>
          <ComponentHelp id="fee-input" label="About the platform fee" />
          <Input
            id="platform-fee"
            className="num h-9 w-24"
            value={fee}
            inputMode="numeric"
            onChange={(e) => setFee(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
          <Button size="sm" disabled={busy} onClick={() => void saveFee()}>
            Save fee
          </Button>
          <span className="text-[12px] text-muted-foreground">
            {seller.category === "FOOD" ? "Allowed: 5–100%" : "Allowed: 1–100%"}
          </span>
        </div>
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
