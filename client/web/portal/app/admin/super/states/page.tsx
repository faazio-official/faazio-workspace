import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("State drilldown", "Per-state sellers, GMV, live campaigns and the admin roster in one view.");

export default function Page() {
  return <PageClient />;
}
