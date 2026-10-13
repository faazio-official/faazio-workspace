import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/AdminShell";

export default function StateAdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell scope="STATE">{children}</AdminShell>;
}
