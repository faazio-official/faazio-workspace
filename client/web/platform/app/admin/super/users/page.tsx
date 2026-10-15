import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Users",
  "Platform-wide customer monitoring — order counts, spend and recency across every state (PII-safe).",
);

export default function Page() {
  return <PageClient />;
}