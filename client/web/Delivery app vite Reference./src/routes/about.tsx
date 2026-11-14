import { createFileRoute } from "@tanstack/react-router";
import { BackHeader } from "@/components/partner/Shell";
import { aboutUs, appInfo } from "@/mocks";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About Us · ZIP Partner" }, { name: "description", content: "About ZIP Food Delivery." }, { property: "og:title", content: "About Us · ZIP Partner" }, { property: "og:description", content: "About ZIP Food Delivery." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => (
    <div className="min-h-screen"><BackHeader title="About Us" />
      <div className="m-4 space-y-3 rounded-lg bg-card p-5 text-sm leading-relaxed border">
        <p className="text-lg font-bold text-primary">{appInfo.name}</p>
        {aboutUs.map((p) => <p key={p} className="text-muted-foreground">{p}</p>)}
      </div>
    </div>
  ),
});
