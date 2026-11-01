import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Settings",
  "Your district scope and the console theme for this device.",
);

export default function Page() {
  return <PageClient />;
}
