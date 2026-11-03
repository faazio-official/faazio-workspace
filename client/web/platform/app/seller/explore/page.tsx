import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Explore more", "Every seller console tool in one grouped grid.");

export default function Page() {
  return <PageClient />;
}