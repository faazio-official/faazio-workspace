// 'use client'
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/AdminShell";

export const Route = createFileRoute("/admin/state")({
  component: StateAdminLayout,
});

function StateAdminLayout() {
  return (
    <AdminShell scope="STATE">
      <Outlet />
    </AdminShell>
  );
}
