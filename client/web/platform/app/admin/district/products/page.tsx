import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("District catalog moderation", "Edit or remove any product listed by sellers in your district.");

export default function Page() {
  return <PageClient />;
}
