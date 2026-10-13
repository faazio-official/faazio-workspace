"use client";
// One-shot hydration of the portal store from the Go Chi gateway. Every slice
// is best-effort: a failed endpoint leaves the existing (seed) slice untouched.
// When `NEXT_PUBLIC_GATEWAY_URL` is unset this is a no-op.
import { remoteConfigured } from "@/lib/config";
import { remote, toCamel } from "@/lib/api/http";
import { usePortalStore } from "@/lib/api/store";
import type {
  AdSlot,
  AuditLog,
  BookingRecord,
  BloodRequestRecord,
  CampaignScope,
  CampaignStatus,
  CouponRecord,
  FestivalCampaign,
  LedgerEntry,
  PayoutRecord,
  PrescriptionRecord,
  ReviewRecord,
  Role,
  Sector,
  SellerOptin,
  SellerRecord,
  SellerStatus,
  SduiLayout,
  StateAdmin,
} from "@/data/types";

type Raw = Record<string, unknown>;

interface RawSeller {
  sellerId: string;
  businessName: string;
  ownerName: string;
  category: string;
  gstin: string;
  pan: string;
  businessAddress: string;
  contactPhone?: string;
  stateCode: string;
  status: string;
  rating: number;
  createdAt: string;
}

interface RawLedgerEntry {
  entryId: string;
  sellerId: string;
  cycle: string;
  orderValue: number;
  commission: number;
  tcs: number;
  netPayout: number;
}

interface RawPayout {
  payoutId: string;
  sellerId: string;
  cycle: string;
  amount: number;
  status: string;
  scheduledFor: string;
}

interface RawCoupon extends Omit<CouponRecord, "maxDiscountPaisa"> {
  maxDiscount: number;
}

/** rupees -> paisa (the gateway speaks whole rupees; the portal stores paisa). */
function toPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

function mergeById<T>(incoming: T[], existing: T[], id: (x: T) => string): T[] {
  if (existing.length === 0) return incoming;
  const byId = new Map(existing.map((x) => [id(x), x]));
  return incoming.map((x) => ({ ...(byId.get(id(x)) ?? ({} as T)), ...x }));
}

/**
 * Fetches every gateway-owned slice and writes it into the store. Returns true
 * when at least one slice was hydrated.
 */
