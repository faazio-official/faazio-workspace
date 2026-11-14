import { createFileRoute, useRouter } from "@tanstack/react-router";
import { MapPin, X } from "lucide-react";
import { RequireAuth } from "@/components/partner/Shell";
import { ZoneMap } from "@/components/partner/ZoneMap";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/zone-map")({
  head: () => ({ meta: [
    { title: "Zone Map · ZIP Partner" },
    { name: "description", content: "Explore your assigned Karaikal delivery zone and nearby restaurants." },
    { property: "og:title", content: "Zone Map · ZIP Partner" },
    { property: "og:description", content: "Explore your assigned Karaikal delivery zone and nearby restaurants." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ZonePage,
});

function ZonePage() {
  const router = useRouter();
  return <RequireAuth><div className="flex h-dvh flex-col overflow-hidden">
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-center border-b bg-card">
      <Button variant="ghost" size="icon" className="absolute left-3" aria-label="Close zone map" title="Close zone map" onClick={() => window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" })}><X className="!h-5 !w-5" /></Button>
      <h1 className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-primary" />ZONE MAP</h1>
    </header>
    <ZoneMap />
  </div></RequireAuth>;
}