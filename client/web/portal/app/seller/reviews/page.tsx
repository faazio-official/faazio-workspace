import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Reviews", "Rating breakdown, replies to shoppers and flagging abusive reviews to admins.");

export default function Page() {
  return <PageClient />;
}
