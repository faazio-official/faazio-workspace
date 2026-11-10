import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Offers",
  "Product-first festival offers: join a live campaign and submit the discount you want to give.",
);

export default function Page() {
  return <PageClient />;
}
