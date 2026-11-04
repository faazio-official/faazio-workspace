"use client";
// Desktop expansion of the seller console (vite reference → PC view). On ≥ md the mobile frame and
// floating tab bar are replaced by this persistent left sidebar (all SELLER_NAV groups) beside a
// wider content column. Admin shells keep their own chrome — this file is seller-only.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { activeNavHref, normalizeNavPath, SELLER_NAV } from "@/components/layout/nav";
import { FaazioWordmark } from "@/components/brand/FaazioWordmark";
import { signOut } from "@/lib/api";
import { useSession } from "@/lib/hooks/useSession";
import { useActiveStore } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { StoreSwitcher } from "@/components/sellers/StoreSwitcher";
import { SectorBadge } from "@/components/sellers/kit";

export function SellerDesktopShell({ className }: { className?: string }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { activeStore } = useActiveStore();
  const groups = Array.from(new Set(SELLER_NAV.map((i) => i.group)));
  const current = activeNavHref(pathname, SELLER_NAV);

  return (
    <aside
      className={cn(
        "hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex",
        className,
      )}
    >
      <div className="border-b border-border px-4 py-2">
        <div className="flex h-8 items-center gap-2">
          <FaazioWordmark className="brand-wordmark text-primary" />
          <p className="truncate text-[10px] text-muted-foreground">
            {session?.name ?? "Partner"}
          </p>
        </div>
        <div className="mt-1 border-t border-border pt-2">
          <StoreSwitcher caption="Active shop" align="end">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[12px] font-semibold">
                {activeStore?.name ?? "Your shop"}
              </span>
              {activeStore && <SectorBadge sector={activeStore.sector} className="uppercase" />}
            </span>
          </StoreSwitcher>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group} className="mb-4">
            <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">{group}</p>
            {SELLER_NAV.filter((i) => i.group === group).map((item) => {
              const active = normalizeNavPath(item.to) === current;
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-[13px] transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <button
          onClick={() => {
            void signOut().finally(() => router.push("/login"));
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}