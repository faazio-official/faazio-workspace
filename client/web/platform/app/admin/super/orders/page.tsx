import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "All orders",
  "Every placed order across all districts — find a customer's order and answer delivery inquiries.",
);

export default function Page() {
  return <PageClient />;
}
