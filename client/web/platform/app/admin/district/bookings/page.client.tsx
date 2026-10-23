"use client";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMockLoading, useBookings } from "@/lib/api/hooks";
import { setBookingStatus } from "@/lib/api";
import { useSession } from "@/lib/hooks/useSession";
import type { BookingStatus } from "@/data/types";

function StateBookings() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "KA";
  const loading = useMockLoading();
  const bookings = useBookings({ stateCode });

  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const guests = bookings.reduce((sum, b) => sum + b.guests, 0);

  const moderate = (bookingId: string, status: BookingStatus) => {
    setBookingStatus(bookingId, status);
    toast.success(`Booking ${bookingId} ${status}`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bookings monitor"
        description="Reservations across every venue in your district. Step in only when a vendor is unresponsive."
      />

      <KpiStrip
        items={[
          { label: "Total", value: String(bookings.length) },
          { label: "Pending", value: String(pending.length) },
          { label: "Confirmed", value: String(confirmed.length) },
          { label: "Cancelled", value: String(cancelled.length) },
          { label: "Guests", value: String(guests) },
        ]}
      />

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={bookings.length === 0}
          empty={
            <EmptyState
              title="No bookings in your district"
              description="Reservations across your venues appear here."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Guests</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.bookingId} className="h-12">
                  <TableCell className="font-medium">{b.bookingId}</TableCell>
                  <TableCell>{b.venueName}</TableCell>
                  <TableCell>{b.city}</TableCell>
                  <TableCell>{b.customerName}</TableCell>
                  <TableCell className="num">
                    {b.bookingDate} {b.slot}
                  </TableCell>
                  <TableCell className="num text-right">{b.guests}</TableCell>
                  <TableCell>
                    <StatusPill status={b.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={b.status === "cancelled"}
                      onClick={() => moderate(b.bookingId, "cancelled")}
                    >
                      Cancel
                    </Button>
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

export default StateBookings;