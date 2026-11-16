"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { activeNavHref, normalizeNavPath, type NavItem } from "@/components/layout/nav";
import { SidebarNavGroupLabel, SidebarNavLink } from "@/components/layout/SidebarNavLink";
import { Button } from "@/components/ui/button";
import { FaazioWordmark } from "@/components/brand/FaazioWordmark";
import { DURATION, EASE } from "@/lib/motion";
import type { AuthUser } from "@/data/types";

export function MobileNavDrawer({
  open,
  onClose,
  nav,
  pathname,
  scope,
  session,
  scopeLabel,
}: {
  open: boolean;
  onClose: () => void;
  nav: NavItem[];
  pathname: string;
  scope?: "DISTRICT" | "SUPER";
  session?: AuthUser | null;
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

  return (
    <AnimatePresence>
      {open ? (
        <m.div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`${scopeLabel} navigation`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: DURATION.exit, ease: EASE.entrance } }}
          transition={{ duration: DURATION.press, ease: EASE.entrance }}
        >
          <m.button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: DURATION.exit, ease: EASE.entrance } }}
            transition={{ duration: DURATION.press, ease: EASE.entrance }}
          />
          <m.div
            ref={panelRef}
            id="mobile-nav-drawer"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-sidebar-border bg-sidebar shadow-xl"
            onKeyDown={onPanelKeyDown}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%", transition: { duration: DURATION.exit, ease: EASE.entrance } }}
            transition={{ duration: DURATION.enter, ease: EASE.entrance }}
          >
        <div className="flex h-14 items-center gap-2 border-b border-border px-3">
          <div className="min-w-0">
            <FaazioWordmark className="brand-wordmark text-primary" />
            <p className="truncate text-[11px] text-sidebar-muted">{scopeLabel}</p>
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
        {scope === "DISTRICT" && session?.role === "SUPER_ADMIN" ? (
          <Link
            href="/admin/super"
            onClick={onClose}
            className="mx-2 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-primary hover:bg-secondary"
          >
            <ArrowLeft className="size-4 shrink-0" />
            Return to super admin
          </Link>
        ) : null}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {groups.map((group) => (
            <div key={group} className="mb-5">
              <SidebarNavGroupLabel>{group}</SidebarNavGroupLabel>
              <div>
                {nav
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <SidebarNavLink
                      key={item.to}
                      item={item}
                      active={normalizeNavPath(item.to) === current}
                      onNavigate={onClose}
                    />
                  ))}
              </div>
            </div>
          ))}
        </nav>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
