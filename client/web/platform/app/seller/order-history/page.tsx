import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Order history", "Search past and closed orders across your outlet.");

export default function Page() {
  return <PageClient />;
}