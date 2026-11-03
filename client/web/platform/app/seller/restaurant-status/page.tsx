import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Store status", "Go online or offline, manage own-delivery and delivery settings.");

export default function Page() {
  return <PageClient />;
}