"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronLeft, LogOut, Menu, PanelLeft, Search } from "lucide-react";
import { activeNavHref, normalizeNavPath, SELLER_NAV } from "@/components/layout/nav";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { groupTone, TONE_SOFT, TONE_TEXT, TONE_VAR } from "@/lib/ui/tones";
import { useSession } from "@/lib/hooks/useSession";
import { signOut } from "@/lib/api";
import { RoleGate } from "@/components/layout/RoleGate";
import { FaazioWordmark } from "@/components/brand/FaazioWordmark";
import { SellerPushBridge } from "@/components/layout/SellerPushBridge";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

export function SellerShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const groups = Array.from(new Set(SELLER_NAV.map((i) => i.group)));
  const current = activeNavHref(pathname, SELLER_NAV);
  const closeMobileNav = useCallback(() => setMobileNav(false), []);

  useEffect(() => {
    if (session?.mustChange && session.role !== "SUPER_ADMIN" && pathname !== "/security") {
      router.replace("/security");
    }
  }, [pathname, router, session?.mustChange, session?.role]);

  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);

  return (
    <RoleGate allow={["SELLER"]}>
      <SellerPushBridge />
      <div className="flex min-h-screen bg-background lg:h-screen lg:overflow-hidden">
        {/* The desktop sidebar is hidden below lg, so expose the same navigation in a
            touch-friendly drawer shared with the admin consoles. */}
        <MobileNavDrawer
          open={mobileNav}
          onClose={closeMobileNav}
          nav={SELLER_NAV}
          pathname={pathname}
          scopeLabel="Seller console"
        />
        <aside
          className={cn(
            "hidden h-screen shrink-0 border-r border-border bg-card lg:flex lg:flex-col",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b border-border px-3">
            {!collapsed ? (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <div className="min-w-0">
                  <FaazioWordmark className="brand-wordmark text-primary" />
                  <p className="truncate text-[11px] text-muted-foreground">
                    {session?.name ?? "Partner"}
                  </p>
                </div>
                <ComponentHelp helpKey="shell:seller-nav" label="About seller navigation" />
              </div>
            ) : null}
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3">
            {groups.map((group) => {
              const hue = groupTone(group);
              return (
                <div key={group} className="mb-3">
                  {!collapsed ? (
                    <p
                      className={cn(
                        "flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold",
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
                  ) : null}
                  {SELLER_NAV.filter((i) => i.group === group).map((item) => {
                    const active = normalizeNavPath(item.to) === current;
                    return (
                      <Link
                        key={item.to}
                        href={item.to}
                        className={cn(
                          "focus-ringed mb-0.5 flex items-center gap-2 rounded-md px-2 py-2 text-[13px] transition-colors",
                          active
                            ? cn("font-semibold shadow-sm", TONE_SOFT[hue])
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        <item.icon
                          className={cn("size-4 shrink-0", active ? "" : TONE_TEXT[hue])}
                        />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? <PanelLeft className="size-4" /> : <ChevronLeft className="size-4" />}
              {!collapsed ? "Collapse" : null}
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur lg:static">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              aria-controls="mobile-nav-drawer"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(true)}
            >
              <Menu className="size-4" />
            </Button>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Search products, orders" className="h-[36px] pl-8 text-[13px]" />
              <ComponentHelp
                helpKey="shell:seller-search"
                className="absolute right-2 top-2"
                label="About seller search"
              />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="size-4" />
              </Button>
              <ComponentHelp helpKey="shell:seller-bell" label="About seller notifications" />
              <ComponentHelp helpKey="shell:seller-user" label="About your account menu" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {(session?.name ?? "S").slice(0, 1)}
                    </span>
                    <span className="hidden text-[13px] sm:inline">{session?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">
                    {session?.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/seller/settings">Account settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      void signOut();
                      router.push("/login");
                    }}
                  >
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 lg:min-h-0 lg:overflow-y-auto lg:px-6">
            {children}
          </main>
        </div>
      </div>
    </RoleGate>
  );
}
