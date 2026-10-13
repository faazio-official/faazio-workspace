import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("List a new product", "Five steps: category, details, pricing, inventory, then submit for review.");

export default function Page() {
  return <PageClient />;
}
