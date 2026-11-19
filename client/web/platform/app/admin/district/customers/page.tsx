import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Customers",
  "Monitor customer activity in your district — search by name, phone or user id and read order counts, spend and recency.",
);

export default function Page() {
  return <PageClient />;
}