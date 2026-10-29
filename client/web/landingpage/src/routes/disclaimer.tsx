import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { FaazioLogo } from "@/components/faazio-logo";
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

const title = "Disclaimer — Faazio | Health, pricing, and third-party stores";
const description =
  "Important notice about the information on Faazio — no medical advice, third-party sellers and restaurants, pricing and availability, and external links.";
const keywords =
  "Faazio disclaimer, Faazio medical disclaimer, Faazio third-party sellers, Faazio pricing notice";

export const Route = createFileRoute("/disclaimer")({
  component: Disclaimer,
  head: () => seoHead({ path: "/disclaimer", title, description, keywords }),
});

const disclaimerSections: PolicySection[] = [
  {
    id: "general",
    title: "1. General information",
    body: (
      <p>
        The information on faazio.com and in the Faazio apps is provided for general information and
        convenience only. While we try to keep it accurate and current, we make no warranty that it
        is complete, accurate, or up to date, and we may change it without notice.
      </p>
    ),
  },
  {
    id: "not-medical-advice",
    title: "2. Not medical advice (Pharma)",
    body: (
      <>
        <p>
          Nothing on Faazio is medical advice, diagnosis, or treatment. Product descriptions,
          packaging information, and general guidance are not a substitute for advice from a
          qualified doctor, pharmacist, or other healthcare professional.
        </p>
        <PolicyList
          items={[
            "Always read the label, packaging, and any instructions supplied with a medicine before use.",
            "Do not delay seeking professional medical advice because of something you read on Faazio.",
            "If you think you may have a medical emergency, contact your doctor or emergency services immediately.",
          ]}
        />
        <p>
          Prescription medicines are supplied by licensed pharmacies against a valid prescription.
          See our{" "}
          <a href="/terms" className={legalLinkClass}>
            Terms &amp; Conditions
          </a>{" "}
          for how prescription orders work.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    title: "3. Third-party sellers and restaurants",
    body: (
      <p>
        Products on Faazio are listed and supplied by independent Partners (sellers, restaurants,
        and pharmacies), and delivered by independent delivery partners. The relevant Partner is
        responsible for its listings, product quality, pricing, and compliance. Faazio facilitates
        the order but is not the seller of the goods.
      </p>
    ),
  },
  {
    id: "pricing-availability",
    title: "4. Pricing and availability",
    body: (
      <p>
        Prices, offers, stock, and estimated delivery times are set by Partners and can change at
        any time. Information shown before checkout is indicative; the price and details shown at
        checkout when you confirm an order are the ones that apply. Occasional errors (for example,
        obvious pricing mistakes) may result in an order being corrected or cancelled with a refund.
      </p>
    ),
  },
  {
    id: "external-links",
    title: "5. External links",
    body: (
      <p>
        Faazio may link to third-party websites or services, such as maps or payment pages. We do
        not control those sites and are not responsible for their content, products, or privacy
        practices. Use them at your own discretion and review their terms.
      </p>
    ),
  },
  {
    id: "limitation",
    title: "6. Limitation",
    body: (
      <p>
        To the extent permitted by law, Faazio is not liable for any loss or damage arising from
        reliance on the information on this site or from third-party products and services. This
        disclaimer does not limit any rights you have under mandatory consumer-protection law.
      </p>
    ),
  },
  {
    id: "contact",
    title: "7. Contact us",
    body: (
      <p>
        Questions about this disclaimer? Email{" "}
        <a href={`mailto:${BUSINESS_EMAIL}`} className={legalLinkClass}>
          {BUSINESS_EMAIL}
        </a>
        . See also our{" "}
        <a href="/terms" className={legalLinkClass}>
          Terms &amp; Conditions
        </a>{" "}
        and{" "}
        <a href="/privacy" className={legalLinkClass}>
          Privacy Policy
        </a>
        .
      </p>
    ),
  },
];

function Disclaimer() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="disclaimer-title">
          <div className="page-width">
            <div className="mb-4 flex items-center gap-3 text-primary">
              <FaazioLogo className="h-7 w-auto" aria-hidden="true" />
            </div>
            <p className="eyebrow">DISCLAIMER</p>
            <h1 id="disclaimer-title">What to keep in mind.</h1>
            <p className="page-lead">
              A short notice on health information, third-party stores, pricing, and external links.
            </p>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Effective {LEGAL_EFFECTIVE_DATE} · Applies to faazio.com and the Faazio apps
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width">
            <div className="content-block">
              <h2 className="sr-only">Disclaimer details</h2>
              <Accordion
                type="multiple"
                defaultValue={disclaimerSections.map((section) => section.id)}
              >
                {disclaimerSections.map((section) => (
                  <AccordionItem
                    key={section.id}
                    id={section.id}
                    value={section.id}
                    className="scroll-mt-24"
                  >
                    <AccordionTrigger className="py-6 font-display text-[19px] font-bold">
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
