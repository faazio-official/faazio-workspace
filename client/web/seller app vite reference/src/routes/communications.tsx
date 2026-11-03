import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, Mail, Bell, Volume2, BellOff, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Toggle, Sheet, TextField, PrimaryButton } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";

export const Route = createFileRoute("/communications")({
  head: () => ({ meta: [{ title: "Manage communications — Restaurant Partner" }, { name: "description", content: "WhatsApp, email and notification preferences." }, { property: "og:title", content: "Manage communications" }, { property: "og:description", content: "WhatsApp, email and notification preferences." }] }),
  component: Comms,
});

function Comms() {
  const c = useApp((s) => s.comms);
  const r = useApp((s) => s.restaurant);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const T = (k: keyof typeof c, label: string) => <Toggle label={label} checked={c[k] as boolean} onChange={(v) => actions.setComms({ [k]: v })} />;
  const addEmail = <button onClick={() => setEmailOpen(true)} className="block text-[11px] font-semibold text-info">{c.emails.length ? c.emails.join(", ") : "Add email"}</button>;
  const Line = ({ icon: Icon, title, sub, right }: { icon: typeof Bell; title: string; sub?: React.ReactNode; right: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2.5"><Icon className="mt-0.5 h-4 w-4" /><div className="flex-1"><p className="text-sm">{title}</p>{sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}</div>{right}</div>
  );
  return (
    <MobileFrame>
      <PageHeader title="Manage communications" />
      <div className="px-4 pb-10">
        <Line icon={MessageCircle} title="WhatsApp notifications" sub={`Receive updates and other important content on WhatsApp on ${r.ownerPhone}`} right={T("whatsapp", "WhatsApp")} />
        <p className="pt-4 text-sm font-bold">Business Reports</p>
        <p className="pt-2 text-xs font-semibold">Daily Reports</p><p className="text-[11px] text-muted-foreground">Quick summary for previous day</p>
        <Line icon={MessageCircle} title="Share on whatsapp" right={T("dailyWhatsapp", "Daily WhatsApp")} />
        <Line icon={Mail} title="Share on email" sub={addEmail} right={T("dailyEmail", "Daily email")} />
        <p className="pt-2 text-xs font-semibold">Weekly Reports</p><p className="text-[11px] text-muted-foreground">Detailed report for previous week</p>
        <Line icon={MessageCircle} title="Share on whatsapp" right={T("weeklyWhatsapp", "Weekly WhatsApp")} />
        <Line icon={Mail} title="Share on email" sub={addEmail} right={T("weeklyEmail", "Weekly email")} />
        <p className="pt-4 text-sm font-bold">App notifications</p>
        <Line icon={Bell} title="Order notifications" sub="Receive notifications for new orders on this device" right={T("orderNotifications", "Order notifications")} />
        <div className="flex items-center gap-3 py-2.5"><Volume2 className="h-4 w-4" /><span className="w-24 text-sm">Ring volume</span><input aria-label="Ring volume" type="range" min={0} max={100} value={c.ringVolume} onChange={(e) => actions.setComms({ ringVolume: +e.target.value })} className="flex-1 accent-current" /></div>
        <Line icon={BellOff} title="Ring in silent mode" sub="Ring for order notifications even when your phone is on silent" right={T("ringSilent", "Ring in silent")} />
        <Line icon={AlertTriangle} title="Live complaint notifications" sub="Receive notifications for live complaints on this device" right={T("liveComplaints", "Live complaints")} />
      </div>
      <Sheet open={emailOpen} onClose={() => setEmailOpen(false)} title="Add email" footer={<PrimaryButton className="w-full" disabled={!/\S+@\S+\.\S+/.test(email)} onClick={() => { actions.setComms({ emails: [...c.emails, email] }); setEmail(""); setEmailOpen(false); toast.success("Email added"); }}>Save</PrimaryButton>}>
        <TextField label="Email address" type="email" value={email} onChange={setEmail} />
      </Sheet>
    </MobileFrame>
  );
}
