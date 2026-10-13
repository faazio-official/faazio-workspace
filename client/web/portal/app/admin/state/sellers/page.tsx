import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("State sellers", "Seller supply funnel by status, with KYC review and suspension actions.");

export default function Page() {
  return <PageClient />;
}
