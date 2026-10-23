import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Customers",
  "Monitor customer activity in your district — order counts, spend and recency (PII-safe view).",
);

export default function Page() {
  return <PageClient />;
}