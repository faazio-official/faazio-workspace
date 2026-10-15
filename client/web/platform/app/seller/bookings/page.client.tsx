"use client";
import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { acceptBooking, rejectBooking, vacateBooking, saveBookingConfig } from "@/lib/api";
import { useMockLoading, useBookings, useBookingConfig, useStores } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";

function SellerBookings() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-3";
  const loading = useMockLoading();
  const bookings = useBookings({ sellerId });
  const stores = useStores({ sellerId });
  const vendorId = stores[0]?.storeId ?? bookings[0]?.storeId ?? "";
  const config = useBookingConfig(vendorId);

  // Pending requests first — the queue order is the triage.
  const sorted = useMemo(
    () =>
      [...bookings].sort(
        (a, b) => Number(b.status === "pending") - Number(a.status === "pending"),
      ),
    [bookings],
  );

  const confirmedSeats = useMemo(
    () => sorted.filter((b) => b.status === "confirmed").reduce((n, b) => n + b.seats, 0),
    [sorted],
  );
  const occupancyPct =
    config.trackOccupancy && config.totalSeats > 0
      ? Math.min(100, Math.round((confirmedSeats / config.totalSeats) * 100))
      : 0;

  const togglePause = () => {
    saveBookingConfig({ ...config, paused: !config.paused });
    toast[config.paused ? "success" : "warning"](
      config.paused ? "Bookings resumed" : "New booking requests paused",
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bookings"
        description="Accept or reject seat requests. The ₹50/seat fee is held at request and settled on accept."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/seller/bookings/settings">Booking settings</Link>
          </Button>
        }
      />

      {config.enabled && (
        <SectionCard
          title="Queue control"
          description={config.trackOccupancy ? "Occupancy clears when you mark a party vacated." : "Filled seats are not tracked."}
          actions={
            <label className="flex items-center gap-2 text-[12px] font-medium">
              {config.paused ? "Paused" : "Live"}
              <Switch checked={!config.paused} onCheckedChange={togglePause} aria-label="Pause new bookings" />
            </label>
          }
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>Occupied seats</span>
              <span className="num">
                {config.trackOccupancy ? `${confirmedSeats} / ${config.totalSeats}` : "not tracked"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-food" style={{ width: `${occupancyPct}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bookable window {config.openTime}–{config.closeTime}
            </p>
          </div>
        </SectionCard>
      )}

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={sorted.length === 0}
          empty={
            <EmptyState
              title="No bookings yet"
              description="Seat requests from the app land in this queue."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Seats</TableHead>
                <TableHead className="text-right">Fee held</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((b) => (
                <TableRow key={b.bookingId} className="h-12">
                  <TableCell className="font-medium">{b.bookingId}</TableCell>
                  <TableCell>{b.venueName}</TableCell>
                  <TableCell>{b.customerName}</TableCell>
                  <TableCell className="num">{b.bookingDate}</TableCell>
                  <TableCell className="num text-right">{b.seats}</TableCell>
                  <TableCell className="num text-right">₹{b.fee}</TableCell>
                  <TableCell>
                    <StatusPill status={b.status} />
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    {b.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => {
                            acceptBooking(b.bookingId);
                            toast.success(`Accepted ${b.bookingId} — ₹${b.fee} captured`);
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => {
                            rejectBooking(b.bookingId);
                            toast.message(`Rejected ${b.bookingId} — refund initiated`);
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {b.status === "confirmed" && config.trackOccupancy && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          vacateBooking(b.bookingId);
                          toast.success(`Marked ${b.bookingId} vacated`);
                        }}
                      >
                        Mark vacated
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default SellerBookings;