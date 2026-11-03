import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Business Hub",
  "Sales, funnel, service quality and kitchen insights for your Faazio shop.",
);

export default function Page() {
  return <PageClient />;
}