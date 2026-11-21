import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "GST rates",
  "The superadmin-owned GST rate pick-list: one named slab per sector that every category links to.",
);

export default function Page() {
  return <PageClient />;
}
