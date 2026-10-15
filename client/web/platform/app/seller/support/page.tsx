import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Support", "Raise a ticket with the Faazio partner team and track replies.");

export default function Page() {
  return <PageClient />;
}
