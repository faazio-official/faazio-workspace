import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Global command center", "Platform GMV, orders, seller supply, state health matrix and festival governance overview.");

export default function Page() {
  return <PageClient />;
}
