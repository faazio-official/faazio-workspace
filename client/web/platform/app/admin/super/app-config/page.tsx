import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "App config",
  "The central remote config every Faazio app reads on boot — change app settings with no app-store release.",
);

export default function Page() {
  return <PageClient />;
}