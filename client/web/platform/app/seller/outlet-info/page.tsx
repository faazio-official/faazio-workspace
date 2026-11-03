import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("Outlet info", "Your shop's profile, address and operating details.");

export default function Page() {
  return <PageClient />;
}