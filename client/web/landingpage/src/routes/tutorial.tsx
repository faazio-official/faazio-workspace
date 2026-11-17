import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SellerOnboardingList } from "@/components/tutorial/seller-onboarding-list";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SELLER_TOUR_STEPS } from "@/lib/tutorials/seller-onboarding";
import { SITE_URL } from "@/lib/site";
import { seoHead, type JsonLdNode } from "@/lib/seo";

const title = "Seller onboarding — how to sell with Faazio | Karaikal";
const description =
  "A step-by-step guide to selling on Faazio: open Sell with us in the app, add your business and shops, accept the partner terms, verify your phone and send the application for review.";
const keywords =
  "sell with Faazio, Faazio seller onboarding, become a Faazio partner, sell online Karaikal, Faazio seller application, partner with Faazio";

const howToNode: JsonLdNode = {
  "@type": "HowTo",
  "@id": `${SITE_URL}/tutorial#seller-onboarding`,
  name: "How to apply to sell on Faazio",
  description:
    "Apply to sell on Faazio from the customer app: open My Account, choose Sell with us, and complete the application.",
  totalTime: "PT5M",
  step: SELLER_TOUR_STEPS.map((step, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: step.title,
    text: step.detail,
  })),
};

const questions: [string, string][] = [
  [
    "Where do I apply to sell on Faazio?",
    "In the Faazio app. Open My Account, choose Sell with us under Earn with us, and complete the application there. This website has no seller application form.",
  ],
  [
    "Do I need a GSTIN?",
    "A GSTIN is optional on the application. A PAN is required, together with a bank account for payouts.",
  ],
  [
    "What licences does my shop need?",
    "A food shop needs FSSAI details and a pharmacy shop needs a drug licence. Each shop also records its own address, category and pin.",
  ],
  [
    "Who reviews my application?",
    "A district admin reviews your documents. The status stays Pending review until they are verified — nothing is approved automatically.",
  ],
  [
    "What happens after approval?",
    "Faazio provisions your seller portal login. You create your store, add products and they go live after review.",
  ],
];

export const Route = createFileRoute("/tutorial")({
  component: Tutorial,
  head: () => seoHead({ path: "/tutorial", title, description, keywords, extraNodes: [howToNode] }),
});

function Tutorial() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="tutorial-title">
          <div className="page-width">
            <p className="eyebrow">Tutorials</p>
            <h1 id="tutorial-title">Seller onboarding.</h1>
          </div>
        </section>

        <section id="seller-onboarding" className="section" aria-labelledby="seller-tour-title">
          <div className="page-width">
            <div className="section-head">
              <div className="section-head-copy">
                <h2 id="seller-tour-title" className="headline">
                  The five steps.
                </h2>
              </div>
              <p>Open a step to see the screen and what you need.</p>
            </div>
            <SellerOnboardingList />
          </div>
        </section>

        <section className="section" aria-labelledby="seller-questions-title">
          <div className="page-width" style={{ maxWidth: 760 }}>
            <h2 id="seller-questions-title" className="headline">
              Good questions.
            </h2>
            <div style={{ marginTop: 20 }}>
              <Accordion type="single" collapsible>
                {questions.map(([question, answer], index) => (
                  <AccordionItem value={`seller-${index}`} key={question}>
                    <AccordionTrigger className="py-5 text-left text-[15px] font-medium">
                      {question}
                    </AccordionTrigger>
                    <AccordionContent className="text-[15px] leading-7 text-muted-foreground">
                      {answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
