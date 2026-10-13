// Provenance: admins.audit_logs (actor_id, actor_role, action, entity, before, after)
import type { AuditLog } from "@/data/types";

export const AUDIT_LOGS: AuditLog[] = [
  {
    logId: "log-1",
    actorId: "acc-2",
    actorRole: "STATE_ADMIN",
    action: "PRODUCT_DELIST",
    entity: "catalog.products",
    entityId: "fm-f1",
    before: '{"status":"ACTIVE"}',
    after: '{"status":"DELISTED","reason":"MRP inflation"}',
    createdAt: "2026-09-10T08:30:00.000Z",
  },
  {
    logId: "log-2",
    actorId: "acc-3",
    actorRole: "SUPER_ADMIN",
    action: "SECTOR_CAP_UPDATE",
    entity: "promo.festival_sector_caps",
    entityId: "cap-mart",
    before: '{"maxDiscountPercent":35}',
    after: '{"maxDiscountPercent":40}',
    createdAt: "2026-08-20T06:00:00.000Z",
  },
  {
    logId: "log-3",
    actorId: "acc-2",
    actorRole: "STATE_ADMIN",
    action: "SELLER_APPROVE",
    entity: "sellers.sellers",
    entityId: "sel-2",
    before: '{"status":"PENDING_REVIEW"}',
    after: '{"status":"ACTIVE"}',
    createdAt: "2026-01-20T10:15:00.000Z",
  },
  {
    logId: "log-4",
    actorId: "acc-1",
    actorRole: "SELLER",
    action: "PRICE_UPDATE",
    entity: "catalog.products",
    entityId: "md-1",
    before: '{"pricePaisa":149900}',
    after: '{"pricePaisa":129900}',
    createdAt: "2026-09-01T12:00:00.000Z",
  },
];
