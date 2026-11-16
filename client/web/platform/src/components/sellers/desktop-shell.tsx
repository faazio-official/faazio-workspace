"use client";
// Desktop expansion of the seller console (vite reference → PC view). On ≥ md the mobile frame and
// floating tab bar are replaced by this persistent left sidebar (all seller nav groups) beside a
// wider content column. Admin shells keep their own chrome — this file is seller-only.
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { activeNavHref, normalizeNavPath, sellerNavItems } from "@/components/layout/nav";
import { SidebarNavGroupLabel, SidebarNavLink } from "@/components/layout/SidebarNavLink";
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
  const nav = sellerNavItems(activeStore?.sector);
  const groups = Array.from(new Set(nav.map((i) => i.group)));
  const current = activeNavHref(pathname, nav);

  return (
    <aside
      className={cn(
        "hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar md:sticky md:top-0 md:flex md:h-[100dvh]",
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
          <StoreSwitcher caption="Active shop">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[12px] font-semibold">
                {activeStore?.name ?? "Your shop"}
              </span>
              {activeStore && <SectorBadge sector={activeStore.sector} className="uppercase" />}
            </span>
          </StoreSwitcher>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
        {groups.map((group) => (
          <div key={group} className="mb-5">
            <SidebarNavGroupLabel>{group}</SidebarNavGroupLabel>
            {nav
              .filter((i) => i.group === group)
              .map((item) => (
                <SidebarNavLink
                  key={item.to}
                  item={item}
                  active={normalizeNavPath(item.to) === current}
                />
              ))}
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