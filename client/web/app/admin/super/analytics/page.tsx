import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Global analytics", "Platform GMV and order trends, category performance, seller concentration and geo split.");

export default function Page() {
  return <PageClient />;
}
