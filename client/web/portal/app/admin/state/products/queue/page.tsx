import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Listing approvals", "Approve or reject new product listings waiting for review in your state.");

export default function Page() {
  return <PageClient />;
}
