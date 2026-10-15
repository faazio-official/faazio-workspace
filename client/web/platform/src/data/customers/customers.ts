// Provenance: checkout.users_admin (PII-redacted projection: user_id, name, state, counts).
// Seed fallback for the customer-monitoring pages; the gateway hydrates real rows when configured.
import type { CustomerRecord } from "@/data/types";

export const CUSTOMERS: CustomerRecord[] = [
  { userId: "user-1", name: "Rohit Sharma", stateCode: "MH", ordersCount: 6, spendPaisa: 1842300, lastOrderAt: "2026-09-12T09:10:00.000Z", createdAt: "2025-11-02T08:00:00.000Z" },
  { userId: "user-1021", name: "Neha Kulkarni", stateCode: "MH", ordersCount: 4, spendPaisa: 975600, lastOrderAt: "2026-09-11T18:35:00.000Z", createdAt: "2026-01-14T09:30:00.000Z" },
  { userId: "user-1044", name: "Arjun Mehta", stateCode: "KA", ordersCount: 3, spendPaisa: 449700, lastOrderAt: "2026-09-10T14:20:00.000Z", createdAt: "2026-02-20T11:15:00.000Z" },
  { userId: "user-1077", name: "Priya Joshi", stateCode: "KA", ordersCount: 8, spendPaisa: 2310400, lastOrderAt: "2026-09-09T07:05:00.000Z", createdAt: "2025-12-05T10:00:00.000Z" },
  { userId: "user-1092", name: "Karthik Rao", stateCode: "DL", ordersCount: 2, spendPaisa: 320000, lastOrderAt: "2026-09-08T20:40:00.000Z", createdAt: "2026-03-11T16:45:00.000Z" },
];