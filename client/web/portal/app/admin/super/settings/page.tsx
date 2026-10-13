import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Platform settings", "Commission, TCS, FaazioCoin earn and redeem rates and the dispatch SLA threshold.");

export default function Page() {
  return <PageClient />;
}
