import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Sheet, PrimaryButton } from "@/components/app/kit";
import { api } from "@/services/api";

export const Route = createFileRoute("/help-centre")({
  head: () => ({ meta: [{ title: "Help centre — Restaurant Partner" }, { name: "description", content: "Get help with your outlet." }, { property: "og:title", content: "Help centre" }, { property: "og:description", content: "Get help with your outlet." }] }),
  component: Help,
});

function Help() {
  const [topic, setTopic] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  return (
    <MobileFrame>
      <PageHeader title="Help centre" right={<button aria-label="Chat" onClick={() => setTopic("Chat with us")}><MessageCircle className="h-5 w-5 text-info" /></button>} />
      <p className="px-4 pt-3 text-xs text-muted-foreground">Select a topic you need help with</p>
      <div className="px-4 pb-10">
        {api.help.helpTopics.map((t) => (
          <button key={t.title} onClick={() => setTopic(t.title)} className="flex w-full items-center gap-3 border-b border-border py-3.5 text-left">
            <span className="flex-1"><b className="text-sm">{t.title}</b><br /><span className="text-[11px] text-muted-foreground">{t.sub}</span></span><ChevronRight className="h-4 w-4" />
          </button>
        ))}
      </div>
      <Sheet open={!!topic} onClose={() => setTopic(null)} title={topic ?? ""} footer={<PrimaryButton className="w-full" disabled={!msg.trim()} onClick={() => { setTopic(null); setMsg(""); toast.success("Ticket raised. We'll get back within 24 hours"); }}>Raise ticket</PrimaryButton>}>
        <textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Describe your issue" className="w-full rounded-xl border border-border p-3 text-sm outline-none focus:border-info" />
      </Sheet>
    </MobileFrame>
  );
}
