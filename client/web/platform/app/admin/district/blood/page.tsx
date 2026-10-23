import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Blood bank",
  "Moderate the public blood-request board for your district and remove stale posts.",
);

export default function Page() {
  return <PageClient />;
}