import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("State catalog moderation", "Edit or remove any product listed by sellers in your state.");

export default function Page() {
  return <PageClient />;
}
