import { useState } from "react";
import { toast } from "sonner";
import { Sheet, RadioRow, PrimaryButton } from "./kit";
import { api } from "@/services/api";
import { actions } from "@/store/app-store";

function untilLabel(key: string, date: string, time: string) {
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (key === "2h") return `Back in stock at ${fmt(new Date(now.getTime() + 2 * 3600e3))}`;
  if (key === "4h") return `Back in stock at ${fmt(new Date(now.getTime() + 4 * 3600e3))}`;
  if (key === "next") return "Back in stock tomorrow at 12:00 AM";
  if (key === "custom") return `Back in stock on ${date} at ${time}`;
  return "No stock set. Turn item in stock manually";
}

export function OutOfStockSheet({ item, onClose }: { item: { id: string; name: string } | null; onClose: () => void }) {
  const [opt, setOpt] = useState<string>("2h");
  const [date, setDate] = useState(new Date(Date.now() + 864e5).toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title="Mark item out of stock"
      footer={
        <div className="flex gap-2">
          <PrimaryButton variant="outline" className="flex-1" onClick={onClose}>Back</PrimaryButton>
          <PrimaryButton className="flex-1" onClick={() => {
            if (!item) return;
            actions.setItemStock(item.id, { type: "out", until: untilLabel(opt, date, time) });
            toast.success(`${item.name} marked out of stock`);
            onClose();
          }}>Confirm</PrimaryButton>
        </div>
      }
    >
      <p className="mb-1 text-xs text-muted-foreground">{item?.name} — when should it be back in stock?</p>
      {api.outOfStockOptions.map((o) => (
        <div key={o.key}>
          <RadioRow label={o.label} sub={"sub" in o ? o.sub : undefined} checked={opt === o.key} onClick={() => setOpt(o.key)} />
          {o.key === "custom" && opt === "custom" && (
            <div className="flex gap-2 pb-3">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 rounded-lg border border-border px-2 py-2 text-sm" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-28 rounded-lg border border-border px-2 py-2 text-sm" />
            </div>
          )}
        </div>
      ))}
    </Sheet>
  );
}
