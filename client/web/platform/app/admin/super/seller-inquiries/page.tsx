import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Seller enquiries",
  "Landing-page Sell with us enquiries across every district, with call-back ownership and the decision to open an application.",
);

export default function Page() {
  return <PageClient />;
}
