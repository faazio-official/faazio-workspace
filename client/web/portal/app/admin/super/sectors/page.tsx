import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Sector master", "Govern sectors and categories: rename, merge and review their price bands.");

export default function Page() {
  return <PageClient />;
}
