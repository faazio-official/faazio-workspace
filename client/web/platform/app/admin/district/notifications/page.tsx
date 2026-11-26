import { pageMetadata } from "@/lib/seo";
import { AdminNotificationsConsole } from "@/components/admin/AdminNotificationsConsole";

export const metadata = pageMetadata(
  "Notifications",
  "Cross-user notification outbox: delivery status and retry attempts across the gateway.",
);

export default function Page() {
  return <AdminNotificationsConsole />;
}
