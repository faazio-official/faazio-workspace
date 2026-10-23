// Provenance: payments.settlement_ledger + payments.payouts
import type { LedgerEntry, PayoutRecord } from "@/data/types";
import { SELLERS } from "@/data/sellers/sellers";
import { seededInt } from "@/lib/seed";

const CYCLES = ["2026-W34", "2026-W35", "2026-W36", "2026-W37"];

export const LEDGER: LedgerEntry[] = SELLERS.flatMap((seller) =>
  CYCLES.map((cycle) => {
    const orderValuePaisa = seededInt(`ledger:${seller.sellerId}:${cycle}`, 120000, 4800000);
    const commissionPaisa = Math.round(orderValuePaisa * 0.08);
    const tcsPaisa = Math.round(orderValuePaisa * 0.01);
    const tdsPaisa = Math.round(orderValuePaisa * 0.001);
    const productTaxPaisa = Math.round(orderValuePaisa * (5 / 105));
    const platformGstPaisa = Math.round(commissionPaisa * 0.18);
    return {
      entryId: `led-${seller.sellerId}-${cycle}`,
      sellerId: seller.sellerId,
      cycle,
      orderValuePaisa,
      commissionPaisa,
      tcsPaisa,
      tdsPaisa,
      productTaxPaisa,
      platformGstPaisa,
      netPayoutPaisa: orderValuePaisa - commissionPaisa - tcsPaisa - tdsPaisa,
    };
  }),
);

export const PAYOUTS: PayoutRecord[] = LEDGER.map((entry, index) => ({
  payoutId: `pay-${entry.entryId}`,
  sellerId: entry.sellerId,
  cycle: entry.cycle,
  amountPaisa: entry.netPayoutPaisa,
  status: index % 4 === 3 ? "SCHEDULED" : index % 7 === 0 ? "ON_HOLD" : "PAID",
  scheduledFor: "2026-09-15T06:00:00.000Z",
}));
