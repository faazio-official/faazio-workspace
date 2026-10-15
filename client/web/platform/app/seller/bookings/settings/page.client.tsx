"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveBookingConfig } from "@/lib/api";
import { useBookingConfig, useStores } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";

const PRESETS = [
  { label: "9:00 AM – 5:00 PM", openTime: "09:00", closeTime: "17:00" },
  { label: "9:00 AM – 9:00 PM", openTime: "09:00", closeTime: "21:00" },
  { label: "12:00 PM – 11:00 PM", openTime: "12:00", closeTime: "23:00" },
];

function BookingSettings() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-3";
  const stores = useStores({ sellerId });

  const [vendorId, setVendorId] = useState(stores[0]?.storeId ?? "");
  const config = useBookingConfig(vendorId);

  // Keep the selected venue valid as the store list hydrates from the gateway.
  useEffect(() => {
    const first = stores[0]?.storeId;
    if (first && !stores.some((s) => s.storeId === vendorId)) {
      setVendorId(first);
    }
  }, [stores, vendorId]);

  const [enabled, setEnabled] = useState(config.enabled);
  const [totalSeats, setTotalSeats] = useState(config.totalSeats);
  const [trackOccupancy, setTrackOccupancy] = useState(config.trackOccupancy);
  const [openTime, setOpenTime] = useState(config.openTime);
  const [closeTime, setCloseTime] = useState(config.closeTime);
  const [paused, setPaused] = useState(config.paused);

  // Re-seed the form when the selected vendor (or its stored config) changes.
  useEffect(() => {
    setEnabled(config.enabled);
    setTotalSeats(config.totalSeats);
    setTrackOccupancy(config.trackOccupancy);
    setOpenTime(config.openTime);
    setCloseTime(config.closeTime);
    setPaused(config.paused);
  }, [config]);

  const save = () => {
    if (!vendorId) {
      toast.error("Pick a venue first");
      return;
    }
    saveBookingConfig({
      vendorId,
      sellerId,
      enabled,
      totalSeats,
      trackOccupancy,
      openTime,
      closeTime,
      paused,
    });
    toast.success("Booking settings saved");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Booking settings"
        description="One number drives everything: total seats. Requests hold ₹50/seat until you accept."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/seller/bookings">Back to queue</Link>
          </Button>
        }
      />

      {stores.length === 0 ? (
        <SectionCard title="No venue attached">
          <p className="text-[13px] text-muted-foreground">
            Add a venue before you can offer seat bookings.
          </p>
        </SectionCard>
      ) : (
        <SectionCard title="Venue bookings">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="vendor">Venue</Label>
              <select
                id="vendor"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-[13px]"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
              >
                {stores.map((s) => (
                  <option key={s.storeId} value={s.storeId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <Label htmlFor="offer">Offer seat bookings?</Label>
                <p className="text-[12px] text-muted-foreground">
                  Show a “Reserve seats • ₹50/seat” option on your venue.
                </p>
              </div>
              <Switch id="offer" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="seats">Total seats</Label>
                <Input
                  id="seats"
                  type="number"
                  min={0}
                  max={500}
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(Math.max(0, Math.min(500, Number(e.target.value) || 0)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preset">Timings</Label>
                <select
                  id="preset"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-[13px]"
                  value=""
                  onChange={(e) => {
                    const p = PRESETS.find((x) => x.label === e.target.value);
                    if (p) {
                      setOpenTime(p.openTime);
                      setCloseTime(p.closeTime);
                    }
                  }}
                >
                  <option value="">Custom</option>
                  {PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="open">Opens</Label>
                <Input id="open" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="close">Closes</Label>
                <Input id="close" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
              <Checkbox
                checked={trackOccupancy}
                onCheckedChange={(v) => setTrackOccupancy(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="text-[13px] font-medium">Track filled seats</span>
                <p className="text-[12px] text-muted-foreground">
                  Uncheck to skip clearing during a rush — accepted seats stop counting toward occupancy.
                </p>
              </span>
            </label>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <Label htmlFor="pause">Pause new bookings</Label>
                <p className="text-[12px] text-muted-foreground">
                  Instantly stop new requests without turning bookings off.
                </p>
              </div>
              <Switch id="pause" checked={paused} onCheckedChange={setPaused} />
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={save}>
                Save settings
              </Button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export default BookingSettings;