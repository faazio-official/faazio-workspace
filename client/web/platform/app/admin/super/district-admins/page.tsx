import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("District admin accounts", "Create, edit, deactivate and delete Tiruchirappalli (TTC) district admin accounts, with coverage warnings.");

export default function Page() {
  return <PageClient />;
}
