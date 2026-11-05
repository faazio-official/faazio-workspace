import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Manual payouts",
  "Record manual seller and delivery-rider payouts with balance carry-forward.",
);

export default function Page() {
  return <PageClient />;
}