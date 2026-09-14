// 'use client'
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SellerShell } from "@/components/layout/SellerShell";

export const Route = createFileRoute("/seller")({
  component: SellerLayout,
});

function SellerLayout() {
  return (
    <SellerShell>
      <Outlet />
    </SellerShell>
  );
}
