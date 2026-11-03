import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, PrimaryButton } from "@/components/app/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/share-feedback")({
  head: () => ({ meta: [{ title: "Share your feedback — Restaurant Partner" }, { name: "description", content: "Tell us how we can improve the app." }, { property: "og:title", content: "Share your feedback" }, { property: "og:description", content: "Tell us how we can improve the app." }] }),
  component: ShareFeedback,
});

const faces = ["😡", "😕", "😐", "🙂", "😍"];
const areas = ["Orders", "Menu", "Payouts", "Support", "App speed", "Other"];

function ShareFeedback() {
  const navigate = useNavigate();
  const [rating, setRating] = useState<number | null>(null);
  const [area, setArea] = useState<string[]>([]);
  const [text, setText] = useState("");
  return (
    <MobileFrame>
      <PageHeader title="Share your feedback" />
      <div className="p-4 pb-28">
        <p className="text-sm font-bold">How would you rate your experience with the app?</p>
        <div className="mt-3 flex justify-between">{faces.map((f, i) => <button key={f} onClick={() => setRating(i)} className={cn("rounded-full p-2 text-3xl transition-transform", rating === i ? "scale-125 bg-muted" : "opacity-60")}>{f}</button>)}</div>
        <p className="mt-6 text-sm font-bold">What can we improve?</p>
        <div className="mt-2 flex flex-wrap gap-2">{areas.map((a) => <button key={a} onClick={() => setArea(area.includes(a) ? area.filter((x) => x !== a) : [...area, a])} className={cn("rounded-full border px-3 py-1 text-xs", area.includes(a) ? "border-foreground bg-foreground text-background" : "border-border")}>{a}</button>)}</div>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell us more (optional)" className="mt-4 w-full rounded-xl border border-border p-3 text-sm outline-none focus:border-info" />
      </div>
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-card p-3"><PrimaryButton className="w-full" disabled={rating === null} onClick={() => { toast.success("Thanks for your feedback!"); navigate({ to: "/explore" }); }}>Submit</PrimaryButton></div>
    </MobileFrame>
  );
}
