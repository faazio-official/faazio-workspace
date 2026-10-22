import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Delivery partners",
  "All-India rider KYC review, activation and live availability.",
);

export default function Page() {
  return <PageClient />;
}
