import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Seller KYC review", "Verify documents, GSTIN format and bank proof before approval.");

export default function Page() {
  return <PageClient />;
}
