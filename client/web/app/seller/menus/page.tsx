import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Menu",
  "Edit the dishes shoppers see for each food venue — price, veg flag, cuisine and listing status.",
);

export default function Page() {
  return <PageClient />;
}