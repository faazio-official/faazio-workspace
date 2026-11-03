import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Inventory",
  "Turn products in or out of stock, with ETA choices per item.",
);

export default function Page() {
  return <PageClient />;
}