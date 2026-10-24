import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Manual delivery allocation",
  "Allocate riders across every district by road distance and choose the payout mode.",
);

export default function Page() {
  return <PageClient />;
}
