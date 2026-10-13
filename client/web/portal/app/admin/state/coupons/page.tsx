import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("State coupons", "Issue and retire cart coupons that apply only inside your state.");

export default function Page() {
  return <PageClient />;
}
