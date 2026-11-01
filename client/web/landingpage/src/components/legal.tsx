import type { ReactNode } from "react";

export type PolicySection = {
  id: string;
  title: string;
  body: ReactNode;
};

export function PolicyList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-7 text-muted-foreground">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export const LEGAL_EFFECTIVE_DATE = "28 October 2026";

/** Inline mail/phone link styling shared by every legal page. */
export const legalLinkClass = "font-medium text-brand-ink underline underline-offset-4";
