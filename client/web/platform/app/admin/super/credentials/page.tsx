import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Portal credentials",
  "Issue and manage seller and state-admin logins for the Faazio partner portal.",
);

export default function Page() {
  return <PageClient />;
}
