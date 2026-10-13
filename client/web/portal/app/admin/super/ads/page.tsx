import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Sponsored slots", "Approve, reject or pause every sponsored placement across the platform.");

export default function Page() {
  return <PageClient />;
}
