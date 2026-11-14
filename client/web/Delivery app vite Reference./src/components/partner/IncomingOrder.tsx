import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Clock, MapPin, Store, Route } from "lucide-react";
import { toast } from "sonner";
import { earnings, usePartner } from "@/lib/partner/store";
import { demoTrip, offerDurationSeconds } from "@/mocks";
import { Button } from "@/components/ui/button";
import { SwipeAction } from "./SwipeAction";
import { TripMap } from "./TripMap";
export function IncomingOrder() {
  const { offer, acceptOffer, rejectOffer } = usePartner();
  const navigate = useNavigate();
  const rejectRef = useRef(rejectOffer);
  rejectRef.current = rejectOffer;
  const [remaining, setRemaining] = useState(offerDurationSeconds);
  useEffect(() => {
    if (!offer) return;
    const deadline = Date.now() + offerDurationSeconds * 1000;
    setRemaining(offerDurationSeconds);
    const timer = setInterval(() => { const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); setRemaining(seconds); if (!seconds) { rejectRef.current(); toast("Offer expired"); } }, 250);
    return () => clearInterval(timer);
  }, [offer]);
  if (!offer) return null;
  const distance = demoTrip.pickupKm + demoTrip.dropKm;
  return <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-foreground/40">
    <section role="dialog" aria-modal="true" aria-label="New order request" className="max-h-[95dvh] w-full animate-slide-up overflow-y-auto rounded-t-2xl bg-card">
      <div className="flex items-center justify-between p-5"><div><p className="text-[10px] font-bold text-primary">NEW DELIVERY</p><h2 className="mt-1 text-lg font-bold">A trip for you</h2></div><div className="relative flex h-12 w-12 items-center justify-center"><svg className="absolute h-12 w-12 -rotate-90" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted"/><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="132" strokeDashoffset={132 * (1 - remaining / offerDurationSeconds)} className="text-primary" /></svg><span className="text-sm font-bold">{remaining}s</span></div></div>
      <TripMap />
      <div className="p-5"><p className="text-xs text-muted-foreground">Guaranteed earnings</p><p className="mt-1 text-4xl font-extrabold">₹{earnings(offer)}<span className="ml-2 text-xs font-medium text-muted-foreground">incl. ₹{offer.tip} tip</span></p><p className="mt-2 text-xs text-muted-foreground">₹{(earnings(offer) / distance).toFixed(1)}/km · Mock estimate</p>
        <div className="my-5 flex justify-between border-y py-3 text-xs font-semibold"><span className="flex items-center gap-1"><Store className="h-4 w-4 text-primary" />{demoTrip.pickupKm} km pickup</span><span className="flex items-center gap-1"><Route className="h-4 w-4 text-primary" />{demoTrip.dropKm} km trip</span><span className="flex items-center gap-1"><Clock className="h-4 w-4 text-primary" />{demoTrip.minutes} min</span></div>
        <div className="space-y-4 text-sm"><p className="flex gap-3"><Store className="mt-1 h-4 w-4 shrink-0 text-primary"/><span className="min-w-0"><b>{offer.restaurant.name}</b><span className="mt-1 block text-xs text-muted-foreground">{offer.restaurant.address}</span></span></p><p className="flex gap-3"><MapPin className="mt-1 h-4 w-4 shrink-0 text-primary"/><span className="min-w-0"><b>{offer.customer.name}</b><span className="mt-1 block text-xs text-muted-foreground">{offer.customer.address}</span></span></p></div>
        <div className="mt-5"><SwipeAction label="Swipe to accept" onConfirm={() => { const id = offer.id; acceptOffer(); toast.success("Order accepted"); navigate({ to: "/orders/$orderId", params: { orderId: id } }); }}/></div>
        <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={() => { rejectOffer(); toast("Order rejected"); }}>Decline delivery</Button>
      </div>
    </section>
  </div>;
}
