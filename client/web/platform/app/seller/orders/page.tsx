import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Orders",
  "Live orders grouped by stage, with accept/reject and advance actions.",
);

export default function Page() {
  return <PageClient />;
}