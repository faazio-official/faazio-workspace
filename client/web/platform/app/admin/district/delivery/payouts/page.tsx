import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Delivery payouts",
  "Settle automated and manual rider payouts in your district.",
);

export default function Page() {
  return <PageClient />;
}
