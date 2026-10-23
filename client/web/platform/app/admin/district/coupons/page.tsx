import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("District coupons", "Issue and retire cart coupons that apply only inside your district.");

export default function Page() {
  return <PageClient />;
}
