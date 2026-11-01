import { cn } from "@/lib/utils";

/** PENDING_REVIEW → Pending review. Filter labels are prose, never raw enum values. */
export function humanizeLabel(value: string): string {
  const spaced = value.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

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
        "focus-ringed rounded-md border px-2.5 py-1 text-[12px] transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {label === "ALL" ? "All" : humanizeLabel(label)}
    </button>
  );
}
