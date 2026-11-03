import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Plus, Trash2, Play, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, UnderlineTabs, Toggle, Sheet, PrimaryButton, TextField, RadioRow } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";
import type { Slot } from "@/mocks/outlet";

export const Route = createFileRoute("/outlet-timings")({
  head: () => ({ meta: [{ title: "Outlet timings — Restaurant Partner" }, { name: "description", content: "Set daily and occasional timings." }, { property: "og:title", content: "Outlet timings" }, { property: "og:description", content: "Set daily and occasional timings." }] }),
  component: Timings,
});

const to12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const to24 = (t: string) => { const [hm, ap] = t.split(" "); let [h, m] = hm.split(":").map(Number); if (ap === "PM" && h !== 12) h += 12; if (ap === "AM" && h === 12) h = 0; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; };
const hrs = (slots: Slot[]) => { const mins = slots.reduce((a, s) => { const [a1, a2] = to24(s.from).split(":").map(Number); const [b1, b2] = to24(s.to).split(":").map(Number); return a + Math.max(0, b1 * 60 + b2 - (a1 * 60 + a2)); }, 0); return `${Math.floor(mins / 60)} hrs ${mins % 60 ? (mins % 60) + " mins" : ""}`; };

function Timings() {
  const r = useApp((s) => s.restaurant);
  const timings = useApp((s) => s.timings);
  const occasions = useApp((s) => s.occasions);
  const custom = useApp((s) => s.customOccasions);
  const [tab, setTab] = useState<"outlet" | "occasional">("outlet");
  const [editing, setEditing] = useState<{ day: number; slot: number } | null>(null);
  const [from, setFrom] = useState("09:00");
  const [toT, setToT] = useState("21:00");
  const [intro, setIntro] = useState(true);
  const [video, setVideo] = useState(false);
  const [occ, setOcc] = useState<string | null>(null);
  const [occSel, setOccSel] = useState<"open" | "closed">("closed");
  const [add, setAdd] = useState(false);
  const [newOcc, setNewOcc] = useState({ name: "", date: "" });
  const [all, setAll] = useState(false);

  const update = (fn: (t: typeof timings) => void) => { const c = JSON.parse(JSON.stringify(timings)); fn(c); actions.setTimings(c); };
  const openEditor = (day: number, slot: number) => {
    const s = slot >= 0 ? timings[day].slots[slot] : { from: "09:00 AM", to: "09:00 PM" };
    setFrom(to24(s.from)); setToT(to24(s.to)); setEditing({ day, slot });
  };

  return (
    <MobileFrame>
      <PageHeader title={r.name} sub={`ID: ${r.id} • ${r.city}`} />
      <UnderlineTabs tabs={[{ key: "outlet", label: "Outlet timings" }, { key: "occasional", label: "Occasional timings" }]} value={tab} onChange={setTab} />
      {tab === "outlet" ? (
        <div className="space-y-3 p-4 pb-10">
          <button onClick={() => openEditor(0, -2)} className="w-full rounded-xl bg-info-soft py-2 text-xs font-semibold text-info">✎ Edit for all days</button>
          {timings.map((d, di) => (
            <div key={d.day} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-bold">{d.day}</p><p className="text-[10px] text-muted-foreground">{d.open ? hrs(d.slots) : "Closed"}</p></div>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">{d.open ? "Open" : "Closed"}<Toggle label={d.day} checked={d.open} onChange={(v) => { update((t) => { t[di].open = v; }); toast.success(`${d.day} marked ${v ? "open" : "closed"}`); }} /></span>
              </div>
              {d.open && (
                <>
                  {d.slots.map((s, si) => (
                    <div key={si} className="mt-3 flex items-center gap-2 text-sm">
                      <button onClick={() => openEditor(di, si)} className="flex flex-1 items-center gap-2 rounded-lg bg-muted px-2 py-1.5"><Clock className="h-3.5 w-3.5" />{s.from}</button>
                      <span className="text-xs text-muted-foreground">to</span>
                      <button onClick={() => openEditor(di, si)} className="flex flex-1 items-center gap-2 rounded-lg bg-muted px-2 py-1.5"><Clock className="h-3.5 w-3.5" />{s.to}</button>
                      <button aria-label="Delete slot" onClick={() => update((t) => { t[di].slots.splice(si, 1); if (!t[di].slots.length) t[di].open = false; })}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
                    </div>
                  ))}
                  {d.slots.length < 3 && <button onClick={() => openEditor(di, -1)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-info"><Plus className="h-3.5 w-3.5" />Add time slot</button>}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 p-4 pb-10">
          {intro && (
            <div className="relative rounded-2xl bg-info-soft p-4">
              <button aria-label="Dismiss" onClick={() => setIntro(false)} className="absolute right-3 top-3"><X className="h-4 w-4" /></button>
              <p className="text-sm font-bold">Introducing occasional timings!</p>
              <p className="mt-1 text-xs text-muted-foreground">You can now schedule temporary operational timings for specific days without affecting your regular timings</p>
              <button onClick={() => setVideo(true)} className="mt-3 flex items-center gap-2 rounded-xl bg-card p-2 text-left"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background"><Play className="h-4 w-4" /></span><span className="text-xs"><b>How does it work?</b><br /><span className="text-muted-foreground">Video • 1:20 min</span></span></button>
            </div>
          )}
          <div className="flex items-center justify-between"><p className="text-sm font-bold">Upcoming occasions</p><button onClick={() => setAll(true)} className="text-xs font-semibold text-info">See all</button></div>
          <div className="no-scrollbar flex gap-3 overflow-x-auto">
            {occasions.map((o) => (
              <div key={o.id} className="w-40 shrink-0 rounded-2xl border border-border bg-card p-3">
                <p className="text-sm font-bold">{o.name}</p><p className="text-[10px] text-muted-foreground">{o.date}</p>
                {o.status ? <p className={`mt-2 text-[11px] font-semibold ${o.status === "open" ? "text-success" : "text-brand"}`}>{o.status === "open" ? "Open as usual" : "Closed"}</p> : null}
                <button onClick={() => { setOcc(o.id); setOccSel(o.status ?? "closed"); }} className="mt-2 text-[11px] font-semibold text-info">+ Setup occasion</button>
              </div>
            ))}
          </div>
          <p className="pt-2 text-sm font-bold">Your occasions</p>
          {custom.length === 0 && <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">You have not set up any occasions. Setup timings for occasions that are not listed above.</p>}
          {custom.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm"><span><b>{o.name}</b><br /><span className="text-xs text-muted-foreground">{o.date} • Closed</span></span><button aria-label="Remove" onClick={() => actions.removeCustomOccasion(o.id)}><Trash2 className="h-4 w-4" /></button></div>
          ))}
          <button onClick={() => setAdd(true)} className="w-full text-center text-xs font-semibold text-info">+ Add new occasion</button>
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.day !== undefined && editing.slot === -2 ? "Edit for all days" : editing ? `${timings[editing.day].day} timing` : ""} footer={
        <PrimaryButton className="w-full" disabled={toT <= from} onClick={() => {
          const e = editing!; const slot = { from: to12(from), to: to12(toT) };
          update((t) => {
            if (e.slot === -2) t.forEach((d) => { d.open = true; d.slots = [slot]; });
            else if (e.slot === -1) t[e.day].slots.push(slot);
            else t[e.day].slots[e.slot] = slot;
          });
          setEditing(null); toast.success("Timings updated");
        }}>Save</PrimaryButton>
      }>
        <div className="flex gap-3 pb-2">
          <label className="flex-1 text-xs text-muted-foreground">Opens at<input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground" /></label>
          <label className="flex-1 text-xs text-muted-foreground">Closes at<input type="time" value={toT} onChange={(e) => setToT(e.target.value)} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground" /></label>
        </div>
        {toT <= from && <p className="text-xs text-brand">Closing time must be after opening time</p>}
      </Sheet>
      <Sheet open={video} onClose={() => setVideo(false)} title="How occasional timings work">
        <div className="mb-4 flex aspect-video items-center justify-center rounded-2xl bg-foreground text-background"><Play className="h-10 w-10" /></div>
      </Sheet>
      <Sheet open={!!occ} onClose={() => setOcc(null)} title={occasions.find((o) => o.id === occ)?.name ?? ""} footer={<PrimaryButton className="w-full" onClick={() => { actions.setOccasionStatus(occ!, occSel); setOcc(null); toast.success("Occasion timings saved"); }}>Save</PrimaryButton>}>
        <RadioRow label="Closed for the day" checked={occSel === "closed"} onClick={() => setOccSel("closed")} />
        <RadioRow label="Open as usual" checked={occSel === "open"} onClick={() => setOccSel("open")} />
      </Sheet>
      <Sheet open={add} onClose={() => setAdd(false)} title="Add new occasion" footer={<PrimaryButton className="w-full" disabled={!newOcc.name || !newOcc.date} onClick={() => { actions.addCustomOccasion({ id: "u" + Date.now(), ...newOcc }); setNewOcc({ name: "", date: "" }); setAdd(false); toast.success("Occasion added"); }}>Add</PrimaryButton>}>
        <TextField label="Occasion name" value={newOcc.name} onChange={(v) => setNewOcc({ ...newOcc, name: v })} />
        <TextField label="Date" type="date" value={newOcc.date} onChange={(v) => setNewOcc({ ...newOcc, date: v })} />
      </Sheet>
      <Sheet open={all} onClose={() => setAll(false)} title="All upcoming occasions">
        {occasions.map((o) => <button key={o.id} onClick={() => { setAll(false); setOcc(o.id); setOccSel(o.status ?? "closed"); }} className="flex w-full justify-between border-b border-border py-3 text-sm last:border-0"><span>{o.name}</span><span className="flex items-center gap-1 text-xs text-muted-foreground">{o.date}<Pencil className="h-3 w-3" /></span></button>)}
      </Sheet>
    </MobileFrame>
  );
}
