import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("District admin accounts", "Create, edit, deactivate and delete district admin accounts, with per-district coverage warnings.");

export default function Page() {
  return <PageClient />;
}
