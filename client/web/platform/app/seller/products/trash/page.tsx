import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Trash",
  "Restore a deleted listing within 7 days before it is permanently removed.",
);

export default function Page() {
  return <PageClient />;
}
