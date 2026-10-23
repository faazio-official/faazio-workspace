import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/AdminShell";

export default function DistrictAdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell scope="DISTRICT">{children}</AdminShell>;
}
