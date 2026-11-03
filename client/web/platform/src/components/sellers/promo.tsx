"use client";
// Promo banner from the seller app vite reference (promo.tsx), Faazio-branded copy. The gear icon
// replaces the reference chef emoji, and the CTA's toast is explicitly non-PII.
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";

export function PromoBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-promo p-4 text-primary-foreground">
      <p className="max-w-[60%] text-sm font-extrabold uppercase leading-tight">
        Got a question about growing on Faazio?
      </p>
      <p className="mt-1 max-w-[60%] text-[9px] font-medium uppercase opacity-90">
        Partner ideas from the Faazio Seller Academy
      </p>
      <button
        onClick={() => toast.success("Your question has been submitted — we'll answer in the next session.")}
        className="mt-3 rounded-md bg-card px-3 py-1 text-[10px] font-bold text-foreground"
      >
        Ask now
      </button>
      <div className="absolute bottom-0 right-3 flex h-24 w-24 items-end justify-center rounded-t-full bg-primary-foreground/15">
        <UtensilsCrossed className="h-10 w-10 pb-2 text-primary-foreground" strokeWidth={1.6} />
      </div>
    </div>
  );
}