import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Consumer app coverage", "Every surface in the Faazio app mapped to the data table that feeds it and who maintains it.");

export default function Page() {
  return <PageClient />;
}
