import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Payments", "Settlement ledger per cycle: order value minus commission and TCS equals net payout.");

export default function Page() {
  return <PageClient />;
}
