import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Delivery payouts",
  "Settle automated and manual rider payouts across every district.",
);

export default function Page() {
  return <PageClient />;
}
