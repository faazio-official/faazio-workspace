import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Order detail",
  "One order's status, SLA, line items and delivery rider — answer a customer's delivery question.",
);

export default function Page() {
  return <PageClient />;
}
