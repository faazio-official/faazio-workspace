import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bike, Clock, MapPin, ArrowUpRight, Zap, Route as RouteIcon } from "lucide-react";
import { TabPage } from "@/components/partner/Shell";
import { StatusText, fmtShort } from "@/components/partner/Badges";
import { earnings, usePartner } from "@/lib/partner/store";
import { Button } from "@/components/ui/button";
import { TripMap } from "@/components/partner/TripMap";
import { HomeProgress } from "@/components/partner/HomeProgress";
import { cn } from "@/lib/utils";
import { assignedZone, demoTrip, type Order } from "@/mocks";
export const Route = createFileRoute("/")({ head: () => ({ meta: [{ title: "Feed · ZIP Partner" }, { name: "description", content: "Manage your ZIP deliveries and availability." }, { property: "og:title", content: "Feed · ZIP Partner" }, { property: "og:description", content: "Manage your ZIP deliveries and availability." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Orders });
function Orders() {
  const { orders, onDuty } = usePartner();
  const [tab, setTab] = useState<"active" | "history">("active");
  const list = orders.filter((o) => tab === "active" ? o.status !== "delivered" : o.status === "delivered");
  return <TabPage title="Feed">
    <HomeProgress />
    <div className="px-4 pt-3"><Button asChild variant="ghost" className="h-10 w-full justify-between px-0 text-xs"><Link to="/zone-map"><span className="flex items-center gap-2"><MapPin className="text-primary" />{assignedZone.name}</span><ArrowUpRight className="text-primary" /></Link></Button></div>
    <h2 className="px-5 pt-6 text-sm font-bold">My orders</h2>
    <div className="sticky top-28 z-10 flex gap-1 border-b bg-background px-5 pt-4">
      {(["active", "history"] as const).map((t) => <Button key={t} variant="ghost" onClick={() => setTab(t)} className={cn("h-12 flex-1 rounded-none border-b-2", tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground")}>{t === "active" ? <Zap /> : <Clock />}{t === "active" ? "Active" : "History"}<span className="ml-1 text-xs">{orders.filter((o) => t === "active" ? o.status !== "delivered" : o.status === "delivered").length}</span></Button>)}
    </div>
    {list.length === 0 ? <div className="px-5 pt-5"><TripMap /><div className="py-10 text-center"><Bike className="mx-auto mb-4 h-9 w-9 text-primary"/><h2 className="text-base font-bold">{tab === "history" ? "No completed trips yet" : onDuty ? "Finding your next delivery" : "You’re off duty"}</h2><p className="mx-auto mt-2 max-w-64 text-xs leading-5 text-muted-foreground">{tab === "history" ? "Completed deliveries will appear here." : onDuty ? "Waiting for a nearby order in Karaikal." : "Go online whenever you’re ready to ride."}</p></div></div> : <div className="space-y-3 px-5 py-5">{list.map((o) => <OrderCard key={o.id} o={o}/>)}</div>}
  </TabPage>;
}
function OrderCard({ o }: { o: Order }) {
  return <article className="rounded-lg border bg-card p-4"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold">{o.restaurant.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{fmtShort(o.createdAt)}</p></div><StatusText status={o.status}/></div>
    <div className="my-4 flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><div><p className="text-xs font-medium">{o.customer.name}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{o.customer.address}</p></div></div>
    <div className="flex items-center justify-between border-t pt-3"><div><p className="text-lg font-bold">₹{earnings(o)} <span className="text-[10px] font-normal text-muted-foreground">earned</span></p><p className="flex items-center gap-1 text-[10px] text-muted-foreground"><RouteIcon className="h-3 w-3"/>{demoTrip.dropKm} km · {o.payment === "cod" ? "Cash" : "Prepaid"}</p></div><Button asChild size="sm" variant="secondary"><Link to="/orders/$orderId" params={{ orderId: o.id }}>Details <ArrowUpRight /></Link></Button></div>
  </article>;
}
