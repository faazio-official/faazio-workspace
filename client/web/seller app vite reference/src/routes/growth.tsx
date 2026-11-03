import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, ChevronRight, Megaphone, Percent } from "lucide-react";
import { toast } from "sonner";
import { HubShell } from "@/components/app/shells";
import { Card, Sheet, PrimaryButton, RadioRow } from "@/components/app/kit";
import { Gauge } from "@/components/app/charts";
import { api } from "@/services/api";

export const Route = createFileRoute("/growth")({
  head: () => ({ meta: [{ title: "Growth — Restaurant Partner" }, { name: "description", content: "Menu score, ads and offers." }, { property: "og:title", content: "Growth" }, { property: "og:description", content: "Menu score, ads and offers." }] }),
  component: Growth,
});

const offers = ["20% off up to ₹50", "Flat ₹75 off on ₹249", "Buy 1 Get 1 on juices"];

function Growth() {
  const s = api.hub.menuScore;
  const [photo, setPhoto] = useState(false);
  const [offer, setOffer] = useState(false);
  const [sel, setSel] = useState(offers[0]);
  return (
    <HubShell>
      <div className="space-y-3 px-4 pt-3">
        <button onClick={() => setPhoto(true)} className="flex w-full items-center gap-3 rounded-2xl bg-info p-4 text-left text-primary-foreground">
          <div className="flex-1"><p className="font-bold">Professional photos in seconds</p><p className="text-[11px] opacity-90">Turn any photo into a professional shot and add it to your menu</p><span className="mt-2 inline-block rounded-md bg-card px-2 py-1 text-[10px] font-bold text-info">Create now</span></div>
          <Camera className="h-10 w-10" />
        </button>
        <Link to="/menu" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="text-2xl">🍽️</span><span className="flex-1 text-sm"><b>Edit your menu</b><br /><span className="text-xs text-muted-foreground">Add items, photos and descriptions</span></span><ChevronRight className="h-4 w-4" />
        </Link>
        <Card>
          <p className="text-sm font-bold">Your menu score</p>
          <Gauge value={s.score} label={s.label} />
          <div className="flex justify-around text-center text-xs">
            <div><p className="font-bold">{s.imagesPct}%</p><p className="text-muted-foreground">Items with images</p></div>
            <div><p className="font-bold">{s.descPct}%</p><p className="text-muted-foreground">Items with description</p></div>
          </div>
          {s.tasks.map((t) => (
            <Link key={t.title} to="/menu" className="mt-3 flex items-center justify-between rounded-xl bg-muted p-3 text-xs"><span><b>{t.title}</b><br />{t.sub}</span><ChevronRight className="h-4 w-4" /></Link>
          ))}
        </Card>
        <div className="grid grid-cols-2 gap-3 pb-4">
          <button onClick={() => toast.success("Ads team will call you within 24 hours")} className="rounded-2xl border border-border bg-card p-4 text-left"><Megaphone className="mb-2 h-5 w-5 text-brand" /><p className="text-sm font-bold">Run ads</p><p className="text-[11px] text-muted-foreground">Get more visibility</p></button>
          <button onClick={() => setOffer(true)} className="rounded-2xl border border-border bg-card p-4 text-left"><Percent className="mb-2 h-5 w-5 text-success" /><p className="text-sm font-bold">Create offer</p><p className="text-[11px] text-muted-foreground">Attract new customers</p></button>
        </div>
      </div>
      <Sheet open={photo} onClose={() => setPhoto(false)} title="Professional photos">
        <label className="mb-4 flex aspect-video cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-info text-sm text-info">
          <Camera className="mb-2 h-8 w-8" />Choose a photo
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { setPhoto(false); toast.success("Photo enhanced and sent for menu review"); } }} />
        </label>
      </Sheet>
      <Sheet open={offer} onClose={() => setOffer(false)} title="Create offer" footer={<PrimaryButton className="w-full" onClick={() => { setOffer(false); toast.success(`Offer "${sel}" is now live`); }}>Activate offer</PrimaryButton>}>
        {offers.map((o) => <RadioRow key={o} label={o} checked={sel === o} onClick={() => setSel(o)} />)}
      </Sheet>
    </HubShell>
  );
}
