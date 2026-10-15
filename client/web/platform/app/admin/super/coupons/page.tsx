import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Global coupons", "Issue platform-wide checkout coupons and retire any state coupon.");

export default function Page() {
  return <PageClient />;
}
