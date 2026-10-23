import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Orders monitor", "Live SLA breaches, escalations and seller response times in your district.");

export default function Page() {
  return <PageClient />;
}
