import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Account security",
  "Change the superadmin portal password. The initial shared password must be rotated on first sign-in.",
);

export default function Page() {
  return <PageClient />;
}
