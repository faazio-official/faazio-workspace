"use client";
// Seller console UI primitives, ported from the seller app vite reference (../seller app vite
// reference/src/components/app/kit.tsx). Only consumer is @/components/sellers + app/seller/*.
// Money note: the portal stores integer paisa everywhere; `inr()` here mirrors the reference and
// takes RUPEE float — pages convert paisa with `paisa / 100` or use formatINR() instead.
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
        checked ? "bg-success" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all",
          checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      <div className="absolute inset-0 animate-fade bg-foreground/50" onClick={onClose} />
      <div className="relative mt-auto flex max-h-[88vh] w-full max-w-[430px] flex-col">
        <button
          onClick={onClose}
          aria-label="Close"
          className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="animate-sheet flex min-h-0 flex-col rounded-t-3xl bg-card">
          {title && <h3 className="px-5 pt-5 text-lg font-bold">{title}</h3>}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
          {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  right,
  onBack,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
      <button
        aria-label="Back"
        onClick={onBack ?? (() => router.back())}
        className="-ml-1 rounded-full p-1 hover:bg-muted"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        {sub && (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {sub}
          </p>
        )}
        <h1 className="truncate text-base font-bold">{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
            value === t.key
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px]",
                value === t.key ? "bg-background text-foreground" : "bg-muted",
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex border-b border-border bg-card">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "flex-1 border-b-2 py-2.5 text-sm font-semibold transition-colors",
            value === t.key
              ? "border-info text-info"
              : "border-transparent text-muted-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
        checked ? "border-foreground" : "border-border",
      )}
    >
      {checked && <span className="h-2.5 w-2.5 rounded-full bg-foreground" />}
    </span>
  );
}

export function RadioRow({
  label,
  sub,
  checked,
  onClick,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 border-b border-border py-3.5 text-left last:border-0"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </span>
      <Radio checked={checked} />
    </button>
  );
}

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
        {icon ?? <Package className="h-12 w-12" strokeWidth={1.2} />}
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function VegMark({ veg }: { veg: boolean }) {
  return (
    <span
      className={cn(
        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border",
        veg ? "border-success" : "border-brand",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", veg ? "bg-success" : "bg-brand")} />
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  variant = "dark",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "dark" | "outline" | "info";
  className?: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-40",
        variant === "dark" && "bg-foreground text-background",
        variant === "outline" && "border border-border bg-card text-foreground",
        variant === "info" && "bg-info text-primary-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pb-2 pt-5 text-base font-bold">{children}</h2>;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block py-2">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-info disabled:opacity-50"
      />
    </label>
  );
}

export const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });