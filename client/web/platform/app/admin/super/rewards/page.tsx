import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Rewards",
  "Tune the platform-wide FaazioCoins program and review the server-authoritative coin ledger.",
);

export default function Page() {
  return <PageClient />;
}