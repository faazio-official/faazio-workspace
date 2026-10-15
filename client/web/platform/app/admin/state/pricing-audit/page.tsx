import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Pricing audit", "Flag MRP inflation and discount abuse against the category median price.");

export default function Page() {
  return <PageClient />;
}
