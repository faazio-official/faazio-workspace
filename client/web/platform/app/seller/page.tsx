import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Seller orders", "Manage live orders, menu and payouts for your Faazio shop.");

export default function Page() {
  redirect("/seller/orders");
}
