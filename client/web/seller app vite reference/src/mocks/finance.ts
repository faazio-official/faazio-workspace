export interface PayoutCycle {
  id: string;
  range: string;
  netPayout: number;
  orders: number;
  payoutFor: string;
  payoutDate: string;
  status: "PAID" | "PENDING";
  breakdown: { label: string; amount: number }[];
}

export const currentCycle = {
  label: "Est. payout (26 Oct - 01 Nov)",
  amount: 1782.1,
  orders: 11,
  payoutFor: "26 Oct - 01 Nov'26",
  payoutDate: "04 Nov'26, by 9PM",
};

const bd = (gross: number) => [
  { label: "Customer payable", amount: gross },
  { label: "Service fee (25%)", amount: -+(gross * 0.25).toFixed(2) },
  { label: "Payment mechanism fee", amount: -+(gross * 0.0184).toFixed(2) },
  { label: "Taxes", amount: -+(gross * 0.045).toFixed(2) },
];

export const pastCycles: PayoutCycle[] = [
  { id: "c1", range: "19 Oct - 25 Oct'26", netPayout: 2305.5, orders: 13, payoutFor: "19 - 25 Oct'26", payoutDate: "28 Oct'26", status: "PAID", breakdown: bd(3367) },
  { id: "c2", range: "12 Oct - 18 Oct'26", netPayout: 4445.23, orders: 30, payoutFor: "12 - 18 Oct'26", payoutDate: "21 Oct'26", status: "PAID", breakdown: bd(6490) },
  { id: "c3", range: "05 Oct - 11 Oct'26", netPayout: 5350.71, orders: 36, payoutFor: "05 - 11 Oct'26", payoutDate: "14 Oct'26", status: "PAID", breakdown: bd(7812) },
  { id: "c4", range: "28 Sep - 04 Oct'26", netPayout: 6591.93, orders: 35, payoutFor: "28 Sep - 04 Oct'26", payoutDate: "07 Oct'26", status: "PAID", breakdown: bd(9624) },
  { id: "c5", range: "21 Sep - 27 Sep'26", netPayout: 7045.63, orders: 41, payoutFor: "21 - 27 Sep'26", payoutDate: "30 Sep'26", status: "PAID", breakdown: bd(10287) },
];

export type InvoiceType = "online-ordering" | "ads" | "recovery" | "tds";

export const invoiceGroups: { type: InvoiceType; title: string; sub: string; section: "invoices" | "tax" }[] = [
  { type: "online-ordering", title: "Online ordering", sub: "Monthly commission invoices on an outlet level", section: "invoices" },
  { type: "ads", title: "Ads invoice", sub: "Monthly Ads invoices on a Legal entity level", section: "invoices" },
  { type: "recovery", title: "Recovery", sub: "Monthly recovery invoices on an outlet level", section: "invoices" },
  { type: "tds", title: "TDS", sub: "Tax deducted at source for products & services", section: "tax" },
];

export const invoices: Record<InvoiceType, { title: string; fy: string; items: { month: string; ref: string }[] }> = {
  "online-ordering": { title: "Online ordering invoices", fy: "Financial year: 2026", items: [{ month: "September, 2026", ref: "ZOM/OO/2026/09/22868390" }, { month: "August, 2026", ref: "ZOM/OO/2026/08/22868390" }] },
  ads: { title: "Ads invoices", fy: "Financial year: 2026", items: [] },
  recovery: { title: "Recovery invoices", fy: "Financial year: 2026", items: [{ month: "September, 2026", ref: "ZOM/RC/2026/09/22868390" }] },
  tds: { title: "TDS", fy: "", items: [] },
};

export const feeInfo = {
  restaurantId: "22868390",
  baseServiceFee: "25%",
  paymentGateway: "1.84%",
  compensation: [
    { cond: "If the order was picked up by the delivery partner", value: "100% of net order value" },
    { cond: "If the order was not picked up by the delivery partner and the restaurant had more than 80% 'Order ready' marking accuracy in the previous week, or the order was marked 'Order ready'", value: "80% of net order value" },
    { cond: "If the order was not picked up by the delivery partner and the restaurant had less than 80% 'Order ready' marking accuracy in the previous week, or the order was not marked 'Order ready'", value: "40% of net order value" },
    { cond: "If the customer cancelled the order within 1 minute or the restaurant accepted the cancellation request", value: "No compensation" },
  ],
  rejection: [
    { cond: "If weekly restaurant partner rejected orders exceed 0.5% of weekly order volume:", value: "10% of the net order value of all restaurant partner rejected orders, for the relevant weeks." },
    { cond: "If weekly restaurant partner rejected orders exceed 2% of weekly order volume:", value: "25% of the net order value of all restaurant partner rejected orders, for the relevant weeks." },
  ],
};
