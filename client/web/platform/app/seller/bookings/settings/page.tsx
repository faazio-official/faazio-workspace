import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata(
  "Booking settings",
  "Opt your venue into seat bookings, set total seats, timings, occupancy tracking and the rush pause.",
);

export default function Page() {
  return <PageClient />;
}