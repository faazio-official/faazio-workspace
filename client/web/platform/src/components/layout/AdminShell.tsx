"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  ChevronLeft,
  Command as CommandIcon,
  LogOut,
  Menu,
  PanelLeft,
} from "lucide-react";
import {
  activeNavHref,
  DISTRICT_ADMIN_NAV,
  normalizeNavPath,
  SUPER_ADMIN_NAV,
} from "@/components/layout/nav";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/hooks/useSession";
import { useConnectivityStore } from "@/lib/connectivityStore";
import { signOut } from "@/lib/api";
import { districtName, stateForDistrict } from "@/data/districts";
import { RoleGate } from "@/components/layout/RoleGate";
import { FaazioWordmark } from "@/components/brand/FaazioWordmark";
import { ThemeMenu } from "@/components/layout/ThemeToggle";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

export function AdminShell({
  scope,
  children,
}: {
  scope: "DISTRICT" | "SUPER";
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const guardNavigation = useConnectivityStore((s) => s.guardNavigation);

  const nav = scope === "DISTRICT" ? DISTRICT_ADMIN_NAV : SUPER_ADMIN_NAV;
  const groups = useMemo(() => Array.from(new Set(nav.map((i) => i.group))), [nav]);
  const current = activeNavHref(pathname, nav);
  const closeMobileNav = useCallback(() => setMobileNav(false), []);

  useEffect(() => {
    if (session?.mustChange && session.role !== "SUPER_ADMIN" && pathname !== "/security") {
      router.replace("/security");
    }
  }, [pathname, router, session?.mustChange, session?.role]);

  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <RoleGate allow={scope === "DISTRICT" ? ["DISTRICT_ADMIN", "SUPER_ADMIN"] : ["SUPER_ADMIN"]}>
      <div className="flex min-h-screen bg-background lg:h-screen lg:overflow-hidden">
        <aside
          className={cn(
            "hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
            {!collapsed ? (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <div className="min-w-0">
                  <FaazioWordmark className="brand-wordmark text-foreground" />
                  <p className="truncate text-[11px] text-sidebar-muted">
                    {scope === "DISTRICT" ? "District console" : "Global console"}
                  </p>
                </div>
                <ComponentHelp helpKey="shell:admin-nav" label="About admin navigation" />
              </div>
            ) : null}
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3">
            {groups.map((group) => (
              <div key={group} className="mb-4">
                {!collapsed ? (
                  <p className="px-2 pb-1 text-[11px] font-medium text-sidebar-muted">{group}</p>
                ) : null}
                {nav
                  .filter((i) => i.group === group)
                  .map((item) => {
                    const active = normalizeNavPath(item.to) === current;
                    return (
                      <Link
                        key={item.to}
                        href={item.to}
                        className={cn(
                          "focus-ringed mb-0.5 flex items-center gap-2 rounded-md px-2 py-2 text-[13px] transition-colors",
                          active
                            ? "bg-sidebar-active font-medium text-sidebar-active-foreground"
                            : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground",
                        )}
                        style={
                          active
                            ? { boxShadow: "inset 2px 0 0 0 var(--color-primary)" }
                            : undefined
                        }
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon className="size-4 shrink-0" />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </nav>

          <div className="border-t border-sidebar-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground"
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? <PanelLeft className="size-4" /> : <ChevronLeft className="size-4" />}
              {!collapsed ? "Collapse" : null}
            </Button>
          </div>
        </aside>

        <MobileNavDrawer
          open={mobileNav}
          onClose={closeMobileNav}
          nav={nav}
          pathname={pathname}
          scope={scope}
          session={session}
          scopeLabel={scope === "DISTRICT" ? "District console" : "Global console"}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur lg:static">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              aria-label="Open menu"
              aria-controls="mobile-nav-drawer"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(true)}
            >
              <Menu className="size-4" />
            </Button>
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-medium text-foreground/70">
              <span className="truncate">
                {scope === "DISTRICT"
                  ? session?.districtCode
                    ? `${session.districtCode} · ${districtName(session.districtCode)} · ${stateForDistrict(session.districtCode)}`
                    : session?.stateCode
                      ? `STATE · ${session.stateCode}`
                      : "DISTRICT"
                  : "GLOBAL · All districts"}
              </span>
            </span>
            <ComponentHelp helpKey="shell:admin-scope" label="About your scope" />
            {scope === "DISTRICT" && session?.role === "SUPER_ADMIN" ? (
              <Link
                href="/admin/super"
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                aria-label="Return to super admin console"
              >
                <ArrowLeft className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">Return to super admin</span>
              </Link>
            ) : null}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2 text-muted-foreground"
                aria-label="Search"
                onClick={() => setPaletteOpen(true)}
              >
                <CommandIcon className="size-4" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="num ml-1 hidden rounded border border-border px-1 text-[11px] sm:inline">
                  ⌘K
                </kbd>
              </Button>
              <ComponentHelp helpKey="shell:admin-search" label="About admin search" />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeMenu />
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="size-4" />
              </Button>
              <ComponentHelp helpKey="shell:admin-bell" label="About admin notifications" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                      {(session?.name ?? "A").slice(0, 1)}
                    </span>
                    <span className="hidden text-[13px] sm:inline">{session?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">
                    {session ? ROLE_LABEL[session.role] : ""} · {session?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      void signOut().finally(() => router.push("/login"));
                    }}
                  >
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ComponentHelp helpKey="shell:admin-user" label="About your account menu" />
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 lg:min-h-0 lg:overflow-y-auto lg:px-6">
            {children}
          </main>
        </div>
      </div>

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Jump to a page…" />
        <CommandList>
          <CommandEmpty>No matching page.</CommandEmpty>
          <CommandGroup heading="Pages">
            {nav.map((item) => (
              <CommandItem
                key={item.to}
                value={item.label}
                onSelect={() => {
                  setPaletteOpen(false);
                  const to = item.to;
                  if (guardNavigation(to)) router.push(to);
                }}
              >
                <item.icon className="size-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </RoleGate>
  );
}
