import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Stores", "Store profile, pickup hours, delivery time and live or paused state.");

export default function Page() {
  return <PageClient />;
}
