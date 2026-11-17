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

export function MockToggle({
  label,
  on = false,
  target,
  active = false,
}: {
  label: string;
  on?: boolean;
} & TargetProps) {
  return (
    <div
      className="tour-toggle-row"
      data-tour-target={target}
      data-active={active ? "true" : undefined}
    >
      <span className="tour-toggle-label">{label}</span>
      <span className="tour-toggle" data-on={on || undefined} aria-hidden="true" />
    </div>
  );
}

export function MockSteps({
  items,
  activeIndex = 0,
  target,
  active = false,
}: {
  items: readonly string[];
  activeIndex?: number;
} & TargetProps) {
  return (
    <div className="tour-steps" data-tour-target={target} data-active={active ? "true" : undefined}>
      {items.map((item, index) => (
        <span
          key={item}
          className="tour-step"
          data-state={index < activeIndex ? "done" : index === activeIndex ? "current" : undefined}
        >
          <span className="tour-step-dot" aria-hidden="true" />
          <span className="tour-step-label">{item}</span>
        </span>
      ))}
    </div>
  );
}

export function MockStat({
  label,
  value,
  target,
  active = false,
}: {
  label: string;
  value: string;
} & TargetProps) {
  return (
    <div className="tour-stat" data-tour-target={target} data-active={active ? "true" : undefined}>
      <span className="tour-stat-label">{label}</span>
      <span className="tour-stat-value">{value}</span>
    </div>
  );
}

export function MockBars({
  values,
  target,
  active = false,
}: {
  values: readonly number[];
} & TargetProps) {
  return (
    <div className="tour-bars" data-tour-target={target} data-active={active ? "true" : undefined}>
      {values.map((value, index) => (
        <span key={index} className="tour-bar" style={{ height: `${value}%` }} />
      ))}
    </div>
  );
}

export function MockQR({ target, active = false }: TargetProps) {
  return (
    <div className="tour-qr" data-tour-target={target} data-active={active ? "true" : undefined}>
      <svg viewBox="0 0 29 29" aria-hidden="true">
        <g fill="currentColor">
          <rect x="0" y="0" width="7" height="7" />
          <rect x="22" y="0" width="7" height="7" />
          <rect x="0" y="22" width="7" height="7" />
        </g>
        <g fill="var(--color-card)">
          <rect x="1" y="1" width="5" height="5" />
          <rect x="23" y="1" width="5" height="5" />
          <rect x="1" y="23" width="5" height="5" />
        </g>
        <g fill="currentColor">
          <rect x="2" y="2" width="3" height="3" />
          <rect x="24" y="2" width="3" height="3" />
          <rect x="2" y="24" width="3" height="3" />
          <rect x="9" y="2" width="2" height="2" />
          <rect x="13" y="5" width="2" height="2" />
          <rect x="9" y="9" width="2" height="2" />
          <rect x="12" y="12" width="2" height="2" />
          <rect x="15" y="9" width="2" height="2" />
          <rect x="18" y="13" width="2" height="2" />
          <rect x="21" y="10" width="2" height="2" />
          <rect x="25" y="9" width="2" height="2" />
          <rect x="9" y="15" width="2" height="2" />
          <rect x="12" y="18" width="2" height="2" />
          <rect x="15" y="16" width="2" height="2" />
          <rect x="18" y="19" width="2" height="2" />
          <rect x="21" y="15" width="2" height="2" />
          <rect x="25" y="18" width="2" height="2" />
          <rect x="9" y="21" width="2" height="2" />
          <rect x="13" y="24" width="2" height="2" />
          <rect x="16" y="22" width="2" height="2" />
          <rect x="18" y="25" width="2" height="2" />
          <rect x="22" y="22" width="2" height="2" />
          <rect x="25" y="24" width="2" height="2" />
          <rect x="20" y="5" width="2" height="2" />
          <rect x="5" y="10" width="2" height="2" />
          <rect x="5" y="14" width="2" height="2" />
          <rect x="5" y="18" width="2" height="2" />
        </g>
      </svg>
    </div>
  );
}
