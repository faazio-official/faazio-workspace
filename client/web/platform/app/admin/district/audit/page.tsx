import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("State audit log", "Every admin and seller-affecting action recorded with before and after values.");

export default function Page() {
  return <PageClient />;
}
