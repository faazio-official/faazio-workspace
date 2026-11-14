import { Bike, MapPin, Store } from "lucide-react";
export function TripMap() {
  return <div className="trip-map relative h-40 overflow-hidden" role="img" aria-label="Illustrative pickup and delivery route, not a live map">
    <svg viewBox="0 0 400 160" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <g className="map-streets" fill="none" strokeWidth="12"><path d="M-10 45H410M-10 115H410M60-10V180M180-10V180M310-10V180"/><path d="M-10 150L410 0"/></g>
      <path d="M85 110H180V45H310" fill="none" className="map-route" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 5" />
    </svg>
    <span className="absolute left-[18%] top-[56%] flex h-8 w-8 items-center justify-center rounded-full bg-card text-primary shadow-card"><Store className="h-4 w-4" /></span>
    <span className="absolute left-[42%] top-[17%] flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card"><Bike className="h-5 w-5" /></span>
    <span className="absolute right-[18%] top-[17%] flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background shadow-card"><MapPin className="h-4 w-4" /></span>
    <span className="absolute bottom-2 right-3 text-[10px] font-medium text-muted-foreground">KARAIKAL · ESTIMATED ROUTE</span>
  </div>;
}