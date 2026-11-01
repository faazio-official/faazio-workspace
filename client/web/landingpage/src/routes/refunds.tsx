import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import {
  LEGAL_EFFECTIVE_DATE,
  PolicyList,
  type PolicySection,
  legalLinkClass,
} from "@/components/legal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { seoHead } from "@/lib/seo";
import { BUSINESS_EMAIL } from "@/lib/site";

const title = "Refund & Cancellation Policy — Faazio | Mart, Food, Pharma";
const description =
  "When and how you can return items, cancel orders, or get a refund on Faazio across Mart groceries, Food orders, and Pharma medicines.";
const keywords =
  "Faazio refund policy, Faazio cancellation policy, Faazio returns, Faazio grocery refund, Faazio food refund, Faazio pharma refund";

export const Route = createFileRoute("/refunds")({
  component: RefundPolicy,
  head: () => seoHead({ path: "/refunds", title, description, keywords }),
});

const refundSections: PolicySection[] = [
  {
    id: "overview",
    title: "1. Overview",
    body: (
      <>
        <p>
          This policy explains how returns, cancellations, and refunds work on Faazio. Because the
          products are supplied by Partners (sellers, restaurants, and pharmacies), eligibility
          depends on the type of product and the Partner's policy, in addition to your rights under
          consumer-protection law.
        </p>
        <p>
          Nothing here reduces any non-waivable rights you have under applicable law, including
          India's Consumer Protection Act, 2019.
        </p>
      </>
    ),
  },
  {
    id: "mart",
    title: "2. Faazio Mart (groceries and essentials)",
    body: (
      <PolicyList
        items={[
          "Unopened, non-perishable packaged items in resalable condition may be eligible for a return or refund, reported soon after delivery.",
          "Perishables such as fresh produce, dairy, meat, and bakery items can generally only be refunded if they are damaged, spoiled, expired, or not as described.",
          "If an item is missing, incorrect, or damaged, report it from the order screen with a photo where possible.",
        ]}
      />
    ),
  },
  {
    id: "food",
    title: "3. Faazio Food (restaurant orders)",
    body: (
      <PolicyList
        items={[
          "Prepared food is made to order and is generally non-returnable and non-refundable once delivered.",
          "If your order is missing items, spilled, cold, or materially different from what you ordered, report it from the order screen — we may issue a partial or full refund or a credit at our discretion.",
          "Refunds for taste or personal preference are not usually available, unless the item was faulty or not as described.",
        ]}
      />
    ),
  },
  {
    id: "pharma",
    title: "4. Faazio Pharma (medicines and health products)",
    body: (
      <PolicyList
        items={[
          "For safety and legal reasons, medicines that have been dispensed generally cannot be returned or exchanged, unless they were supplied incorrectly, damaged, expired, or are subject to a recall.",
          "If a prescription order was declined or could not be fulfilled, any amount already paid for the unavailable items is refunded.",
          "Prescription medicines must be returned through an authorised process where the law permits, so that they are disposed of safely.",
        ]}
      />
    ),
  },
  {
    id: "cancellations",
    title: "5. Cancellations",
    body: (
      <PolicyList
        items={[
          "You can cancel an order before the Partner confirms or starts preparing it. Cancellation may not be possible once preparation or dispatching has begun.",
          "If a delivery cannot be completed because you are unreachable, the address is incorrect, or you refuse the order without a valid reason, it may not be refundable.",
          "We may cancel an order if items are unavailable, if there is a pricing or payment error, or if we reasonably suspect fraud or misuse.",
        ]}
      />
    ),
  },
  {
    id: "how-to-request",
    title: "6. How to request a refund",
    body: (
      <>
        <p>To request a return or refund:</p>
        <PolicyList
          items={[
            "Open the order in the app and choose the option to report a problem, or",
            <>
              email{" "}
              <a href={`mailto:${BUSINESS_EMAIL}`} className={legalLinkClass}>
                {BUSINESS_EMAIL}
              </a>{" "}
              from the email or phone number on your account.
            </>,
          ]}
        />
        <p>
          Please include your order number and a short description (and a photo where relevant). We
          may ask for more information so we can review the request fairly.
        </p>
      </>
    ),
  },
  {
    id: "timelines",
    title: "7. Timelines and refund method",
    body: (
      <PolicyList
        items={[
          "Approved refunds are issued to the original payment method. The amount is usually initiated within a few business days, but it can take longer to appear depending on your bank or payment provider.",
          "Cash-on-delivery or similar orders may be refunded by another agreed method, such as a bank transfer or Faazio credit, where an original-method refund is not possible.",
          "Delivery fees and other charges may be refunded where the issue is our or the Partner's responsibility, and may not be refunded for change-of-mind cancellations.",
        ]}
      />
    ),
  },
  {
    id: "contact",
    title: "8. Contact us",
    body: (
      <p>
        Questions about a refund or cancellation? Email{" "}
        <a href={`mailto:${BUSINESS_EMAIL}`} className={legalLinkClass}>
          {BUSINESS_EMAIL}
        </a>{" "}
        or use the help option on the order screen. See also our{" "}
        <a href="/terms" className={legalLinkClass}>
          Terms &amp; Conditions
        </a>
        .
      </p>
    ),
  },
];

function RefundPolicy() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="refunds-title">
          <div className="page-width">
            <p className="eyebrow">REFUND &amp; CANCELLATION POLICY</p>
            <h1 id="refunds-title">Returns, refunds, and cancellations.</h1>
            <p className="page-lead">
              What you can return or cancel on Faazio, how to request a refund, and how long it
              takes.
            </p>
            <p className="meta mt-4">
              Effective {LEGAL_EFFECTIVE_DATE} · Applies to faazio.com and the Faazio apps
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width">
            <div className="content-block">
              <h2 className="sr-only">Refund and cancellation details</h2>
              <Accordion type="multiple" defaultValue={refundSections.map((section) => section.id)}>
                {refundSections.map((section) => (
                  <AccordionItem
                    key={section.id}
                    id={section.id}
                    value={section.id}
                    className="scroll-mt-24"
                  >
                    <AccordionTrigger className="py-5 text-left text-[15px] font-medium">
                      {section.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6">{section.body}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
