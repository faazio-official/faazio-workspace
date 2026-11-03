import { toast } from "sonner";

export function PromoBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-promo p-4 text-primary-foreground">
      <p className="max-w-[60%] text-sm font-extrabold uppercase leading-tight">Got questions about running a restaurant?</p>
      <p className="mt-1 max-w-[60%] text-[9px] font-medium uppercase opacity-90">Restaurant 101 with Kunal, Pizza founder</p>
      <button onClick={() => toast.success("Your question has been submitted. We'll answer it in the next session!")} className="mt-3 rounded-md bg-card px-3 py-1 text-[10px] font-bold text-foreground">
        Ask now
      </button>
      <div className="absolute bottom-0 right-3 flex h-24 w-24 items-end justify-center rounded-t-full bg-primary-foreground/15 text-4xl">👨🏽‍🍳</div>
    </div>
  );
}
