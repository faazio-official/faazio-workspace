/**
 * Last-click sponsored-slot attribution. The sponsored rail records the slot a shopper tapped; the
 * cart reads it once at checkout so the server can credit `ads.sponsored_slots.orders_attributed`
 * (closed-loop retail media). Module state only — never persisted, never PII, consumed once.
 */
let lastClickedSlotId: string | undefined;

export function setLastClickedSlotId(slotId: string | undefined): void {
  lastClickedSlotId = slotId;
}

/** Read and clear the last-clicked slot (consume-once so a stale tap can't attribute a later order). */
export function consumeLastClickedSlotId(): string | undefined {
  const id = lastClickedSlotId;
  lastClickedSlotId = undefined;
  return id;
}