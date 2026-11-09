"use client";
// One-shot hydration of the portal store from the Go Chi gateway. Every slice
// is best-effort: a failed endpoint leaves the existing (seed) slice untouched.
// When `NEXT_PUBLIC_GATEWAY_URL` is unset this is a no-op.
import { remoteConfigured } from "@/lib/config";
import { remote, toCamel } from "@/lib/api/http";
import {
  fetchNotificationPreferences,
  fetchSellerInventory,
  fetchSellerPricing,
  fetchSellerStores,
  fetchSubUsers,
  type SellerConsoleRow,
} from "@/lib/api";
import { usePortalStore } from "@/lib/api/store";
import type {
  AdSlot,
  AuditLog,
  BloodRequestRecord,
  CampaignScope,
  CampaignStatus,
  CouponRecord,
  CustomerRecord,
  FestivalCampaign,
  HeroCampaign,
  LedgerEntry,
  MenuItemRecord,
  OrderRecord,
  OrderStatus,
  PayoutRecord,
  PrescriptionHistoryEntry,
  PrescriptionRecord,
  ProductRecord,
  QuoteItemRecord,
  RewardLedgerEntry,
  Role,
  Sector,
  SellerOptin,
  SellerRecord,
  SellerStatus,
  SduiLayout,
  StockRecord,
  StoreRecord,
  DistrictAdmin,
  NotificationPreferences,
  SubUser,
  TicketRecord,
} from "@/data/types";

type Raw = Record<string, unknown>;

/** True when a gateway list slice should replace local state (including an intentionally empty one). */
function hasSlice<T>(v: T[] | undefined | null): v is T[] {
  return Array.isArray(v);
}

interface RawSeller {
  sellerId: string;
  businessName: string;
  ownerName: string;
  gstin: string;
  pan: string;
  businessAddress: string;
  contactPhone?: string;
  stateCode: string;
  districtCode?: string;
  status: string;
  rating: number;
  createdAt: string;
  contactEmail?: string;
  otpVerified?: boolean;
  otpVerifiedAt?: string;
  rejectionReason?: string;
  rejectionHistory?: unknown;
}

interface RawLedgerEntry {
  entryId: string;
  sellerId: string;
  cycle: string;
  orderValue: number;
  commission: number;
  tcs: number;
  tds: number;
  productTax: number;
  platformGst: number;
  netPayout: number;
}

