// Provenance: rewards.ledger (append-only, 0008). Seed fallback for the admin rewards ledger view;
// the gateway hydrates real rows when configured. The server is the only writer (checkout earn path).
import type { RewardLedgerEntry } from "@/data/types";

export const REWARDS_LEDGER: RewardLedgerEntry[] = [
  { entryId: "rw-9f1a2", type: "EARN", coins: 18, rupees: 0, orderId: "ORD-1042", at: "2026-09-12T09:12:00.000Z" },
  { entryId: "rw-9f1a1", type: "STREAK", coins: 0, rupees: 0, orderId: "ORD-1042", at: "2026-09-12T09:11:00.000Z" },
  { entryId: "rw-8c7b4", type: "REDEEM", coins: -200, rupees: 2, orderId: "ORD-1039", at: "2026-09-11T18:40:00.000Z" },
  { entryId: "rw-7a2d0", type: "EARN", coins: 34, rupees: 0, orderId: "ORD-1031", at: "2026-09-10T14:25:00.000Z" },
  { entryId: "rw-6b5e9", type: "EARN", coins: 12, rupees: 0, orderId: "ORD-1024", at: "2026-09-09T07:08:00.000Z" },
];