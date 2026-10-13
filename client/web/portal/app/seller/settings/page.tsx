import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Seller settings", "Business profile, bank account, notification and sub-user settings.");

export default function Page() {
  return <PageClient />;
}