export async function hydrateFromGateway(): Promise<boolean> {
  if (!remoteConfigured()) return false;
  const cur = usePortalStore.getState();
  const role = cur.session?.role;

  const [sellers, campaigns, coupons, caps, optins, slots, admins, logs, ledger, payouts, rx, bookings, blood, sdui, reviews] =
    await Promise.all([
      safe(() => remote.get<RawSeller[]>("/sellers").then(toCamel)),
      safe(() => remote.get<FestivalCampaign[]>("/promo/campaigns").then(toCamel)),
      safe(() => remote.get<RawCoupon[]>("/promo/coupons").then(toCamel)),
      safe(() => remote.get<Raw[]>("/promo/sector-caps").then(toCamel)),
      safe(() => remote.get<SellerOptin[]>("/promo/optins").then(toCamel)),
      safe(() => remote.get<AdSlot[]>("/ads/slots").then(toCamel)),
      safe(() => remote.get<StateAdmin[]>("/state-admins").then(toCamel)),
      safe(() => remote.get<AuditLog[]>("/audit-logs").then(toCamel)),
      safe(() => remote.get<RawLedgerEntry[]>("/settlements").then(toCamel)),
      safe(() => remote.get<RawPayout[]>("/payouts").then(toCamel)),
      safe(() =>
        remote
          .get<Raw[]>(role === "SELLER" ? "/seller/prescriptions" : "/prescriptions")
          .then(toCamel),
      ),
      safe(() =>
        remote.get<Raw[]>(role === "SELLER" ? "/seller/bookings" : "/bookings").then(toCamel),
      ),
      safe(() => remote.get<Raw[]>("/blood-requests").then(toCamel)),
      safe(() => remote.get<Raw>("/sdui/home").then(toCamel)),
      safe(() => remote.get<ReviewRecord[]>("/reviews").then(toCamel)),
    ]);

  const patch: Record<string, unknown> = {};
  let touched = false;

  if (sellers) {
    patch["sellers"] = sellers.map(
      (s): SellerRecord => ({
        ...s,
        category: s.category as Sector,
        status: s.status as SellerStatus,
        contactPhone: s.contactPhone ?? "",
      }),
    );
    touched = true;
  }
  if (campaigns) {
    patch["campaigns"] = campaigns.map(
      (c): FestivalCampaign => ({
        ...c,
        scope: c.scope as CampaignScope,
        status: c.status as CampaignStatus,
      }),
    );
    touched = true;
  }
  if (coupons) {
    patch["coupons"] = coupons.map(
      (c): CouponRecord => ({
        ...c,
        maxDiscountPaisa: toPaisa(c.maxDiscount),
        sector: (c.sector as Sector | undefined) ?? undefined,
      }),
    );
    touched = true;
  }
  if (caps) {
    patch["sectorCaps"] = caps.map((c) => ({
      capId: str(c["capId"]),
      sector: str(c["sector"]) as Sector,
      stateCode: c["stateCode"] ? str(c["stateCode"]) : undefined,
      maxDiscountPercent: num(c["maxDiscountPercent"]),
      updatedAt: str(c["updatedAt"]),
    }));
    touched = true;
  }
  if (optins) {
    patch["optins"] = optins;
    touched = true;
  }
  if (slots) {
    patch["adSlots"] = slots;
    touched = true;
  }
  if (admins) {
    patch["stateAdmins"] = admins;
    touched = true;
  }
  if (logs) {
    patch["auditLogs"] = logs.map(
      (l): AuditLog => ({
        ...l,
        actorRole: l.actorRole as Role,
        before: l.before == null ? null : JSON.stringify(l.before),
        after: l.after == null ? null : JSON.stringify(l.after),
      }),
    );
    touched = true;
  }
  if (ledger) {
    patch["ledger"] = ledger.map(
      (l): LedgerEntry => ({
        entryId: l.entryId,
        sellerId: l.sellerId,
        cycle: l.cycle,
        orderValuePaisa: toPaisa(l.orderValue),
        commissionPaisa: toPaisa(l.commission),
        tcsPaisa: toPaisa(l.tcs),
        netPayoutPaisa: toPaisa(l.netPayout),
      }),
    );
    touched = true;
  }
  if (payouts) {
    patch["payouts"] = payouts.map(
      (p): PayoutRecord => ({
        payoutId: p.payoutId,
        sellerId: p.sellerId,
        cycle: p.cycle,
        amountPaisa: toPaisa(p.amount),
        status: p.status as PayoutRecord["status"],
        scheduledFor: p.scheduledFor,
      }),
    );
    touched = true;
  }
  if (rx) {
    // Gateway prescription rows are thin; merge onto seeded rows for display fields.
    const mapped = rx.map(
      (r): PrescriptionRecord => ({
        prescriptionId: str(r["prescriptionId"] ?? r["id"]),
        userId: str(r["userId"]),
        sellerId: str(r["sellerId"]),
        storeId: str(r["storeId"] ?? r["vendorId"]),
        vendorName: str(r["vendorName"]),
        pages: num(r["pages"], 1),
        note: str(r["note"]),
        fulfillment: r["fulfillment"] === "PICKUP" ? "PICKUP" : "DELIVERY",
        status: str(r["status"], "RECEIVED") as PrescriptionRecord["status"],
        createdAt: str(r["createdAt"]),
        updatedAt: str(r["updatedAt"] ?? r["createdAt"]),
      }),
    );
    patch["prescriptions"] = mergeById(mapped, cur.prescriptions, (x) => x.prescriptionId);
    touched = true;
  }
  if (bookings) {
    const mapped = bookings.map(
      (b): BookingRecord => ({
        bookingId: str(b["bookingId"] ?? b["id"]),
        userId: str(b["userId"]),
        sellerId: str(b["sellerId"]),
        storeId: str(b["storeId"] ?? b["vendorId"]),
        venueName: str(b["venueName"] ?? b["restaurantName"]),
        customerName: str(b["customerName"]),
        city: str(b["city"]),
        stateCode: str(b["stateCode"]),
        bookingDate: str(b["bookingDate"] ?? b["date"]),
        slot: str(b["slot"] ?? b["time"]),
        guests: num(b["guests"], 1),
        status: str(b["status"], "pending") as BookingRecord["status"],
        createdAt: str(b["createdAt"]),
      }),
    );
    patch["bookings"] = mergeById(mapped, cur.bookings, (x) => x.bookingId);
    touched = true;
  }
  if (blood) {
    patch["bloodRequests"] = blood.map(
      (r): BloodRequestRecord => ({
        requestId: str(r["requestId"] ?? r["id"]),
        hospital: str(r["hospital"]),
        city: str(r["city"]),
        stateCode: str(r["stateCode"] ?? r["state"]),
        bloodGroup: str(r["bloodGroup"], "O+") as BloodRequestRecord["bloodGroup"],
        unitsRequired: num(r["unitsRequired"], 1),
        urgency: str(r["urgency"], "normal") as BloodRequestRecord["urgency"],
        patientContext: str(r["patientContext"]),
        contact: str(r["contact"]),
        postedAt: str(r["postedAt"]),
        expiresAt: str(r["expiresAt"]),
      }),
    );
    touched = true;
  }
  if (sdui && sdui["version"] != null) {
    const layout: SduiLayout = {
      layoutId: "home",
      locale: str(sdui["locale"], "en-IN"),
      path: "/home",
      version: num(sdui["version"]),
      status: "PUBLISHED",
      sections: (Array.isArray(sdui["sections"]) ? sdui["sections"] : []) as SduiLayout["sections"],
      updatedAt: str(sdui["updatedAt"], new Date().toISOString()),
    };
    patch["sduiLayouts"] = [layout];
    touched = true;
  }
  if (reviews) {
    patch["reviews"] = reviews;
    touched = true;
  }

  if (touched) usePortalStore.getState().set(() => patch);
  return touched;
}