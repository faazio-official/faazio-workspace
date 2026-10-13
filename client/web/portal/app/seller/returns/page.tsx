import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Returns", "RMA queue with reason codes and refund-from-settlement preview.");

export default function Page() {
  return <PageClient />;
}
