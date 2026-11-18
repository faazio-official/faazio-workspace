import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Fee request history",
  "Every platform-fee change request you filed and where each one stands.",
);

export default function Page() {
  return <PageClient />;
}
