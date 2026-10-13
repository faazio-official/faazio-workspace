import { pageMetadata } from "@/lib/seo";
import PageClient from "./page.client";

export const metadata = pageMetadata("State analytics", "GMV by day, sector and city, seller leaderboard, onboarding funnel and returns pressure.");

export default function Page() {
  return <PageClient />;
}
