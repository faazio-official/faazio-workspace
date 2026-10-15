import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Order detail", "Items, redacted address, status timeline and SLA countdown.");

export default function Page() {
  return <PageClient />;
}
