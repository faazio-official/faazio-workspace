import type { ReactNode } from "react";
import { HiOutlineArrowLeft, HiOutlineChevronRight } from "react-icons/hi2";

/**
 * Presentational pieces for the walkthrough screens. They use landing tokens
 * only and render no focusable controls — the whole stage is decorative and
 * `aria-hidden`, while the step rail carries the real, accessible content.
 */

type TargetProps = {
  target?: string | undefined;
  active?: boolean | undefined;
};

export function MockAppBar({ title, back = false }: { title: string; back?: boolean }) {
  return (
    <div className="tour-appbar">
      {back ? <HiOutlineArrowLeft className="tour-appbar-back" aria-hidden="true" /> : null}
      <span className="tour-appbar-title">{title}</span>
    </div>
  );
}

export function MockGroup({
  title,
  muted = false,
  children,
}: {
  title?: string;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="tour-group" data-muted={muted || undefined}>
      {title ? <p className="tour-group-title">{title}</p> : null}
      {children}
    </section>
  );
}

export function MockCard({ children }: { children: ReactNode }) {
  return <div className="tour-card">{children}</div>;
}

export function MockRow({
  icon,
  title,
  subtitle,
  target,
  active = false,
  muted = false,
  chevron = true,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  muted?: boolean;
  chevron?: boolean;
} & TargetProps) {
  return (
    <div
      className="tour-row"
      data-muted={muted || undefined}
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      {icon ? <span className="tour-row-icon">{icon}</span> : null}
      <span className="tour-row-text">
        <span className="tour-row-title">{title}</span>
        {subtitle ? <span className="tour-row-sub">{subtitle}</span> : null}
      </span>
      {chevron ? <HiOutlineChevronRight className="tour-row-chevron" aria-hidden="true" /> : null}
    </div>
  );
}

export function MockField({
  label,
  value,
  mono = false,
  target,
  active = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
} & TargetProps) {
  return (
    <div className="tour-field" data-tour-target={target} data-active={active ? "true" : undefined}>
      <span className="tour-field-label">{label}</span>
      <span className={mono ? "tour-field-value tour-field-mono" : "tour-field-value"}>
        {value}
      </span>
    </div>
  );
}

export function MockChips({ items }: { items: { label: string; on?: boolean }[] }) {
  return (
    <div className="tour-chips">
      {items.map((item) => (
        <span key={item.label} className="tour-chip" data-on={item.on || undefined}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function MockCheck({ label }: { label: string }) {
  return (
    <span className="tour-check">
      <span className="tour-check-box" aria-hidden="true">
        <svg viewBox="0 0 12 12" width="9" height="9" fill="none">
          <path
            d="M2 6.2 4.6 8.8 10 3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="tour-check-label">{label}</span>
    </span>
  );
}

export function MockButton({
  children,
  variant = "primary",
  block = false,
  target,
  active = false,
}: {
  children: ReactNode;
  variant?: "primary" | "outline";
  block?: boolean;
} & TargetProps) {
  return (
    <span
      className="tour-mock-btn"
      data-variant={variant}
      data-block={block || undefined}
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      {children}
    </span>
  );
}

export function MockHint({ children }: { children: ReactNode }) {
  return <p className="tour-hint">{children}</p>;
}
