"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { EmptyState } from "@/components/patterns/DataState";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
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
import { getBankAccount, listKyc, sellerMetrics, setSellerStatus } from "@/lib/api";
import { useSeller } from "@/lib/api/hooks";


const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{2}$/;

function SellerReview() {
  const { id } = useParams<{ id: string }>();
  const seller = useSeller(id);
  const [reason, setReason] = useState("");

  if (!seller) {
    return (
      <EmptyState
        title="Seller not found"
        description="This application may have been removed."
        action={
          <Link href="/admin/state/sellers" className="text-[13px] font-semibold text-primary">
            Back to sellers
          </Link>
        }
      />
    );
  }

  const docs = listKyc(seller.sellerId);
  const bank = getBankAccount(seller.sellerId);
  const series = sellerMetrics(seller.sellerId, 30);
  const gstinOk = GSTIN_RE.test(seller.gstin);

  return (
    <div className="space-y-4">
      <PageHeader
        title={seller.businessName}
        description={`${seller.ownerName} · ${seller.stateCode} · applied ${formatDate(seller.createdAt)}`}
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
          { label: "Rating", value: seller.rating.toFixed(1) },
          { label: "GSTIN check", value: gstinOk ? "Valid format" : "Invalid format" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="KYC documents">
          {docs.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((doc) => (
                <li
                  key={doc.kycId}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-[13px] font-medium">{doc.docType.replace("_", " ")}</p>
                    <p className="num text-[11px] text-muted-foreground">{doc.fileUrl}</p>
                  </div>
                  <StatusPill status={doc.verified ? "VERIFIED" : "PENDING"} />
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
            <Row label="Phone" value={seller.contactPhone} />
            <Row label="Bank" value={bank ? `${bank.accountNumberMasked} · ${bank.ifsc}` : "Not added"} />
          </dl>
        </SectionCard>
      </div>

      <SectionCard title="Decision" description="A reason is written to the audit log">
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for approval, rejection or suspension"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={reason.trim().length < 4}
            onClick={() => {
              setSellerStatus(seller.sellerId, "ACTIVE", reason.trim());
              toast.success("Seller approved and activated");
            }}
          >
            Approve
          </Button>
          <ConfirmButton
            label="Reject"
            variant="outline"
            disabled={reason.trim().length < 4}
            description="The seller can re-apply with corrected documents."
            onConfirm={() => {
              setSellerStatus(seller.sellerId, "REJECTED", reason.trim());
              toast.success("Application rejected");
            }}
          />
          <ConfirmButton
            label="Suspend"
            variant="destructive"
            disabled={reason.trim().length < 4}
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
