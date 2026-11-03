import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Play } from "lucide-react";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Sheet } from "@/components/app/kit";
import { api } from "@/services/api";

export const Route = createFileRoute("/learning-centre")({
  head: () => ({ meta: [{ title: "Learning centre — Restaurant Partner" }, { name: "description", content: "Bite-sized videos to grow your restaurant." }, { property: "og:title", content: "Learning centre" }, { property: "og:description", content: "Bite-sized videos to grow your restaurant." }] }),
  component: Learning,
});

function Learning() {
  const [q, setQ] = useState("");
  const [video, setVideo] = useState<string | null>(null);
  return (
    <MobileFrame>
      <PageHeader title="Learning centre" />
      <div className="bg-brand-soft px-4 py-5">
        <p className="text-xl font-bold">Grow with Zomato</p>
        <p className="mt-1 text-xs text-muted-foreground">Simple, bite-sized learning videos in your own language</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any topic" className="w-full bg-transparent text-sm outline-none" /></div>
      </div>
      <div className="px-4 pb-10">
        {api.help.learningSections.map((s) => {
          const vids = s.videos.filter((v) => v.toLowerCase().includes(q.toLowerCase()));
          if (!vids.length) return null;
          return (
            <section key={s.title} className="pt-5">
              <p className="mb-2 text-sm font-bold">{s.title}</p>
              <div className="no-scrollbar flex gap-3 overflow-x-auto">
                {vids.map((v, i) => (
                  <button key={v} onClick={() => setVideo(v)} className={`relative flex h-32 w-28 shrink-0 flex-col justify-end rounded-xl p-2 text-left text-[11px] font-bold text-primary-foreground ${i % 2 ? "bg-brand" : "bg-info"}`}>
                    <Play className="absolute right-2 top-2 h-4 w-4" />{v}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <Sheet open={!!video} onClose={() => setVideo(null)} title={video ?? ""}>
        <div className="mb-4 flex aspect-video items-center justify-center rounded-2xl bg-foreground text-background"><Play className="h-10 w-10" /></div>
      </Sheet>
    </MobileFrame>
  );
}
