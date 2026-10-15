import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Seller dashboard", "Today's orders, GMV, dispatch queue, health scorecard and 30-day trend for your Faazio shop.");

export default function Page() {
  return <PageClient />;
}
