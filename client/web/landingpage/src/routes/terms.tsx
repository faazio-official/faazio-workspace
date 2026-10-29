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
import {
  BUSINESS_CITY,
  BUSINESS_EMAIL,
  BUSINESS_LEGAL_NAME,
  BUSINESS_PHONE,
  BUSINESS_POSTAL_CODE,
  BUSINESS_REGION,
  BUSINESS_STREET_ADDRESS,
} from "@/lib/site";

const title = "Terms & Conditions — Faazio | Using the Faazio app";
const description =
  "The terms that govern your use of Faazio — orders and payments, deliveries, prescription medicines, returns and refunds, acceptable use, and how disputes are handled.";
const keywords =
  "Faazio terms and conditions, Faazio user agreement, Faazio terms of service, Faazio returns, Faazio refunds, Faazio Karaikal terms";

export const Route = createFileRoute("/terms")({
  component: TermsAndConditions,
  head: () => seoHead({ path: "/terms", title, description, keywords }),
});

const termsSections: PolicySection[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of these terms",
    body: (
      <>
        <p>
          These Terms &amp; Conditions (“Terms”) are a legal agreement between you and{" "}
          {BUSINESS_LEGAL_NAME} (“Faazio”, “we”, “us”, or “our”), which operates the Faazio apps
          (Mart, Food, Pharma, and community features) and the website at https://faazio.com
          (together, the “Service”).
        </p>
        <p>
          By creating an account, placing an order, or otherwise using the Service, you agree to
          these Terms and to our{" "}
          <a href="/privacy" className={legalLinkClass}>
            Privacy Policy
          </a>
          . If you do not agree, please do not use the Service.
        </p>
        <p>
          <strong>Effective date:</strong> {LEGAL_EFFECTIVE_DATE}.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "2. Who can use Faazio",
    body: (
      <>
        <p>
          You must be at least 18 years old and legally able to enter into a contract to use the
          Service. You agree to provide accurate, current, and complete information when you
          register and to keep it up to date.
        </p>
        <p>
          You are responsible for activity that happens through your account and for keeping your
          phone number, one-time passwords (OTPs), and device secure. Tell us immediately if you
          believe your account has been used without your permission.
        </p>
      </>
    ),
  },
  {
    id: "the-service",
    title: "3. What Faazio does",
    body: (
      <>
        <p>
          Faazio is a platform that connects you with local sellers, restaurants, and pharmacies
          (together, “Partners”) and with independent delivery partners. Faazio helps you discover
          products, place orders, pay, and track delivery, but the products are sold and supplied by
          the relevant Partner, not by Faazio.
        </p>
        <p>
          Availability of products, stores, and delivery areas can change and may depend on where
          you are, the time of day, and Partner capacity. We may add, change, or remove features of
          the Service at any time.
        </p>
      </>
    ),
  },
  {
    id: "orders-payments",
    title: "4. Orders and payments",
    body: (
      <>
        <p>
          An order is an offer to buy from a Partner. It is accepted when the Partner confirms it
          (or, where applicable, when we confirm availability on the Partner's behalf). Prices,
          taxes, delivery fees, and any applicable charges are shown before you pay.
        </p>
        <PolicyList
          items={[
            "Prices are set by Partners and may change. The price you pay is the price shown at checkout when you confirm the order.",
            "You may pay using the methods offered at checkout. Payments are processed by third-party payment providers; we do not store full card numbers or CVV codes.",
            "If a payment fails, is reversed, or is suspected to be fraudulent, we may cancel the order and ask you to use another method.",
            "You are responsible for any charges your bank or payment provider applies.",
          ]}
        />
      </>
    ),
  },
  {
    id: "deliveries",
    title: "5. Deliveries and fulfilment",
    body: (
      <>
        <p>
          Delivery times are estimates and can be affected by weather, traffic, Partner preparation
          time, and demand. Where pickup is offered, you must collect the order within the stated
          window.
        </p>
        <PolicyList
          items={[
            "Please provide an accurate delivery address and keep your phone reachable while an order is on the way.",
            "If you cannot be reached or the address is incorrect, the order may fail or be returned and may not be refundable.",
            "Delivery partners act as independent contractors. They are not employees of Faazio.",
            "For age-restricted or regulated items, we may ask for identification at handover.",
          ]}
        />
      </>
    ),
  },
  {
    id: "pharma",
    title: "6. Prescription medicines (Pharma)",
    body: (
      <>
        <p>
          Some medicines can only be supplied against a valid prescription. Where a prescription is
          required, you must upload a clear, valid, and unaltered prescription issued by a
          registered medical practitioner. Orders may be reviewed by a pharmacist before they are
          dispensed.
        </p>
        <PolicyList
          items={[
            "We may refuse or cancel an order if the prescription is invalid, expired, incomplete, or appears altered.",
            "Information on Faazio is for general guidance and is not medical advice. Always follow the advice of your doctor or pharmacist.",
            "Do not order prescription medicines for anyone other than the person named on the prescription.",
            "Regulated medicines may not be returnable once dispensed, except where required by law.",
          ]}
        />
        <p>
          See our{" "}
          <a href="/disclaimer" className={legalLinkClass}>
            Disclaimer
          </a>{" "}
          for more on health information.
        </p>
      </>
    ),
  },
  {
    id: "returns-refunds",
    title: "7. Returns, refunds, and cancellations",
    body: (
      <>
        <p>
          Returns, refunds, and cancellations depend on the product and the Partner. Perishable
          groceries, prepared food, and dispensed medicines generally cannot be returned unless the
          item is damaged, spoiled, incorrect, or missing.
        </p>
        <p>
          You can request help from the order screen or by contacting support. Approved refunds are
          made to the original payment method, and timing depends on your bank or payment provider.
          Full details are in our{" "}
          <a href="/refunds" className={legalLinkClass}>
            Refund &amp; Cancellation Policy
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "conduct",
    title: "8. Your conduct",
    body: (
      <>
        <p>You agree not to:</p>
        <PolicyList
          items={[
            "use the Service for any unlawful, fraudulent, or harmful purpose;",
            "impersonate another person or provide false information;",
            "interfere with, disrupt, or attempt to gain unauthorised access to the Service or its systems;",
            "scrape, copy, or misuse content or data from the Service;",
            "abuse Partners, delivery partners, or our support team, including through harassment or threats;",
            "place orders you do not intend to pay for or repeatedly refuse deliveries without cause.",
          ]}
        />
        <p>
          We may suspend or close an account, cancel orders, or restrict access where we reasonably
          believe these Terms have been broken or the Service is being misused.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "9. Intellectual property",
    body: (
      <p>
        The Faazio name, logo, apps, website, and content we create are owned by{" "}
        {BUSINESS_LEGAL_NAME} or its licensors and are protected by applicable intellectual-property
        laws. We grant you a limited, personal, non-exclusive, non-transferable right to use the
        Service for your own non-commercial use. You may not copy, modify, distribute, or create
        derivative works from our content without our written permission. Product listings, images,
        and marks supplied by Partners remain theirs.
      </p>
    ),
  },
  {
    id: "disclaimers-liability",
    title: "10. Disclaimers and limitation of liability",
    body: (
      <>
        <p>
          The Service is provided on an “as is” and “as available” basis. To the extent permitted by
          law, we do not guarantee that the Service will be uninterrupted, error-free, or that
          product information will always be complete or accurate. Partner products and services are
          the responsibility of the relevant Partner.
        </p>
        <p>
          To the extent permitted by law, Faazio is not liable for indirect, incidental, special, or
          consequential losses, or for loss of profits, data, or goodwill. Nothing in these Terms
          limits rights you have under mandatory consumer-protection law.
        </p>
        <p>
          See our{" "}
          <a href="/disclaimer" className={legalLinkClass}>
            Disclaimer
          </a>{" "}
          for more detail.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    title: "11. Suspension and termination",
    body: (
      <p>
        You may stop using the Service at any time and can delete your account from the app or by
        contacting us. We may suspend or terminate your access if you breach these Terms, if
        required by law, or to protect the Service and other users. Provisions that by their nature
        should survive termination (such as intellectual property, disclaimers, and liability) will
        continue to apply.
      </p>
    ),
  },
  {
    id: "delivery-partners",
    title: "12. Delivery partner terms",
    body: (
      <>
        <p>
          If you deliver orders on Faazio, you do so as an independent contractor, not as an
          employee, agent, or partner of {BUSINESS_LEGAL_NAME}. You are responsible for your own
          taxes, vehicle, and any licences or permits the law requires, and you control when and how
          you work.
        </p>
        <PolicyList
          items={[
            "You must provide the identity, vehicle, and KYC information needed to verify you, and keep it accurate.",
            "You must comply with all applicable laws and provide lawful assistance to the police or other authorities when presented with an official request.",
            "You must treat customers, Partners, and our team with respect, and deliver orders safely and without tampering.",
            "We may suspend or blacklist a delivery partner for breach of these terms, fraud, or safety concerns.",
          ]}
        />
        <p>
          By registering as a delivery partner, you agree to these terms, including your
          independent-contractor status and the obligation to assist law enforcement on a lawful
          request.
        </p>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "13. Governing law and disputes",
    body: (
      <p>
        These Terms are governed by the laws of India. Subject to any mandatory consumer-protection
        rights, disputes are subject to the exclusive jurisdiction of the courts at {BUSINESS_CITY},{" "}
        {BUSINESS_REGION}. Before starting formal proceedings, please contact us so we can try to
        resolve the issue.
      </p>
    ),
  },
  {
    id: "changes",
    title: "14. Changes to these terms",
    body: (
      <p>
        We may update these Terms from time to time. The effective date at the top of this page
        shows when they last changed. If we make a material change, we will notify you in the app or
        on this page before it takes effect. Continuing to use the Service after a change means you
        accept the updated Terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "15. Contact us",
    body: (
      <>
        <p>Questions about these Terms? Contact:</p>
        <address className="mt-3 not-italic text-[14px] leading-7 text-muted-foreground">
          <strong>{BUSINESS_LEGAL_NAME}</strong>
          <br />
          {BUSINESS_STREET_ADDRESS}
          <br />
          {BUSINESS_CITY}, {BUSINESS_REGION} {BUSINESS_POSTAL_CODE}
          <br />
          India
          <br />
          Email:{" "}
          <a href={`mailto:${BUSINESS_EMAIL}`} className={legalLinkClass}>
            {BUSINESS_EMAIL}
          </a>
          <br />
          Phone:{" "}
          <a href={`tel:${BUSINESS_PHONE.replace(/[^+\d]/g, "")}`} className={legalLinkClass}>
            {BUSINESS_PHONE}
          </a>
        </address>
      </>
    ),
  },
];

function TermsAndConditions() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="terms-title">
          <div className="page-width">
            <p className="eyebrow">TERMS &amp; CONDITIONS</p>
            <h1 id="terms-title">The ground rules, in plain language.</h1>
            <p className="page-lead">
              These terms explain how Faazio works, what you can expect from us, and what we expect
              from you across Mart, Food, Pharma, and community features.
            </p>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Effective {LEGAL_EFFECTIVE_DATE} · Applies to faazio.com and the Faazio apps
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width">
            <div className="content-block">
              <h2 className="sr-only">Terms and conditions details</h2>
              <Accordion type="multiple" defaultValue={termsSections.map((section) => section.id)}>
                {termsSections.map((section) => (
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
