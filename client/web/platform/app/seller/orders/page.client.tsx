"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Clock, Receipt } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { OrdersHeaderIcons, OrdersTopBar } from "@/components/sellers/shells";
import { EmptyState, PillTabs, RadioRow, SectorBadge, Sheet } from "@/components/sellers/kit";
import {
  acceptOrder,
  advanceOrder,
  fetchSellerPickupQr,
  rejectOrder,
  type SellerPickupQr,
} from "@/lib/api";
import { useOrders, useSellerScope } from "@/lib/api/hooks";
import { useSellerUi } from "@/lib/sellerUi";
import { formatDateTime, formatINR } from "@/lib/format";
import { orderStatusLabel } from "@/lib/sector";
import type { OrderRecord, OrderStatus } from "@/data/types";

type TabKey = "NEW" | "PACKED" | "SHIPPED" | "DELIVERED";

const TAB_KEYS: TabKey[] = ["NEW", "PACKED", "SHIPPED", "DELIVERED"];

/** Accept is NEW → PACKED; the rest advance along the packed/shipped flows. */
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  PACKED: { to: "SHIPPED", label: "Handed over" },
  SHIPPED: { to: "DELIVERED", label: "Mark delivered" },
};

/** Reject reasons conditioned on the active shop's sector — no kitchen excuses on a Mart/Pharmacy. */
const REJECT_BY_SECTOR: Record<string, string[]> = {
  FOOD: ["Items out of stock", "Kitchen is full", "Restaurant closing soon", "Customer requested", "Other"],
  DEFAULT: ["Items out of stock", "Shop closed", "Customer requested", "Other"],
};

function slaLeft(iso: string): string {
  const h = (new Date(iso).getTime() - Date.now()) / 3600000;
  return h > 0 ? `${h.toFixed(1)}h left` : "SLA overdue";
}

