import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Hand, Printer, Layers } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Toggle, Sheet, RadioRow } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";
import { api } from "@/services/api";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Restaurant Partner" }, { name: "description", content: "Order actions, KOT and overlay settings." }, { property: "og:title", content: "Settings" }, { property: "og:description", content: "Order actions, KOT and overlay settings." }] }),
  component: SettingsPage,
});

function Row({ icon: Icon, title, sub, right }: { icon: typeof Hand; title: string; sub: string; right: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1"><p className="text-sm font-semibold">{title}</p><p className="text-[11px] text-muted-foreground">{sub}</p></div>
      {right}
    </div>
  );
}

function SettingsPage() {
  const s = useApp((x) => x.settings);
  const [paper, setPaper] = useState(false);
  return (
    <MobileFrame>
      <PageHeader title="Settings" />
      <div className="px-4 pb-10">
        <p className="pt-4 text-xs font-bold uppercase text-muted-foreground">Order actions</p>
        <Row icon={Hand} title="Swipe to mark order ready" sub="Swipe the button to mark an order ready, instead of tapping, to avoid accidental taps" right={<Toggle label="Swipe to mark ready" checked={s.swipeToReady} onChange={(v) => actions.setSettings({ swipeToReady: v })} />} />
        <p className="pt-4 text-xs font-bold uppercase text-muted-foreground">KOT settings</p>
        <Row icon={Printer} title="Automatic KOT printing" sub="Choose whether you want KOTs to be printed automatically when you accept new orders" right={<Toggle label="Automatic KOT" checked={s.autoKot} onChange={(v) => { actions.setSettings({ autoKot: v }); toast.success(`Auto KOT ${v ? "enabled" : "disabled"}`); }} />} />
        <Row icon={Printer} title="Printer paper size" sub="Pick the width of the paper you're using for printing" right={<button onClick={() => setPaper(true)} className="text-xs font-semibold text-info">{s.paperSize} ▾</button>} />
        <p className="pt-4 text-xs font-bold uppercase text-muted-foreground">Overlay settings</p>
        <Row icon={Layers} title="Floating live order count" sub="Display a floating bubble showing your live order count when the app is minimised" right={<Toggle label="Floating count" checked={s.floatingCount} onChange={(v) => actions.setSettings({ floatingCount: v })} />} />
        <Link to="/communications" className="mt-4 block text-xs font-semibold text-info">Check system notification settings →</Link>
        <Link to="/help-centre" className="mt-3 block text-xs font-semibold text-info">Still facing problems? Open troubleshooting guide →</Link>
      </div>
      <Sheet open={paper} onClose={() => setPaper(false)} title="Printer paper size">
        {api.paperSizes.map((p) => <RadioRow key={p} label={p} checked={s.paperSize === p} onClick={() => { actions.setSettings({ paperSize: p }); setPaper(false); }} />)}
      </Sheet>
    </MobileFrame>
  );
}
