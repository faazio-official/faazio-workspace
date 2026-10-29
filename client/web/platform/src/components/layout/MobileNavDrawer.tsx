"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { activeNavHref, normalizeNavPath, type NavItem } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { FaazioWordmark } from "@/components/brand/FaazioWordmark";
import { cn } from "@/lib/utils";
import { groupTone, TONE_SOFT, TONE_TEXT, TONE_VAR } from "@/lib/ui/tones";

export function MobileNavDrawer({
  open,
  onClose,
  nav,
  pathname,
  scopeLabel,
}: {
  open: boolean;
  onClose: () => void;
  nav: NavItem[];
  pathname: string;
  scopeLabel: string;
}) {
  const groups = useMemo(() => Array.from(new Set(nav.map((i) => i.group))), [nav]);
  const current = useMemo(() => activeNavHref(pathname, nav), [pathname, nav]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    return () => trigger?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (desktop.matches) onClose();
    };
    onChange();
    desktop.addEventListener("change", onChange);
    return () => {
      document.body.style.overflow = previous;
      desktop.removeEventListener("change", onChange);
    };
  }, [onClose, open]);

  function onPanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable.item(0);
    const last = focusable.item(focusable.length - 1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`${scopeLabel} navigation`}
    >
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id="mobile-nav-drawer"
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-card shadow-xl"
        onKeyDown={onPanelKeyDown}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-3">
          <div className="min-w-0">
            <FaazioWordmark className="brand-wordmark text-primary" />
            <p className="truncate text-[11px] text-muted-foreground">{scopeLabel}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto shrink-0"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {groups.map((group) => {
            const hue = groupTone(group);
            return (
              <div key={group} className="mb-3">
                <p
                  className={cn(
                    "flex items-center gap-1.5 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider",
                    TONE_TEXT[hue],
                  )}
                >
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ background: TONE_VAR[hue] }}
                  />
                  {group}
                </p>
                <div className="space-y-0.5">
                  {nav
                    .filter((item) => item.group === group)
                    .map((item) => {
                      const active = normalizeNavPath(item.to) === current;
                      return (
                        <Link
                          key={item.to}
                          href={item.to}
                          onClick={onClose}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "mb-0.5 flex items-center gap-2 rounded-md px-2 py-2 text-[13px] transition-colors",
                            active
                              ? cn("font-semibold shadow-sm", TONE_SOFT[hue])
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          <item.icon
                            className={cn("size-4 shrink-0", active ? "" : TONE_TEXT[hue])}
                          />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
