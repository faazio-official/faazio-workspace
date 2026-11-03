import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, RadioRow, PrimaryButton } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";
import { api } from "@/services/api";

export const Route = createFileRoute("/rush-hour")({
  head: () => ({ meta: [{ title: "Rush in kitchen — Restaurant Partner" }, { name: "description", content: "Get more prep time when your kitchen is busy." }, { property: "og:title", content: "Rush in kitchen" }, { property: "og:description", content: "Get more prep time when your kitchen is busy." }] }),
  component: Rush,
});

function Rush() {
  const rush = useApp((s) => s.rush);
  const navigate = useNavigate();
  const [sel, setSel] = useState<string | null>(null);
  const mins = (d: string) => (d.includes("30 minutes") && !d.includes("hour") ? 30 : parseInt(d) * 60 + (d.includes("30 minutes") ? 30 : 0));
  return (
    <MobileFrame>
      <PageHeader title="Rush in kitchen" />
      <div className="p-4 pb-28">
        <div className="flex gap-3 rounded-2xl bg-info-soft p-4"><Zap className="h-6 w-6 shrink-0 text-info" /><p className="text-sm font-semibold">Inform us when your kitchen is in rush and you need more time to manage orders</p></div>
        {rush.on ? (
          <div className="mt-6 text-center"><p className="text-lg font-bold">Rush mode is ON</p><p className="text-sm text-muted-foreground">Until {rush.until}</p></div>
        ) : (
          <>
            <p className="mt-5 text-sm font-bold">How this helps you</p>
            {["Get more time to prepare food", "Show correct delivery time to customers", "Avoid crowding of riders at your restaurant"].map((t) => <p key={t} className="mt-2 flex items-center gap-2 text-xs"><CheckCircle2 className="h-4 w-4 text-success" />{t}</p>)}
            <p className="mt-5 text-sm font-bold">How long do you expect the rush at your restaurant?</p>
            {api.rushDurations.map((d) => <RadioRow key={d} label={d} checked={sel === d} onClick={() => setSel(d)} />)}
          </>
        )}
      </div>
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-card p-3">
        {rush.on ? (
          <PrimaryButton className="w-full" onClick={() => { actions.setRush({ on: false }); toast.success("Rush mode turned off"); }}>Turn off rush mode</PrimaryButton>
        ) : (
          <PrimaryButton className="w-full" disabled={!sel} onClick={() => {
            const until = new Date(Date.now() + mins(sel!) * 60e3).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
            actions.setRush({ on: true, until }); toast.success(`Rush mode on until ${until}`); navigate({ to: "/explore" });
          }}>Confirm</PrimaryButton>
        )}
      </div>
    </MobileFrame>
  );
}
