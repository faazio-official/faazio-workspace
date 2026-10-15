import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Prescriptions",
  "Verify and fulfil uploaded prescriptions for your pharmacy stores.",
);

export default function Page() {
  return <PageClient />;
}