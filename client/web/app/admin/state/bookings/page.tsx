import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Bookings monitor",
  "Oversee table reservations across venues in your state.",
);

export default function Page() {
  return <PageClient />;
}