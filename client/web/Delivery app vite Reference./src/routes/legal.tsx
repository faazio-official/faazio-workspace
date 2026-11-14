import { createFileRoute } from "@tanstack/react-router";
import { BackHeader } from "@/components/partner/Shell";
import { legalSections } from "@/mocks";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/legal")({
  head: () => ({ meta: [{ title: "Legal & Policies · ZIP Partner" }, { name: "description", content: "Privacy policy and terms of use." }, { property: "og:title", content: "Legal & Policies · ZIP Partner" }, { property: "og:description", content: "Privacy policy and terms of use." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => (
    <div className="min-h-screen"><BackHeader title="Legal & Policies" />
      <Accordion type="single" collapsible defaultValue={legalSections[0]?.title ?? ""} className="m-4 rounded-lg bg-card px-4 border">
        {legalSections.map((s) => <AccordionItem key={s.title} value={s.title}><AccordionTrigger>{s.title}</AccordionTrigger><AccordionContent className="text-muted-foreground">{s.body}</AccordionContent></AccordionItem>)}
      </Accordion>
    </div>
  ),
});
