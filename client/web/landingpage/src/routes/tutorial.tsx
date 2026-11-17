import { createFileRoute } from "@tanstack/react-router";
import {
  HiOutlineBell,
  HiOutlineBuildingStorefront,
  HiOutlineCheckCircle,
  HiOutlineCog6Tooth,
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlineInbox,
  HiOutlineLifebuoy,
  HiOutlineReceiptPercent,
  HiOutlineSparkles,
  HiOutlineWallet,
} from "react-icons/hi2";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SellerTour } from "@/components/tutorial/seller-tour";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SELLER_ONBOARDING_STATUS, SELLER_TOUR_STEPS } from "@/lib/tutorials/seller-onboarding";
import { SELLER_JOURNEY_CHAPTERS } from "@/lib/tutorials/seller-journey";
import { SITE_URL } from "@/lib/site";
import { seoHead, type JsonLdNode } from "@/lib/seo";

const title = "How to sell on Faazio — the full seller journey | Karaikal";
const description =
  "Every step of selling on Faazio, animated: apply, set up your store, add and maintain products, run offers and add-ons, fulfil orders with the pickup QR, then manage notifications, payouts and settings.";
const keywords =
  "sell with Faazio, Faazio seller tutorial, Faazio seller portal, seller orders pickup QR, seller payouts, become a Faazio partner, sell online Karaikal";

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

const journeyNode: JsonLdNode = {
  "@type": "ItemList",
  "@id": `${SITE_URL}/tutorial#seller-journey`,
  name: "The Faazio seller journey",
  description:
    "The chapters of the seller walkthrough, from the application through store setup, catalog, orders, notifications, payouts and settings.",
  itemListElement: SELLER_JOURNEY_CHAPTERS.map((chapter, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: chapter.title,
    description: chapter.subtitle,
  })),
};

const requiredItems = [
  "Business name, owner name and PAN — a GSTIN is optional",
  "Business address and a contact phone and email",
  "Bank account, IFSC and a passbook photo",
  "Each shop's name, address, category and its own pin",
  "FSSAI details for food, or a drug licence for pharmacy",
  "A phone that can receive the one-time code",
];

const chapterIcons = [
  HiOutlineBuildingStorefront,
  HiOutlineCube,
  HiOutlineReceiptPercent,
  HiOutlineInbox,
  HiOutlineBell,
  HiOutlineWallet,
  HiOutlineCog6Tooth,
  HiOutlineSparkles,
  HiOutlineLifebuoy,
] as const;

const afterApply = SELLER_JOURNEY_CHAPTERS.slice(1);

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
  [
    "Does this cover the whole seller portal?",
    "Yes. Onboarding is chapter 1; the other nine chapters walk through store setup, products, offers and add-ons, orders, notifications, payouts, settings and the remaining console surfaces. The walkthrough is an illustration — the real work happens in the Faazio app and the seller portal.",
  ],
];

export const Route = createFileRoute("/tutorial")({
  component: Tutorial,
  head: () =>
    seoHead({
      path: "/tutorial",
      title,
      description,
      keywords,
      extraNodes: [howToNode, journeyNode],
    }),
});

function Tutorial() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="tutorial-title">
          <div className="page-width">
            <p className="eyebrow">Tutorials</p>
            <h1 id="tutorial-title">How selling on Faazio works.</h1>
            <p className="page-lead">
              Every seller action, animated — from Sell with us in the app to products, offers,
              orders, payouts and settings in the seller portal.
            </p>
            <p className="hero-note">
              <span className="open-dot" aria-hidden="true" />
              {SELLER_ONBOARDING_STATUS}
            </p>
          </div>
        </section>

        <section id="seller-onboarding" className="section" aria-labelledby="seller-tour-title">
          <div className="page-width">
            <div className="section-head">
              <div className="section-head-copy">
                <h2 id="seller-tour-title" className="headline">
                  The walkthrough.
                </h2>
              </div>
              <p>
                One row per chapter, in the order you meet them. Open a row to watch it once, or
                step through it yourself.
              </p>
            </div>
            <SellerTour />
          </div>
        </section>

        <section className="section" aria-labelledby="seller-guide-title">
          <div className="page-width tour-guide">
            <div>
              <h2 id="seller-guide-title" className="headline">
                What you&apos;ll need.
              </h2>
              <ul className="tour-checklist">
                {requiredItems.map((item) => (
                  <li key={item}>
                    <HiOutlineCheckCircle aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="headline">After approval.</h2>
              <p style={{ marginTop: 10 }}>
                A district admin checks your KYC documents first. Once verified, Faazio creates your
                portal login and these chapters open up.
              </p>
              <ol className="steps" style={{ marginTop: 20 }}>
                {afterApply.map((chapter, index) => {
                  const Icon = chapterIcons[index % chapterIcons.length]!;
                  return (
                    <li key={chapter.id} className="step">
                      <span className="step-number" aria-hidden="true">
                        <Icon width={13} height={13} />
                      </span>
                      <div className="step-body">
                        <h3>{chapter.title}</h3>
                        <p>{chapter.subtitle}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="action-row">
                <a href="/partners" className="btn btn-outline">
                  Partner with Faazio
                </a>
                <a href="/seller-terms" className="btn btn-ghost btn-sm">
                  <HiOutlineDocumentText aria-hidden="true" />
                  Seller &amp; Partner Terms
                </a>
              </div>
            </div>
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
