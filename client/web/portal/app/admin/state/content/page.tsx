import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("State content curation", "Curate the rails and banners shoppers see on the home screen in your state.");

export default function Page() {
  return <PageClient />;
}
