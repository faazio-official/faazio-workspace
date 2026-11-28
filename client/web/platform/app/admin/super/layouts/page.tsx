import type { Metadata } from "next";
import SduiLayoutsPage from "./page.client";

export const metadata: Metadata = {
  title: "Layout control plane · Faazio Super Admin",
  description:
    "Versioned SDUI layout publishing: slot map, district targeting, JSON import/export and one-click rollback.",
};

export default function Page() {
  return <SduiLayoutsPage />;
}
