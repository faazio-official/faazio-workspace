"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronLeft, LogOut, PanelLeft, Search } from "lucide-react";
import { SELLER_NAV } from "@/components/layout/nav";
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
import { BrandTile } from "@/components/brand/FaazioMark";

export function SellerShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const groups = Array.from(new Set(SELLER_NAV.map((i) => i.group)));

  return (
    <RoleGate allow={["SELLER"]}>
      <div className="flex min-h-screen bg-background">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-border bg-card lg:flex lg:flex-col",
            collapsed ? "w-16" : "w-60",
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b border-border px-3">
            <BrandTile className="size-7 rounded-md" />
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">Faazio Seller</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {session?.name ?? "Partner"}
                </p>
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
                ) : null}
                {SELLER_NAV.filter((i) => i.group === group).map((item) => {
                  const active =
                    pathname === item.to ||
                    (item.to !== "/seller" && pathname.startsWith(`${item.to}/`));
                  return (
                    <Link
                      key={item.to}
                      href={item.to}
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
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Search products, orders" className="h-9 pl-8 text-[13px]" />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="size-4" />
              </Button>
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
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 lg:px-6">{children}</main>
        </div>
      </div>
    </RoleGate>
  );
}