interface RawPayout {
  payoutId: string;
  sellerId: string;
  cycle: string;
  amount: number;
  status: string;
  scheduledFor: string;
  paidAmount?: number;
  balance?: number;
  paidAt?: string;
  paidBy?: string;
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

/** Gateway quote lines expose money in whole rupees; the portal stores paisa. */
function mapRxQuote(v: unknown): QuoteItemRecord[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((raw): QuoteItemRecord => {
    const it = raw as Raw;
    return {
      name: str(it["name"]),
      qty: num(it["qty"], 1),
      mrpPaisa: toPaisa(num(it["mrp"])),
      pricePaisa: toPaisa(num(it["price"])),
      discountPaisa: toPaisa(num(it["discount"])),
    };
  });
}

function mapRxHistory(v: unknown): PrescriptionHistoryEntry[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((raw): PrescriptionHistoryEntry => {
    const h = raw as Raw;
    return {
      fromStatus: h["fromStatus"] ? str(h["fromStatus"]) : undefined,
      toStatus: str(h["toStatus"]),
      actorId: str(h["actorId"]),
      actorRole: str(h["actorRole"]),
      createdAt: str(h["createdAt"]),
    };
  });
}

async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

function mergeById<T>(incoming: T[], _existing: T[], _id: (x: T) => string): T[] {
  // The gateway is the only source: never merge phantom local fixtures into a live response.
  return incoming;
}

/** inventory.stock.eta is free text; the portal models it as whole minutes (default 30). */
function parseEtaMinutes(v: unknown): number {
  const m = String(v ?? "").match(/\d+/);
  return m ? Number(m[0]) : 30;
}

/**
 * Maps a gateway seller-product row (`GET /seller/inventory` | `/seller/pricing`) to the portal
 * ProductRecord. Body/identity fields are shared by both endpoints; money arrives in whole rupees.
 */
function mapSellerProductRow(raw: SellerConsoleRow): ProductRecord {
  return {
    productId: raw.id,
    sellerId: raw.sellerId ?? "",
    storeId: raw.storeId ?? "",
    name: raw.name,
    description: raw.description ?? "",
    sector: (raw.app || "MART") as Sector,
    category: raw.category,
    emoji: raw.emoji ?? "",
    imageUrl: raw.imageUrl || (raw.imageKey ? `r2:${raw.imageKey}` : ""),
    unit: raw.unit ?? "",
    pricePaisa: toPaisa(raw.price),
    isVeg: raw.isVeg === true,
    isPrescription: raw.isPrescription === true,
    status: raw.status as ProductRecord["status"],
    reviewReason: raw.reviewReason || undefined,
    createdAt: raw.updatedAt,
  };
}

/**
 * Re-fetches the seller catalog (`GET /seller/pricing`) and replaces the `products` slice, reusing
 * the canonical hydration mapping so live rows keep the exact same shape. Throws on a
 * gateway/transport failure; the slice is only written after a successful fetch, so the caller
 * keeps the last-loaded rows. When the gateway is unconfigured this is a no-op that returns the
 * current slice, so local dev never blanks the store.
 */
export async function refreshSellerProducts(): Promise<ProductRecord[]> {
  if (!remoteConfigured()) return usePortalStore.getState().products;
  const rows = (await fetchSellerPricing()).map(mapSellerProductRow);
  usePortalStore.getState().set(() => ({ products: rows }));
  return rows;
}

/**
 * Fetches every gateway-owned slice and writes it into the store. Returns true
 * when at least one slice was hydrated.
 */
export async function hydrateFromGateway(): Promise<boolean> {
  if (!remoteConfigured()) {
    usePortalStore.getState().set(() => ({ hydrated: true }));
    return false;
  }
  const cur = usePortalStore.getState();
  const role = cur.session?.role;
  const isAdmin = role === "DISTRICT_ADMIN" || role === "SUPER_ADMIN";
  const canReadPayouts = role === "SELLER" || role === "SUPER_ADMIN";

  const [sellers, campaigns, coupons, caps, optins, slots, heroCampaigns, admins, logs, ledger, payouts, rx, blood, sdui, customers, menus, tickets, rates, rewardLedger, orders, inventory, pricing, stores, prefs, subUsers] =
    await Promise.all([
      safe(() => remote.get<RawSeller[]>("/sellers").then(toCamel)),
      safe(() => remote.get<FestivalCampaign[]>("/promo/campaigns").then(toCamel)),
      safe(() =>
        isAdmin
          ? remote.get<RawCoupon[]>("/promo/coupons").then(toCamel)
          : Promise.resolve<RawCoupon[] | undefined>(undefined),
      ),
      safe(() =>
        isAdmin
          ? remote.get<Raw[]>("/promo/sector-caps").then(toCamel)
          : Promise.resolve<Raw[] | undefined>(undefined),
      ),
      safe(() => remote.get<SellerOptin[]>("/promo/optins").then(toCamel)),
      safe(() => remote.get<AdSlot[]>("/ads/slots").then(toCamel)),
      safe(() => remote.get<HeroCampaign[]>("/ads/campaigns").then(toCamel)),
      safe(() =>
        role === "SUPER_ADMIN"
          ? remote.get<DistrictAdmin[]>("/district-admins").then(toCamel)
          : Promise.resolve<DistrictAdmin[] | undefined>(undefined),
      ),
      safe(() =>
        isAdmin
          ? remote.get<AuditLog[]>("/audit-logs").then(toCamel)
          : Promise.resolve<AuditLog[] | undefined>(undefined),
      ),
      safe(() =>
        canReadPayouts
          ? remote.get<RawLedgerEntry[]>("/settlements").then(toCamel)
          : Promise.resolve<RawLedgerEntry[] | undefined>(undefined),
      ),
      safe(() =>
        canReadPayouts
          ? remote.get<RawPayout[]>("/payouts").then(toCamel)
          : Promise.resolve<RawPayout[] | undefined>(undefined),
      ),
      safe(() =>
        remote
          .get<Raw[]>(role === "SELLER" ? "/seller/prescriptions" : "/prescriptions")
          .then(toCamel),
      ),
      safe(() => remote.get<Raw[]>("/blood-requests").then(toCamel)),
      safe(() =>
        role === "SUPER_ADMIN"
          ? remote.get<Raw>("/admin/sdui/home").then(toCamel)
          : Promise.resolve<Raw | undefined>(undefined),
      ),
      // Partner-completion (0017). Customers/tickets are admin surfaces; menus/rates are partner-wide.
      safe(() =>
        (role === "SELLER" ? Promise.resolve<Raw[]>([]) : remote.get<Raw[]>("/customers").then(toCamel)),
      ),
      safe(() => remote.get<Raw[]>("/seller/menus").then(toCamel)),
      safe(() =>
        role === "SELLER" ? Promise.resolve<Raw[]>([]) : remote.get<Raw[]>("/support/tickets").then(toCamel),
      ),
      safe(() =>
        isAdmin
          ? remote.get<Raw>("/rewards/rates").then(toCamel)
          : Promise.resolve<Raw | undefined>(undefined),
      ),
      safe(() =>
        role === "SELLER" ? Promise.resolve<Raw[]>([]) : remote.get<Raw[]>("/rewards/ledger").then(toCamel),
      ),
      safe(() => remote.get<Raw[]>("/seller/orders").then(toCamel)),
      // Seller console: pricing feeds the products slice, inventory feeds the stock slice. Both carry
      // the shared seller-product projection, so either could hydrate products; keep the split
      // semantic. Admins read the same routes (the gateway scopes them to their district), which is
      // what populates the admin product/moderation queues.
      safe(() =>
        role === "SELLER" || isAdmin
          ? fetchSellerPricing()
          : Promise.resolve<SellerConsoleRow[] | undefined>(undefined),
      ),
      safe(() =>
        role === "SELLER" || isAdmin
          ? fetchSellerInventory()
          : Promise.resolve<SellerConsoleRow[] | undefined>(undefined),
      ),
      // The seller's own directory store rows (`accounts.stores` via GET /seller/stores). Hydrating
      // them lets seller order/product rows resolve city/sector and keeps the console scoped the
      // same way the gateway scopes it. Admins are unaffected (their stores stay seed-empty, as today).
      safe(() =>
        role === "SELLER"
          ? fetchSellerStores().then((rows) =>
              rows.map(
                (r): StoreRecord => ({
                  storeId: r.storeId,
                  sellerId: cur.session?.sellerId ?? "",
                  name: r.name,
                  sector: r.sector,
                  addressLine: r.address ?? "",
                  city: "",
                  stateCode: cur.session?.stateCode ?? "",
                  deliveryTime: r.deliveryTime ?? "",
                  hours: r.hours ?? "",
                  isVeg: r.isVeg,
                  isLive: r.isLive,
                  rating: 0,
                }),
              ),
            )
          : Promise.resolve<StoreRecord[] | undefined>(undefined),
      ),
      // Seller self-service settings (0097): alert preferences + staff sub-users. Sellers only.
      safe(() =>
        role === "SELLER"
          ? fetchNotificationPreferences()
          : Promise.resolve<NotificationPreferences | null>(null),
      ),
      safe(() =>
        role === "SELLER" ? fetchSubUsers() : Promise.resolve<SubUser[] | undefined>(undefined),
      ),
    ]);

  const patch: Record<string, unknown> = {};
  let touched = false;

  if (hasSlice(sellers)) {
    patch["sellers"] = sellers.map(
      (s): SellerRecord => ({
        ...s,
        status: s.status as SellerStatus,
        contactPhone: s.contactPhone ?? "",
      }),
    );
    touched = true;
  }
  if (hasSlice(stores)) {
    patch["stores"] = stores;
    touched = true;
  }
  if (hasSlice(campaigns)) {
    patch["campaigns"] = campaigns.map(
      (c): FestivalCampaign => ({
        ...c,
        scope: c.scope as CampaignScope,
        status: c.status as CampaignStatus,
      }),
    );
    touched = true;
  }
  if (hasSlice(coupons)) {
    patch["coupons"] = coupons.map(
      (c): CouponRecord => ({
        ...c,
        maxDiscountPaisa: toPaisa(c.maxDiscount),
        sector: (c.sector as Sector | undefined) ?? undefined,
      }),
    );
    touched = true;
  }
  if (hasSlice(caps)) {
    patch["sectorCaps"] = caps.map((c) => ({
      capId: str(c["capId"]),
      sector: str(c["sector"]) as Sector,
      stateCode: c["stateCode"] ? str(c["stateCode"]) : undefined,
      maxDiscountPercent: num(c["maxDiscountPercent"]),
      updatedAt: str(c["updatedAt"]),
    }));
    touched = true;
  }
  if (hasSlice(optins)) {
    patch["optins"] = optins;
    touched = true;
  }
  if (hasSlice(slots)) {
    patch["adSlots"] = slots;
    touched = true;
  }
  if (hasSlice(heroCampaigns)) {
    patch["heroCampaigns"] = heroCampaigns;
    touched = true;
  }
  if (hasSlice(admins)) {
    patch["districtAdmins"] = admins;
    touched = true;
  }
  if (hasSlice(logs)) {
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
  if (hasSlice(ledger)) {
    patch["ledger"] = ledger.map(
      (l): LedgerEntry => ({
        entryId: l.entryId,
        sellerId: l.sellerId,
        cycle: l.cycle,
        orderValuePaisa: toPaisa(l.orderValue),
        commissionPaisa: toPaisa(l.commission),
        tcsPaisa: toPaisa(l.tcs),
        tdsPaisa: toPaisa(l.tds),
        productTaxPaisa: toPaisa(l.productTax),
        platformGstPaisa: toPaisa(l.platformGst),
        netPayoutPaisa: toPaisa(l.netPayout),
      }),
    );
    touched = true;
  }
  if (hasSlice(payouts)) {
    patch["payouts"] = payouts.map(
      (p): PayoutRecord => ({
        payoutId: p.payoutId,
        sellerId: p.sellerId,
        cycle: p.cycle,
        amountPaisa: toPaisa(p.amount),
        status: p.status as PayoutRecord["status"],
        scheduledFor: p.scheduledFor,
        ...(p.paidAmount != null ? { paidAmountPaisa: toPaisa(p.paidAmount) } : {}),
        ...(p.balance != null ? { balancePaisa: toPaisa(p.balance) } : {}),
        ...(p.paidAt ? { paidAt: p.paidAt } : {}),
        ...(p.paidBy ? { paidBy: p.paidBy } : {}),
      }),
    );
    touched = true;
  }
  if (hasSlice(rx)) {
    // Gateway prescription rows are thin; merge onto seeded rows for display fields. The seller
    // projection is name-only until READY/FULFILLED — phone/address stay empty before the reveal.
    const mapped = rx.map(
      (r): PrescriptionRecord => ({
        prescriptionId: str(r["prescriptionId"] ?? r["id"]),
        userId: r["userId"] ? str(r["userId"]) : undefined,
        sellerId: str(r["sellerId"]),
        storeId: str(r["storeId"] ?? r["vendorId"]),
        vendorName: str(r["vendorName"]),
        customerName: r["customerName"] ? str(r["customerName"]) : undefined,
        customerPhone: r["customerPhone"] ? str(r["customerPhone"]) : undefined,
        customerAddress: r["customerAddress"] ? str(r["customerAddress"]) : undefined,
        pages: num(r["pages"], 1),
        note: str(r["note"]),
        fulfillment: r["fulfillment"] === "PICKUP" ? "PICKUP" : "DELIVERY",
        status: str(r["status"], "RECEIVED") as PrescriptionRecord["status"],
        imagePaths: Array.isArray(r["imagePaths"])
          ? (r["imagePaths"] as unknown[]).map((x) => String(x))
          : undefined,
        quote: mapRxQuote(r["quote"]),
        quotedTotalPaisa: toPaisa(num(r["quotedTotal"])),
        revealedAt: r["revealedAt"] ? str(r["revealedAt"]) : undefined,
        history: mapRxHistory(r["history"]),
        createdAt: str(r["createdAt"]),
        updatedAt: str(r["updatedAt"] ?? r["createdAt"]),
      }),
    );
    patch["prescriptions"] = mergeById(mapped, cur.prescriptions, (x) => x.prescriptionId);
    touched = true;
  }
  if (hasSlice(blood)) {
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
      layoutId: str(sdui["layoutId"], "home"),
      locale: str(sdui["locale"], "en"),
      version: num(sdui["version"]),
      sections: (Array.isArray(sdui["sections"]) ? sdui["sections"] : []) as SduiLayout["sections"],
      updatedAt: str(sdui["updatedAt"], new Date().toISOString()),
    };
    patch["sduiLayouts"] = [layout];
    touched = true;
  }
  if (hasSlice(customers)) {
    patch["customers"] = customers.map(
      (c): CustomerRecord => ({
        userId: str(c["userId"]),
        name: str(c["name"]),
        stateCode: c["stateCode"] ? str(c["stateCode"]) : undefined,
        ordersCount: num(c["ordersCount"]),
        spendPaisa: toPaisa(num(c["spend"])),
        lastOrderAt: c["lastOrderAt"] ? str(c["lastOrderAt"]) : undefined,
        createdAt: str(c["createdAt"]),
      }),
    );
    touched = true;
  }
  if (hasSlice(menus)) {
    patch["menus"] = menus.map(
      (m): MenuItemRecord => ({
        venueId: str(m["venueId"]),
        dishId: str(m["dishId"]),
        name: str(m["name"]),
        pricePaisa: toPaisa(num(m["price"])),
        mrpPaisa: m["mrp"] == null ? undefined : toPaisa(num(m["mrp"])),
        isVeg: typeof m["isVeg"] === "boolean" ? m["isVeg"] : undefined,
        cuisine: m["cuisine"] ? str(m["cuisine"]) : undefined,
        rating: m["rating"] == null ? undefined : num(m["rating"]),
        image: m["image"] ? str(m["image"]) : undefined,
        sellerId: m["sellerId"] ? str(m["sellerId"]) : undefined,
        status: str(m["status"], "DRAFT") as MenuItemRecord["status"],
      }),
    );
    touched = true;
  }
  if (hasSlice(orders)) {
    const sellerId = cur.session?.sellerId ?? "";
    const seller = cur.sellers.find((row) => row.sellerId === sellerId);
    const storeById = new Map(
      [...cur.stores, ...(Array.isArray(stores) ? stores : [])].map((store) => [store.storeId, store]),
    );
    patch["orders"] = mergeById(
      orders.map((raw): OrderRecord => {
        const vendorStoreIds = Array.isArray(raw["vendorStoreIds"])
          ? raw["vendorStoreIds"].map((id) => str(id)).filter(Boolean)
          : [];
        // Prefer the order's own store id, then a vendor-scoped list, then — when the seller owns a
        // single shop — that shop, so a scoped seller list never hides an order it owns.
        const ownedStoreIds = Array.isArray(stores) ? stores.map((s) => s.storeId) : [];
        const storeId =
          str(raw["storeId"]) ||
          vendorStoreIds[0] ||
          (ownedStoreIds.length === 1 ? ownedStoreIds[0]! : "") ||
          "";
        const store = storeById.get(storeId);
        const placedAt = str(raw["placedAt"]);
        const placed = Date.parse(placedAt);
        const lineItems = Array.isArray(raw["lineItems"]) ? raw["lineItems"] : [];
        const itemsCount = lineItems.reduce((sum, line) => sum + num((line as Raw)["qty"], 1), 0);
        const lineTotalPaisa = lineItems.reduce(
          (sum, line) => {
            const item = line as Raw;
            return sum + num(item["unitPrice"]) * 100 * num(item["qty"], 1);
          },
          0,
        );
        const status = str(raw["status"]).toUpperCase();
        const mappedStatus: OrderStatus =
          status === "REJECTED"
            ? "CANCELLED"
            : status === "NEW" ||
                status === "PACKED" ||
                status === "SHIPPED" ||
                status === "DELIVERED" ||
                status === "CANCELLED" ||
                status === "RETURNED"
              ? status
              : "NEW";
        return {
          orderId: str(raw["id"]),
          sellerId,
          storeId,
          customerName: "Customer",
          city: store?.city ?? "",
          stateCode: store?.stateCode ?? cur.session?.stateCode ?? seller?.stateCode ?? "",
          sector: store?.sector ?? "MART",
          itemsCount,
          amountPaisa: num(raw["totalChargedPaisa"]) || lineTotalPaisa,
          status: mappedStatus,
          placedAt,
          slaDueAt: Number.isFinite(placed)
            ? new Date(placed + 4 * 60 * 60 * 1000).toISOString()
            : placedAt,
        };
      }),
      cur.orders,
      (order) => order.orderId,
    );
    touched = true;
  }
  if (hasSlice(pricing)) {
    patch["products"] = pricing.map(mapSellerProductRow);
    touched = true;
  }
  if (hasSlice(inventory)) {
    patch["stock"] = inventory.map(
      (raw): StockRecord => ({
        productId: raw.id,
        quantity: raw.inStockQty,
        lowStockThreshold: 12,
        etaMinutes: parseEtaMinutes(raw.eta),
        updatedAt: raw.updatedAt,
      }),
    );
    touched = true;
  }
  if (hasSlice(tickets)) {
    patch["tickets"] = tickets.map(
      (t): TicketRecord => ({
        ticketId: str(t["ticketId"]),
        userId: t["userId"] ? str(t["userId"]) : undefined,
        sellerId: t["sellerId"] ? str(t["sellerId"]) : undefined,
        stateCode: t["stateCode"] ? str(t["stateCode"]) : undefined,
        subject: str(t["subject"]),
        body: str(t["body"]),
        status: str(t["status"], "OPEN") as TicketRecord["status"],
        createdAt: str(t["createdAt"]),
      }),
    );
    touched = true;
  }
  if (rates && rates["coinEarnRate"] != null) {
    patch["rewardRates"] = {
      coinEarnRate: num(rates["coinEarnRate"], 1000),
      coinRedeemRate: num(rates["coinRedeemRate"], 100),
      streakTargetDays: num(rates["streakTargetDays"], 7),
      discountCardPercent: num(rates["discountCardPercent"], 10),
      cardValidityDays: num(rates["cardValidityDays"], 5),
      updatedAt: rates["updatedAt"] ? str(rates["updatedAt"]) : undefined,
    };
    touched = true;
  }
  if (hasSlice(rewardLedger)) {
    patch["rewardLedger"] = rewardLedger.map(
      (e): RewardLedgerEntry => ({
        entryId: str(e["entryId"]),
        type: str(e["type"], "EARN") as RewardLedgerEntry["type"],
        coins: num(e["coins"]),
        rupees: num(e["rupees"]),
        orderId: e["orderId"] ? str(e["orderId"]) : undefined,
        at: str(e["at"]),
      }),
    );
    touched = true;
  }

  if (prefs) {
    patch["notificationPreferences"] = prefs;
    touched = true;
  }
  if (hasSlice(subUsers)) {
    patch["subUsers"] = subUsers;
    touched = true;
  }

  if (touched) usePortalStore.getState().set(() => patch);
  usePortalStore.getState().set(() => ({ hydrated: true }));
  return touched;
}