"use client";
import Link from "next/link";
import { ArrowRight, PartyPopper, ShieldCheck, Store } from "lucide-react";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { FaazioWordmark } from "@/components/brand/FaazioWordmark";


const ROLE_CARDS = [
  {
    role: "SELLER" as const,
    to: "/seller",
    icon: Store,
    blurb: "List products, set pricing, run orders, opt into festival campaigns.",
  },
  {
    role: "DISTRICT_ADMIN" as const,
    to: "/admin/district",
    icon: ShieldCheck,
    blurb: "Verify sellers, moderate listings, run state campaigns within global caps.",
  },
  {
    role: "SUPER_ADMIN" as const,
    to: "/admin/super",
    icon: PartyPopper,
    blurb: "Set sector discount caps, manage district admins, watch the whole marketplace.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-4">
          <FaazioWordmark className="brand-wordmark text-primary" />
          <Button asChild size="sm" className="ml-auto">
            <Link href="/login">
              Sign in <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-10">
        <h1 className="max-w-2xl text-[26px] font-semibold leading-tight">
          The console behind the Faazio SuperApp — MART, FOOD and PHARMA supply in one place.
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] text-muted-foreground">
          Nothing reaches a shopper unless a seller listed it here and an admin cleared it. Sign in
          with the credentials your Faazio contact issued.
        </p>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {ROLE_CARDS.map((card) => (
            <Link key={card.role} href={card.to} className="surface lift block p-5">
              <card.icon className="size-5 text-primary" />
              <p className="mt-3 text-[15px] font-semibold">{ROLE_LABEL[card.role]}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{card.blurb}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-interactive">
                Open console <ArrowRight className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>

      </main>
    </div>
  );
}

export default Landing;
