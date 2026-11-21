import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "District coverage",
  "The authoritative district master — create, rename, deactivate and delete platform districts.",
);

export default function Page() {
  return <PageClient />;
}
