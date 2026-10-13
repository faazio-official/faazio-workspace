import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("My products", "Search, filter and manage every listing you supply to the Faazio app.");

export default function Page() {
  return <PageClient />;
}
