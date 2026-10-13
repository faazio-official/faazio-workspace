// 'use client'
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/AdminShell";

export const Route = createFileRoute("/admin/super")({
  component: SuperAdminLayout,
});

function SuperAdminLayout() {
  return (
    <AdminShell scope="SUPER">
      <Outlet />
    </AdminShell>
  );
}
