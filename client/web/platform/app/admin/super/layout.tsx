import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/AdminShell";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell scope="SUPER">{children}</AdminShell>;
}
