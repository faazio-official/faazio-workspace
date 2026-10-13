import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Festival governance", "Set per-sector discount caps, run global campaigns and watch opt-in volume and uplift.");

export default function Page() {
  return <PageClient />;
}
