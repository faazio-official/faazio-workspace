import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Fee change requests",
  "Review seller-initiated platform-fee changes across every district.",
);

export default function Page() {
  return <PageClient />;
}
