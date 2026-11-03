import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Rush mode", "Tell the platform your outlet is unusually busy so delivery times stay accurate.");

export default function Page() {
  return <PageClient />;
}