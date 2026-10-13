import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Shop analytics", "Revenue and order trends, conversion funnel, product performance, returns and ad ROI.");

export default function Page() {
  return <PageClient />;
}
