import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("State admin accounts", "Create, edit, deactivate and delete state admin accounts, with per-state coverage warnings.");

export default function Page() {
  return <PageClient />;
}
