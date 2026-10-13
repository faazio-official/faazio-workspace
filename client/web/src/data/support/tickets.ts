// Provenance: support.tickets (state_code from 0017). Seed fallback for the state/super support
// queue; the gateway hydrates real rows when configured.
import type { TicketRecord } from "@/data/types";

export const TICKETS: TicketRecord[] = [
  { ticketId: "tkt-1001", userId: "user-1", stateCode: "MH", subject: "Late delivery", body: "Order arrived 40 minutes after the SLA window.", status: "OPEN", createdAt: "2026-09-12T10:05:00.000Z" },
  { ticketId: "tkt-1002", userId: "user-1021", sellerId: "sel-1", stateCode: "MH", subject: "Missing item", body: "One line item was missing from the bag.", status: "IN_PROGRESS", createdAt: "2026-09-11T19:12:00.000Z" },
  { ticketId: "tkt-1003", userId: "user-1044", stateCode: "KA", subject: "Refund not received", body: "Return was approved but the refund has not landed.", status: "OPEN", createdAt: "2026-09-10T15:30:00.000Z" },
  { ticketId: "tkt-1004", userId: "user-1077", sellerId: "sel-2", stateCode: "KA", subject: "Prescription rejected", body: "Uploaded a valid prescription but it was rejected.", status: "RESOLVED", createdAt: "2026-09-09T08:45:00.000Z" },
  { ticketId: "tkt-1005", userId: "user-1092", stateCode: "DL", subject: "App crash at checkout", body: "Checkout screen froze when applying a coupon.", status: "CLOSED", createdAt: "2026-09-08T21:00:00.000Z" },
];