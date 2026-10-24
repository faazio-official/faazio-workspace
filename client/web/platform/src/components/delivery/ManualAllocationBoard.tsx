"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatINR } from "@/lib/format";
import { remoteConfigured } from "@/lib/config";
import { DISTRICTS, districtName } from "@/data/districts";
import { useSession } from "@/lib/hooks/useSession";
import {
  allocateDeliveryOrder,
  getAdminDeliveryOrder,
  listAdminDeliveryOrders,
  listAdminOrderRiders,
  type AdminDeliveryOrder,
  type DeliveryPayoutMode,
  type DeliveryRiderCandidate,
} from "@/lib/api/delivery";

type Scope = "SUPER" | "DISTRICT";
type StatusFilter = "ALL" | "UNASSIGNED" | "ASSIGNED" | "REJECTED";

const STATUSES: StatusFilter[] = ["ALL", "UNASSIGNED", "ASSIGNED", "REJECTED"];

export function ManualAllocationBoard({ scope }: { scope: Scope }) {
  const session = useSession();
  const [orders, setOrders] = useState<AdminDeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [district, setDistrict] = useState(
    scope === "DISTRICT" ? (session?.districtCode ?? "") : "",
  );
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [storeId, setStoreId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [selected, setSelected] = useState<AdminDeliveryOrder | null>(null);
  const [riders, setRiders] = useState<DeliveryRiderCandidate[]>([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [includeOffline, setIncludeOffline] = useState(false);
  const [riderId, setRiderId] = useState("");
  const [payoutMode, setPayoutMode] = useState<DeliveryPayoutMode | "">("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!remoteConfigured()) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await listAdminDeliveryOrders({
        district: scope === "SUPER" ? district || undefined : undefined,
        status: status === "ALL" ? undefined : status,
        storeId: storeId.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setOrders(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The gateway rejected the request.");
    } finally {
      setLoading(false);
    }
  }, [district, from, scope, status, storeId, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderKey = useCallback(
    (o: AdminDeliveryOrder) => o.orderId || o.customerOrderId,
    [],
  );

  const loadRiders = useCallback(async (order: AdminDeliveryOrder, offline: boolean) => {
    setRidersLoading(true);
    try {
      setRiders(await listAdminOrderRiders(orderKey(order), offline));
    } catch (err) {
      toast.error("Could not load riders", {
        description: err instanceof Error ? err.message : undefined,
      });
      setRiders([]);
    } finally {
      setRidersLoading(false);
    }
  }, [orderKey]);

  const openOrder = useCallback(
    async (order: AdminDeliveryOrder) => {
      setSelected(order);
      setRiderId("");
      setPayoutMode("");
      setRiders([]);
      setIncludeOffline(false);
      try {
        const detail = await getAdminDeliveryOrder(orderKey(order));
        setSelected(detail);
        await loadRiders(detail, false);
      } catch (err) {
        toast.error("Could not open this order", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [loadRiders, orderKey],
  );

  const allocate = useCallback(async () => {
    if (!selected || !riderId || !payoutMode) return;
    setBusy(true);
    try {
      await allocateDeliveryOrder(orderKey(selected), { riderId, payoutMode });
      toast.success("Rider allocated — 45 second accept window started");
      setSelected(null);
      await load();
    } catch (err) {
      toast.error("Allocation failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [load, orderKey, payoutMode, riderId, selected]);

  const totalValue = useMemo(
    () => orders.reduce((sum, o) => sum + o.orderValuePaisa, 0),
    [orders],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manual delivery allocation"
        description="Assign a rider by road distance and choose the payout mode. District admins see only their district; riders are never district-restricted."
      />

      <div className="flex flex-wrap items-end gap-2">
        {scope === "SUPER" ? (
          <div className="space-y-1">
            <Label htmlFor="district-filter" className="text-[11px] text-muted-foreground">
              District
            </Label>
            <select
              id="district-filter"
              className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">All districts</option>
              {DISTRICTS.map((d) => (
                <option key={d.districtCode} value={d.districtCode}>
                  {d.name} ({d.districtCode})
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="status-filter" className="text-[11px] text-muted-foreground">
            Status
          </Label>
          <select
            id="status-filter"
            className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All pending" : s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="store-filter" className="text-[11px] text-muted-foreground">
            Store ID
          </Label>
          <Input
            id="store-filter"
            className="h-9 w-40"
            placeholder="store-…"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="from-filter" className="text-[11px] text-muted-foreground">
            From
          </Label>
          <Input
            id="from-filter"
            type="date"
            className="h-9 w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to-filter" className="text-[11px] text-muted-foreground">
            To
          </Label>
          <Input
            id="to-filter"
            type="date"
            className="h-9 w-40"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        <span className="ml-auto text-[12px] text-muted-foreground">
          {orders.length} order{orders.length === 1 ? "" : "s"} · {formatINR(totalValue)}
        </span>
      </div>

      <SectionCard
        title="Orders awaiting allocation"
        description="PACKED orders with no active rider, plus assigned offers that have not been accepted."
        bodyClassName="p-0"
      >
        <DataShell
          loading={loading}
          error={error}
          isEmpty={orders.length === 0}
          empty={
            <EmptyState
              title="Nothing waiting"
              description="Every delivery-ready order in this scope already has a rider."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Distance</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={orderKey(order)} className="h-12">
                  <TableCell className="num text-[12px] font-medium">
                    {order.customerOrderId}
                    {order.orderId ? (
                      <span className="block text-[10px] text-muted-foreground">
                        {order.orderId}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-[12px]">
                    {order.districtCode
                      ? `${order.districtCode} · ${districtName(order.districtCode)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-[13px]">
                    {order.storeName}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {order.customerName || "—"}
                    {order.dropAddress ? (
                      <span className="block max-w-[220px] truncate text-[11px] text-muted-foreground">
                        {order.dropAddress}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="num text-right text-[12px]">
                    {(order.distanceMeters / 1000).toFixed(1)} km
                  </TableCell>
                  <TableCell className="num text-right text-[12px]">
                    {formatINR(order.orderValuePaisa)}
                  </TableCell>
                  <TableCell className="num text-[12px]">
                    {order.readyAt ? formatDateTime(order.readyAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={order.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => void openOrder(order)}>
                      Allocate
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Allocate rider</DialogTitle>
                <DialogDescription>
                  {selected.customerOrderId} · {selected.storeName} ·{" "}
                  {selected.districtCode
                    ? `${selected.districtCode} · ${districtName(selected.districtCode)}`
                    : "No district"}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 rounded-lg border border-border p-3 text-[12px] sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Pickup
                  </p>
                  <p className="mt-0.5 font-medium">{selected.storeName}</p>
                  <p className="text-muted-foreground">{selected.storeAddress || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Drop</p>
                  <p className="mt-0.5 font-medium">{selected.customerName || "Customer"}</p>
                  <p className="text-muted-foreground">{selected.dropAddress || "—"}</p>
                  <p className="num text-muted-foreground">
                    {selected.customerPhone || "Phone unavailable"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Estimated distance
                  </p>
                  <p className="num mt-0.5 font-medium">
                    {(selected.distanceMeters / 1000).toFixed(1)} km
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Order value
                  </p>
                  <p className="num mt-0.5 font-medium">{formatINR(selected.orderValuePaisa)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold">Available riders</p>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={includeOffline}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setIncludeOffline(next);
                        if (selected) void loadRiders(selected, next);
                      }}
                    />
                    Show offline riders
                  </label>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  {ridersLoading ? (
                    <p className="p-4 text-[12px] text-muted-foreground">Loading riders…</p>
                  ) : riders.length === 0 ? (
                    <p className="p-4 text-[12px] text-muted-foreground">
                      No eligible rider is online. Toggle offline riders or ask a rider to go
                      online.
                    </p>
                  ) : (
                    riders.map((rider) => (
                      <label
                        key={rider.riderId}
                        className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-accent/40"
                      >
                        <input
                          type="radio"
                          name="rider"
                          checked={riderId === rider.riderId}
                          onChange={() => setRiderId(rider.riderId)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {rider.fullName}{" "}
                            <span className="text-[11px] font-normal text-muted-foreground">
                              {rider.vehicleType.replace(/_/g, " ").toLowerCase()}
                            </span>
                          </span>
                          <span className="num block text-[11px] text-muted-foreground">
                            {rider.phone || "—"} · load {rider.currentLoad}/{rider.maxCapacity} ·
                            rating {rider.rating.toFixed(1)}
                          </span>
                        </span>
                        <span className="num shrink-0 text-right text-[11px]">
                          <span className="block font-semibold">
                            {rider.distanceMeters >= 0
                              ? `${(rider.distanceMeters / 1000).toFixed(1)} km`
                              : "—"}
                          </span>
                          <span className={rider.online ? "text-success" : "text-muted-foreground"}>
                            {rider.online ? "online" : "offline"}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[13px] font-semibold">Payout mode (required)</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["AUTOMATED", "MANUAL"] as DeliveryPayoutMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPayoutMode(mode)}
                      className={`rounded-lg border p-3 text-left text-[12px] transition-colors ${
                        payoutMode === mode
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-accent/40"
                      }`}
                    >
                      <span className="block font-semibold">{mode}</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {mode === "AUTOMATED"
                          ? "System calculates fare from distance + rate card."
                          : "Admin records the travelled distance and pays the rider manually."}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="num text-[12px] text-muted-foreground">
                  Rate-card preview:{" "}
                  <span className="font-semibold text-foreground">
                    {selected.calculatedFarePaisa != null
                      ? formatINR(selected.calculatedFarePaisa)
                      : "Calculated at allocation"}
                  </span>
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void allocate()}
                  disabled={busy || !riderId || !payoutMode}
                >
                  {busy ? "Allocating…" : "Allocate rider"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
