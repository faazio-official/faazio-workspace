import { cn } from "@/lib/utils";

export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-ringed rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground shadow-glow"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
      )}
    >
      {label}
    </button>
  );
}
