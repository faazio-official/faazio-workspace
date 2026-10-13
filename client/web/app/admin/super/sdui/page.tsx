import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "App content (SDUI)",
  "Publish server-driven home layouts that the mobile app renders at runtime.",
);

export default function Page() {
  return <PageClient />;
}