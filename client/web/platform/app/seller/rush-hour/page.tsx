import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Rush in kitchen", "Get more prep time when your kitchen is busy.");

export default function Page() {
  return <PageClient />;
}