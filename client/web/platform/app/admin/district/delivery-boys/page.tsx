import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Delivery partners",
  "State-scoped rider KYC review and live availability.",
);

export default function Page() {
  return <PageClient />;
}
