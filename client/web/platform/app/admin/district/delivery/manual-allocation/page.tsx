import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Manual delivery allocation",
  "Allocate riders by road distance and choose automated or manual payout in your district.",
);

export default function Page() {
  return <PageClient />;
}
