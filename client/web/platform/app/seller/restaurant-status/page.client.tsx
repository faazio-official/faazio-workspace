"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Toggle, Sheet, RadioRow, TextField } from "@/components/sellers/kit";
import { useSellerUi } from "@/lib/sellerUi";
import { useSellerScope } from "@/lib/api/hooks";

const OFF_REASONS_FOOD = ["Kitchen is full", "Staff shortage", "Closing early today", "Technical issue", "Other"];
const OFF_REASONS_DEFAULT = ["Staff shortage", "Closing early today", "Inventory unavailable", "Technical issue", "Other"];

function RestaurantStatus() {
  const online = useSellerUi((s) => s.online);
  const rush = useSellerUi((s) => s.rush);
  const delivery = useSellerUi((s) => s.delivery);
  const { activeStore } = useSellerScope();
  const sector = activeStore?.sector;
  const offReasons = sector === "FOOD" ? OFF_REASONS_FOOD : OFF_REASONS_DEFAULT;
  const [off, setOff] = useState(false);
  const [reason, setReason] = useState<string>(offReasons[0]!);

  // The active shop can change under this page (StoreSwitcher in the header); keep the selected
  // offline reason valid for the active shop's sector.
  useEffect(() => {
    setReason((current) => (offReasons.includes(current) ? current : offReasons[0]!));
  }, [offReasons]);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(() => ({
    minOrder: String(delivery.minOrder),
    packagingCharge: String(delivery.packagingCharge),
    radiusKm: String(delivery.radiusKm),
  }));

  const storeHours = activeStore?.hours ?? "";
  const area = activeStore ? (activeStore.address ?? activeStore.sector) : "Seller console";

  return (
    <>
      <PageHeader title={sector === "FOOD" ? "Restaurant status" : "Store status"} />
      <div className="space-y-3 p-4 pb-10">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-bold">{activeStore?.name ?? "Your shop"}</p>
          <p className="text-[11px] text-muted-foreground">{area}</p>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span>
              <b className="text-sm">Delivery status</b>
              <br />
              <span className={`text-xs ${online ? "text-success" : "text-brand"}`}>
                {online ? "Online — receiving orders" : "Offline — not receiving orders"}
              </span>
            </span>
            <Toggle
              label="Delivery status"
              checked={online}
              onChange={(v) => (v ? (useSellerUi.getState().setOnline(true), toast.success("You're online")) : setOff(true))}
            />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span>
              <b className="text-sm">Self delivery</b>
              <br />
              <span className="text-xs text-muted-foreground">Deliver orders with your own riders</span>
            </span>
            <Toggle
              label="Self delivery"
              checked={false}
              onChange={() => toast("Own delivery is managed by the Faazio delivery network")}
            />
          </div>
          {sector === "FOOD" && (
            <Link
              href="/seller/rush-hour"
              className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm"
            >
              <b>Rush mode</b>
              <span className="flex items-center gap-1 text-xs">
                {rush.on ? `ON till ${rush.until}` : "OFF"}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          )}
          <Link href="/seller/stores" className="mt-3 block border-t border-border pt-3 text-xs">
            <span className="text-muted-foreground">Store hours</span>
            <br />
            <b>{storeHours || "Add via Stores → edit hours"}</b>
          </Link>
        </div>

        {!online && (
          <p className="flex gap-2 rounded-xl bg-brand-soft p-3 text-xs text-brand">
            <Info className="h-4 w-4 shrink-0" />
            You are currently offline. Customers cannot place orders.
          </p>
        )}

        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <div className="flex justify-between">
            <b>Delivery settings</b>
            <button onClick={() => setEdit(true)} className="text-xs font-semibold text-info">
              Edit
            </button>
          </div>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            <p>Minimum order: ₹{delivery.minOrder}</p>
            <p>Packaging charge: ₹{delivery.packagingCharge}</p>
            <p>Delivery radius: {delivery.radiusKm} km</p>
          </div>
        </div>

        <Link
          href="/seller/settings"
          className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm"
        >
          App settings <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <Sheet
        open={off}
        onClose={() => setOff(false)}
        title="Why are you going offline?"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setOff(false)}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
            >
              Back
            </button>
            <button
              onClick={() => {
                useSellerUi.getState().setOnline(false);
                setOff(false);
                toast.success("You're offline");
              }}
              className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
            >
              Go offline
            </button>
          </div>
        }
      >
        {offReasons.map((r) => (
          <RadioRow key={r} label={r} checked={reason === r} onClick={() => setReason(r)} />
        ))}
      </Sheet>

      <Sheet
        open={edit}
        onClose={() => setEdit(false)}
        title="Delivery settings"
        footer={
          <button
            onClick={() => {
              useSellerUi.getState().setDelivery({
                minOrder: Number(form.minOrder) || 0,
                packagingCharge: Number(form.packagingCharge) || 0,
                radiusKm: Number(form.radiusKm) || 0,
              });
              setEdit(false);
              toast.success("Delivery settings saved");
            }}
            className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
          >
            Save
          </button>
        }
      >
        <TextField
          label="Minimum order (₹)"
          type="number"
          value={form.minOrder}
          onChange={(v) => setForm({ ...form, minOrder: v })}
        />
        <TextField
          label="Packaging charge (₹)"
          type="number"
          value={form.packagingCharge}
          onChange={(v) => setForm({ ...form, packagingCharge: v })}
        />
        <TextField
          label="Delivery radius (km)"
          type="number"
          value={form.radiusKm}
          onChange={(v) => setForm({ ...form, radiusKm: v })}
        />
      </Sheet>
    </>
  );
}

export default RestaurantStatus;