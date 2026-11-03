"use client";
// The hamburger entry for the seller console. The reference app renders "Explore more" as a route
// (a full-height grouped tile grid, not a sliding panel) — the seller header links here.
import Link from "next/link";
import { Menu as MenuIcon } from "lucide-react";

export function SellerHamburger() {
  return (
    <Link
      href="/seller/explore"
      aria-label="Explore more"
      className="rounded-full p-1.5 hover:bg-muted"
    >
      <MenuIcon className="h-5 w-5" />
    </Link>
  );
}