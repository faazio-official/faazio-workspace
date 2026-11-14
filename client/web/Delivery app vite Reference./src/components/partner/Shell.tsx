import { Link, Navigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Bike, CalendarDays, Gift, ChevronRight, ShoppingBag, Radio, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { usePartner } from "@/lib/partner/store";
import { Button } from "@/components/ui/button";
import { UtilityPanel } from "./UtilityPanel";
import { cn } from "@/lib/utils";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loggedIn } = usePartner();
  if (!loggedIn) return <Navigate to="/login" />;
  return <>{children}</>;
}
export function TabPage({ title, right, children }: { title: string; center?: boolean; right?: ReactNode; children: ReactNode }) {
  return <RequireAuth><div className="flex min-h-screen flex-col pb-40">
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md"><UtilityPanel /><header className="flex h-12 items-center justify-between border-b bg-card px-4">
      <h1 className="text-base font-bold">{title}</h1>{right}
    </header></div><main className="flex-1">{children}</main><BottomNav raised={title === "Gigs"} />
  </div></RequireAuth>;
}
export function BackHeader({ title }: { title: string }) {
  const router = useRouter();
  return <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-md">
    <Button variant="ghost" size="icon" aria-label="Back" onClick={() => window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" })}><ArrowLeft /></Button><h1 className="text-sm font-semibold">{title}</h1>
  </header>;
}
const tabs = [{ to: "/", label: "Feed", icon: Radio }, { to: "/dashboard", label: "Pocket", icon: Wallet }, { to: "/shifts", label: "Gigs", icon: CalendarDays }, { to: "/offers", label: "Offers", icon: Gift }, { to: "/bazaar", label: "Bazaar", icon: ShoppingBag }] as const;
function BottomNav({ raised = false }: { raised?: boolean }) {
  const { orders } = usePartner();
  const active = orders.find(order => order.status !== 'delivered');
  return <>{active && <div className={cn("fixed left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 px-4 pb-2", raised ? "bottom-[184px]" : "bottom-20")}><Button asChild className="h-12 w-full justify-between bg-success text-success-foreground shadow-card hover:bg-success/90"><Link to="/orders/$orderId" params={{ orderId: active.id }}><span className="flex items-center gap-2"><Bike /><span className="max-w-64 truncate text-xs">{active.status === 'assigned' || active.status === 'at_store' ? `Pick order from restaurant: ${active.restaurant.name}` : `Deliver order to: ${active.customer.name}`}</span></span><ChevronRight /></Link></Button></div>}<nav className="fixed bottom-0 left-1/2 z-30 flex h-20 w-full max-w-[430px] -translate-x-1/2 border-t bg-card/95 px-3 pb-3 backdrop-blur-md" aria-label="Main navigation">
    {tabs.map((tab) => <Button key={tab.to} variant="ghost" asChild className="h-full flex-1 rounded-none px-0"><Link to={tab.to} activeOptions={{ exact: true }} className={cn("flex flex-col gap-1 text-[10px] text-muted-foreground")} activeProps={{ className: "text-primary font-bold" }}><tab.icon className="!h-5 !w-5" />{tab.label}</Link></Button>)}
  </nav></>;
}
