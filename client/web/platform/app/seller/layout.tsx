import type { ReactNode } from "react";
import { SellerAppShell } from "@/components/sellers/shells";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return <SellerAppShell>{children}</SellerAppShell>;
}