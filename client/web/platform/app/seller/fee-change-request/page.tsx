import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Platform fee",
  "Request a platform-fee change for one of your shops and track the admin review.",
);

export default function Page() {
  return <PageClient />;
}
