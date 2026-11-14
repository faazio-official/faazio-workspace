import { useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SwipeAction({ label, onConfirm, disabled = false }: { label: string; onConfirm: () => void; disabled?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = () => Math.max(1, (track.current?.clientWidth ?? 320) - 60);
  function finish(clientX: number) { const confirmed = start.current !== null && clientX - start.current >= limit() * 0.8; start.current = null; setOffset(0); if (confirmed && !disabled) onConfirm(); }
  return <div ref={track} className="relative h-14 overflow-hidden rounded-lg bg-primary-soft text-primary">
    <span className="absolute inset-0 flex items-center justify-center pl-10 text-sm font-semibold">{disabled ? "Check all items to continue" : label}</span>
    <Button aria-label={label} disabled={disabled} className="absolute left-1 top-1 h-12 w-12 touch-none p-0 shadow-none" style={{ transform: `translateX(${offset}px)` }}
      onPointerDown={(event) => { start.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (start.current !== null) setOffset(Math.min(limit(), Math.max(0, event.clientX - start.current))); }}
      onPointerUp={(event) => finish(event.clientX)} onPointerCancel={() => { start.current = null; setOffset(0); }}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onConfirm(); } }}>
      {offset >= limit() * 0.8 ? <Check /> : <ArrowRight />}
    </Button>
  </div>;
}