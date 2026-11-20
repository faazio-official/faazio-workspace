import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Seller leads",
  "Enquiries from the Sell with us page in your district, with call-back tracking.",
);

export default function Page() {
  return <PageClient />;
}
