import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Seller onboarding", "Business details, KYC documents, bank account, store setup and e-sign in five steps.");

export default function Page() {
  return <PageClient />;
}
