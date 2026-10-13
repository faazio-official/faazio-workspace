import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("State festival campaigns", "Create state campaigns inside the global discount caps and approve seller opt-ins.");

export default function Page() {
  return <PageClient />;
}
