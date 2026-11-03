import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Restaurant Partner — Orders" }, { name: "description", content: "Manage live orders, menu and payouts for your restaurant." }, { property: "og:title", content: "Restaurant Partner" }, { property: "og:description", content: "Manage live orders, menu and payouts for your restaurant." }] }),
  beforeLoad: () => {
    throw redirect({ to: "/orders" });
  },
});
