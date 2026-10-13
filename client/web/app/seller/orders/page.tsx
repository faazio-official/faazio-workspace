import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Orders", "Pipeline board from new to delivered, with SLA countdown and cancellations.");

export default function Page() {
  return <PageClient />;
}
