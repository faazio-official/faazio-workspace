import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Users",
  "Platform-wide customer monitoring — search by name, phone or user id and read order counts, spend and recency across every state.",
);

export default function Page() {
  return <PageClient />;
}