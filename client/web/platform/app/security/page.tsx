import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Account security",
  "Change your Faazio portal password. Temporary passwords issued by a superadmin must be rotated on first sign-in.",
);

export default function Page() {
  return <PageClient />;
}
