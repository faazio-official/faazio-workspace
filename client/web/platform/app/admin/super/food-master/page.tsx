import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Food master data",
  "The FOOD catalogue reference data: atomic cuisine taxonomy, store onboarding rules and sample dish templates.",
);

export default function Page() {
  return <PageClient />;
}
