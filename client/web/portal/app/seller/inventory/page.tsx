import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Inventory", "Stock counts, low-stock alerts, bulk top-up and delivery ETA per listing.");

export default function Page() {
  return <PageClient />;
}
