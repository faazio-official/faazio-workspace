import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Promotions", "Festival opt-in per product, validated against the admin discount cap for your sector.");

export default function Page() {
  return <PageClient />;
}
