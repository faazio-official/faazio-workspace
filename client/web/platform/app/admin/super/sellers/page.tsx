import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("All sellers", "Global seller list with power to approve, suspend or override state decisions.");

export default function Page() {
  return <PageClient />;
}