function OrderCard({
  o,
  onReject,
  onShowQr,
}: {
  o: OrderRecord;
  onReject: () => void;
  onShowQr: () => void;
}) {
  const next = NEXT[o.status];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <Link href={`/seller/orders/${encodeURIComponent(o.orderId)}`} className="block p-4">
        <span className="shrink-0">
          <SectorBadge sector={o.sector} />
        </span>
        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-bold">#{o.orderId}</p>
            <p className="truncate text-[11px] text-muted-foreground">{o.customerName}</p>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(o.placedAt)}</span>
        </div>
        <div className="mt-3 space-y-2 border-t border-dashed border-border pt-3 text-xs">
          <div className="flex justify-between">
            <span className="flex items-center gap-2">
              <ClipboardList className="h-3.5 w-3.5" />
              Details
            </span>
            <span>{o.itemsCount} items</span>
          </div>
          <div className="flex justify-between">
            <span className="flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5" />
              Total bill
            </span>
            <span className="font-semibold">{formatINR(o.amountPaisa)}</span>
          </div>
        </div>
      </Link>
      {o.status === "NEW" || next ? (
        <div className="flex items-center gap-2 border-t border-border bg-muted/50 px-4 py-2.5">
          <span className="flex flex-1 items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {o.status === "NEW" ? slaLeft(o.slaDueAt) : `SLA ${slaLeft(o.slaDueAt)}`}
          </span>
          {o.status === "NEW" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onReject}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  acceptOrder(o.orderId);
                  toast.success(`#${o.orderId} accepted`);
                }}
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
              >
                Accept
              </button>
            </div>
          ) : next ? (
            <div className="flex items-center gap-2">
              {o.status === "PACKED" ? (
                <button
                  onClick={onShowQr}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                >
                  Pickup QR
                </button>
              ) : null}
              <button
                onClick={() => {
                  advanceOrder(o.orderId, next.to);
                  toast.success(`#${o.orderId} → ${next.label}`);
                }}
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
              >
                {next.label}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SellerOrders() {
  const { sellerId, storeId, activeStore } = useSellerScope();
  const sector = activeStore?.sector;
  const online = useSellerUi((s) => s.online);
  const orders = useOrders({ sellerId, storeId });
  const [tab, setTab] = useState<TabKey>("NEW");
  const [search, setSearch] = useState(false);
  const [qrFor, setQrFor] = useState<OrderRecord | null>(null);
  const [qr, setQr] = useState<SellerPickupQr | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [rejecting, setRejecting] = useState<OrderRecord | null>(null);
  const rejectReasons = REJECT_BY_SECTOR[sector ?? "DEFAULT"] ?? REJECT_BY_SECTOR["DEFAULT"]!;
  const [reason, setReason] = useState<string>(rejectReasons[0]!);

  const openPickupQr = async (order: OrderRecord) => {
    setQrFor(order);
    setQr(null);
    setQrError(null);
    setQrLoading(true);
    try {
      setQr(await fetchSellerPickupQr(order.orderId));
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "Could not load the pickup QR.");
    } finally {
      setQrLoading(false);
    }
  };

  // The active shop can change under this page (StoreSwitcher in the header); reset the selected
  // reject reason when the sector's reason list changes so a food excuse never leaks to a Mart order.
  useEffect(() => {
    setReason((current) => (rejectReasons.includes(current) ? current : rejectReasons[0]!));
  }, [rejectReasons]);

  const sorted = [...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const list = sorted.filter((o) => o.status === tab);
  const closed = sorted.filter((o) => o.status === "CANCELLED" || o.status === "RETURNED");
  const tabs = TAB_KEYS.map((key) => {
    const label = orderStatusLabel(key, sector);
    const count = orders.filter((o) => o.status === key).length;
    return count > 0 ? { key, label, count } : { key, label };
  });
  const ql = q.toLowerCase();
  const found = sorted.filter(
    (o) => ql && (o.orderId.toLowerCase().includes(ql) || o.customerName.toLowerCase().includes(ql)),
  );

  return (
    <>
      <OrdersTopBar
        extra={
          <OrdersHeaderIcons
            onSearch={() => setSearch(true)}
            onScan={() => {
              const packed = sorted.find((o) => o.status === "PACKED");
              if (packed) void openPickupQr(packed);
              else toast.info("No packed orders ready for pickup");
            }}
          />
        }
      />
      <div className="space-y-3 px-4 pt-3">
        {!online && (
          <Link
            href="/seller/restaurant-status"
            className="block rounded-xl bg-brand-soft px-4 py-2.5 text-xs font-semibold text-brand"
          >
            You are offline and not receiving new orders. Tap to go online →
          </Link>
        )}
        <PillTabs tabs={tabs} value={tab} onChange={setTab} />
        {tab === "DELIVERED" && (
          <Link
            href="/seller/order-history"
            className="block rounded-xl bg-info-soft px-4 py-2.5 text-xs text-info"
          >
            Want to see orders older than today? <b>View order history</b>
          </Link>
        )}
        {list.length === 0 ? (
          <EmptyState
            text={`No ${tabs.find((t) => t.key === tab)?.label.toLowerCase()} orders right now`}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.map((o) => (
              <OrderCard
                key={o.orderId}
                o={o}
                onReject={() => setRejecting(o)}
                onShowQr={() => void openPickupQr(o)}
              />
            ))}
          </div>
        )}

        {closed.length > 0 && (
          <section className="pt-2">
            <h2 className="px-1 pb-2 text-sm font-bold">Cancelled & returns</h2>
            <div className="space-y-3">
              {closed.map((o) => (
                <Link
                  key={o.orderId}
                  href={`/seller/orders/${encodeURIComponent(o.orderId)}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">#{o.orderId}</span>
                    <span className="block text-[11px] text-muted-foreground">{o.customerName}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">
                      {o.status === "CANCELLED" ? "Cancelled" : "Returned"} · {formatINR(o.amountPaisa)}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        o.status === "CANCELLED"
                          ? "bg-warning-soft text-warning"
                          : "bg-brand-soft text-brand"
                      }`}
                    >
                      {o.status}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <Sheet
        open={search}
        onClose={() => {
          setSearch(false);
          setQ("");
        }}
        title="Search orders"
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by order ID or customer name"
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-info"
        />
        <div className="mt-3 space-y-2 pb-4">
          {found.map((o) => (
            <Link
              key={o.orderId}
              href={`/seller/orders/${encodeURIComponent(o.orderId)}`}
              className="flex justify-between rounded-xl border border-border p-3 text-sm"
            >
              <span>
                #{o.orderId} • {o.customerName}
              </span>
              <span className="text-xs text-muted-foreground">
                {orderStatusLabel(o.status, sector)}
              </span>
            </Link>
          ))}
          {q && !found.length && (
            <p className="py-6 text-center text-xs text-muted-foreground">No matching orders</p>
          )}
        </div>
      </Sheet>

      <Sheet
        open={qrFor !== null}
        onClose={() => {
          setQrFor(null);
          setQr(null);
          setQrError(null);
        }}
        title="Pickup QR"
      >
        <div className="pb-4">
          <p className="mb-3 text-center text-xs text-muted-foreground">
            {qrFor ? `Order #${qrFor.orderId}` : ""} — ask the delivery partner to scan this code at
            pickup.
          </p>
          {qrLoading ? (
            <div className="mx-auto my-4 h-56 w-56 animate-pulse rounded-2xl bg-muted" />
          ) : qr ? (
            <div className="mx-auto my-2 flex w-fit rounded-2xl bg-white p-4">
              <QRCodeSVG value={qr.token} size={208} level="M" marginSize={2} />
            </div>
          ) : (
            <div className="mx-auto my-4 flex aspect-square w-56 items-center justify-center rounded-2xl border-2 border-dashed border-border px-4 text-center text-xs text-muted-foreground">
              {qrError ?? "This order has no active pickup yet."}
            </div>
          )}
          {qr ? (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Expires {formatDateTime(qr.expiresAt)}
            </p>
          ) : null}
        </div>
      </Sheet>

      <Sheet
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title="Reason for rejection"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setRejecting(null)}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
            >
              Back
            </button>
            <button
              className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
              onClick={() => {
                if (!rejecting) return;
                rejectOrder(rejecting.orderId, reason);
                toast.success(`#${rejecting.orderId} rejected — customer refunded`);
                setRejecting(null);
              }}
            >
              Reject order
            </button>
          </div>
        }
      >
        {rejectReasons.map((r) => (
          <RadioRow key={r} label={r} checked={reason === r} onClick={() => setReason(r)} />
        ))}
      </Sheet>
    </>
  );
}

export default SellerOrders;