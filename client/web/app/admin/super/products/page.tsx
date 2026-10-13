import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Global catalog", "Moderate any listing on the platform, including bulk actions per sector.");

export default function Page() {
  return <PageClient />;
}
