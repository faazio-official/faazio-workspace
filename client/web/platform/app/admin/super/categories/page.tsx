import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Categories",
  "The central superadmin-owned category taxonomy (Mart, Food, Pharma) every app and seller reads.",
);

export default function Page() {
  return <PageClient />;
}
