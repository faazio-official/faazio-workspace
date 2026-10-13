import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Bookings",
  "Confirm or cancel table reservations and food bookings for your venues.",
);

export default function Page() {
  return <PageClient />;
}