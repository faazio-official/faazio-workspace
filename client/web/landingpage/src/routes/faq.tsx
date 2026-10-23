import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/lib/faqs";
import { SITE_URL } from "@/lib/site";
import { seoHead, type JsonLdNode } from "@/lib/seo";

const title = "Faazio FAQ — Download, ordering, coverage & pharmacy | Karaikal";
const description =
  "Answers to the everyday questions about Faazio — how ordering works, Karaikal coverage, pharmacy prescriptions, dining bookings, and blood donation.";
const keywords =
  "Faazio FAQ, Faazio questions, download Faazio app, ordering on Faazio, Faazio Karaikal coverage, prescription pharmacy, Faazio dining booking, Faazio blood donor";

const faqPageNode: JsonLdNode = {
  "@type": "FAQPage",
  "@id": `${SITE_URL}/faq#faq`,
  mainEntity: faqs.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export const Route = createFileRoute("/faq")({
  component: Faq,
  head: () => seoHead({ path: "/faq", title, description, keywords, extraNodes: [faqPageNode] }),
});

function Faq() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="faq-title">
          <div className="page-width">
            <p className="eyebrow">GOOD QUESTIONS.</p>
            <h1 id="faq-title">A little clarity goes a long way.</h1>
            <p className="page-lead">
              The everyday things you might want to know about Faazio — before you get started.
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width">
            <Accordion type="single" collapsible className="max-w-[720px]">
              {faqs.map(([question, answer], i) => (
                <AccordionItem value={`faq-${i}`} key={question}>
                  <AccordionTrigger className="py-6 text-[15px] font-semibold">
                    {question}
                  </AccordionTrigger>
                  <AccordionContent className="leading-7 text-muted-foreground">
                    {answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
