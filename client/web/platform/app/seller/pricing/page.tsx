import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Pricing", "Inline price and MRP editing, mass percentage changes and price-change history.");

export default function Page() {
  return <PageClient />;
}
