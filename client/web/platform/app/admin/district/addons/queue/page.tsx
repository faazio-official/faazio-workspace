import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Add-on approvals",
  "Approve or return new dish add-ons waiting for review in your district.",
);

export default function Page() {
  return <PageClient />;
}
