"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Zap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, RadioRow, EmptyState, FixedActionBar } from "@/components/sellers/kit";
import { useSellerUi } from "@/lib/sellerUi";
import { useSellerScope } from "@/lib/api/hooks";

const DURATIONS = ["30 minutes", "1 hour", "2 hours", "3 hours"];

function rushMinutes(label: string): number {
  const parts = label.match(/(\d+)\s*(?:hours?|minutes?)/);
  if (!parts) return 0;
  return label.includes("hour") ? Number(parts[1]) * 60 : Number(parts[1]);
}

function RushHour() {
  const router = useRouter();
  const rush = useSellerUi((s) => s.rush);
  const { activeStore } = useSellerScope();
  const [sel, setSel] = useState<string | null>(null);

  if (activeStore && activeStore.sector !== "FOOD") {
    return (
      <>
        <PageHeader title="Rush mode" />
        <div className="space-y-3 px-4 pt-3 pb-8">
          <EmptyState
            text="Rush (peak-busy) mode is a Food-outlet feature. It tells the platform your outlet is unusually busy so delivery times stay accurate."
          />
          <Link
            href="/seller/stores"
            className="block rounded-xl bg-info-soft px-4 py-2.5 text-center text-xs font-semibold text-info"
          >
            View your stores →
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Rush in kitchen" />
      <div className="p-4 pb-36">
        <div className="flex gap-3 rounded-2xl bg-info-soft p-4">
          <Zap className="h-6 w-6 shrink-0 text-info" />
          <p className="text-sm font-semibold">
            Inform us when your kitchen is in rush and you need more time to manage orders
          </p>
        </div>
        {rush.on ? (
          <div className="mt-6 text-center">
            <p className="text-lg font-bold">Rush mode is ON</p>
            <p className="text-sm text-muted-foreground">{rush.until ? `Until ${rush.until}` : "While the toggle stays on"}</p>
          </div>
        ) : (
          <>
            <p className="mt-5 text-sm font-bold">How this helps you</p>
            {[
              "Get more time to prepare food",
              "Show correct delivery time to customers",
              "Avoid crowding of riders at your outlet",
            ].map((t) => (
              <p key={t} className="mt-2 flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {t}
              </p>
            ))}
            <p className="mt-5 text-sm font-bold">How long do you expect the rush at your outlet?</p>
            {DURATIONS.map((d) => (
              <RadioRow key={d} label={d} checked={sel === d} onClick={() => setSel(d)} />
            ))}
          </>
        )}
      </div>
      <FixedActionBar>
        {rush.on ? (
          <button
            onClick={() => {
              useSellerUi.getState().setRush({ on: false });
              toast.success("Rush mode turned off");
            }}
            className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
          >
            Turn off rush mode
          </button>
        ) : (
          <button
            disabled={!sel}
            onClick={() => {
              if (!sel) return;
              const until = new Date(Date.now() + rushMinutes(sel) * 60000).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
              });
              useSellerUi.getState().setRush({ on: true, until });
              toast.success(`Rush mode on until ${until}`);
              router.push("/seller/explore");
            }}
            className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
          >
            Confirm
          </button>
        )}
      </FixedActionBar>
    </>
  );
}

export default RushHour;