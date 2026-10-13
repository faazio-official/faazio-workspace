import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Edit product", "Update listing details, pricing and prescription flags.");

export default function Page() {
  return <PageClient />;
}
