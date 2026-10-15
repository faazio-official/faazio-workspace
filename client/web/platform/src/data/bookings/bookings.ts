// Provenance: bookings.tables
import type { BookingRecord } from "@/data/types";

const FEE_PER_SEAT = 50;

const rows: Omit<BookingRecord, "seats" | "fee" | "paymentStatus">[] = [
  {
    bookingId: "BKG-2001",
    userId: "user-1",
    sellerId: "sel-3",
    storeId: "store-f1",
    venueName: "Spice Route Kitchen",
    customerName: "Rohit Sharma",
    city: "Bengaluru",
    stateCode: "KA",
    bookingDate: "2026-10-02",
    slot: "19:30",
    guests: 4,
    status: "pending",
    createdAt: "2026-09-24T11:00:00.000Z",
  },
  {
    bookingId: "BKG-2002",
    userId: "user-2",
    sellerId: "sel-3",
    storeId: "store-f1",
    venueName: "Spice Route Kitchen",
    customerName: "Neha Kulkarni",
    city: "Bengaluru",
    stateCode: "KA",
    bookingDate: "2026-10-02",
    slot: "20:00",
    guests: 2,
    status: "confirmed",
    createdAt: "2026-09-23T18:30:00.000Z",
  },
  {
    bookingId: "BKG-2003",
    userId: "user-3",
    sellerId: "sel-3",
    storeId: "store-f1",
    venueName: "Spice Route Kitchen",
    customerName: "Arjun Mehta",
    city: "Bengaluru",
    stateCode: "KA",
    bookingDate: "2026-10-03",
    slot: "13:00",
    guests: 6,
    status: "rejected",
    createdAt: "2026-09-22T09:45:00.000Z",
  },
  {
    bookingId: "BKG-2004",
    userId: "user-1",
    sellerId: "sel-1",
    storeId: "store-m1",
    venueName: "Darling Mobiles Cafe",
    customerName: "Priya Joshi",
    city: "Mumbai",
    stateCode: "MH",
    bookingDate: "2026-10-04",
    slot: "17:00",
    guests: 2,
    status: "confirmed",
    createdAt: "2026-09-21T07:20:00.000Z",
  },
];

export const BOOKINGS: BookingRecord[] = rows.map((b) => ({
  ...b,
  seats: b.guests,
  fee: b.guests * FEE_PER_SEAT,
  paymentStatus:
    b.status === "confirmed" ? "CAPTURED" : b.status === "rejected" ? "REFUNDED" : "AUTHORIZED",
}));
