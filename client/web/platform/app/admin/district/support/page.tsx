import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Support",
  "Work the customer support queue for your district — triage, progress and close tickets.",
);

export default function Page() {
  return <PageClient />;
}