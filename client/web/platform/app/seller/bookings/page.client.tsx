"use client";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
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
import { formatDateTime } from "@/lib/format";
import { useMockLoading, useBookings } from "@/lib/api/hooks";
import { setBookingStatus } from "@/lib/api";
import { useSession } from "@/lib/hooks/useSession";
import type { BookingStatus } from "@/data/types";

function SellerBookings() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-3";
  const loading = useMockLoading();
  const bookings = useBookings({ sellerId });

  const moderate = (bookingId: string, status: BookingStatus) => {
    setBookingStatus(bookingId, status);
    toast.success(`Booking ${bookingId} ${status}`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bookings"
        description="Confirm or cancel table reservations. Cancelled slots are released back to inventory."
      />

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={bookings.length === 0}
          empty={
            <EmptyState
              title="No bookings yet"
              description="Reservations made at your venues land in this queue."
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
                <TableHead>Slot</TableHead>
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
                  <TableCell>{b.customerName}</TableCell>
                  <TableCell className="num">{b.bookingDate}</TableCell>
                  <TableCell className="num">{b.slot}</TableCell>
                  <TableCell className="num text-right">{b.guests}</TableCell>
                  <TableCell>
                    <StatusPill status={b.status} />
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={b.status === "confirmed" || b.status === "cancelled"}
                      onClick={() => moderate(b.bookingId, "confirmed")}
                    >
                      Confirm
                    </Button>
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

export default SellerBookings;