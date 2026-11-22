import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Add‑on queue", "Approve or reject add‑ons submitted by sellers in your district.");

export default function Page() {
  return <PageClient />;
}
