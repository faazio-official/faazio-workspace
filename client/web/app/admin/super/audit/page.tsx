import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Global audit log", "Immutable record of every action, filterable by actor, role and entity.");

export default function Page() {
  return <PageClient />;
}
