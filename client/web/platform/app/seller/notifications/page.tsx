import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Notifications", "Updates about your outlet.");

export default function Page() {
  return <PageClient />;
}