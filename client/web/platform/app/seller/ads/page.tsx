import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Ads", "Request sponsored placements and track impressions, clicks and attributed orders.");

export default function Page() {
  return <PageClient />;
}
