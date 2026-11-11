import { createFileRoute } from "@tanstack/react-router";
import { PolicyList, type PolicySection, legalLinkClass } from "@/components/legal";
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
  BUSINESS_REGION,
} from "@/lib/site";

const title = "Seller & Partner Terms — Faazio | Selling on Faazio";
const description =
  "The merchant agreement for selling on Faazio — the contract tier and commission, payouts, KYC and compliance, the content and IP licence, and how the partnership can end.";
const keywords =
  "Faazio seller terms, Faazio partner terms, Faazio merchant agreement, sell on Faazio, Faazio commission, Faazio payouts, Faazio seller compliance, Faazio IP licence";

export const Route = createFileRoute("/seller-terms")({
  component: SellerTerms,
  head: () => seoHead({ path: "/seller-terms", title, description, keywords }),
});

const EFFECTIVE_DATE = "11 November 2026";

const sellerTermsSections: PolicySection[] = [
  {
    id: "acceptance",
    title: "1. Acceptance and parties",
    body: (
      <>
        <p>
          These Seller &amp; Partner Terms (“Partner Terms”) are a legal agreement between you (the
          business that applies to sell on Faazio) and {BUSINESS_LEGAL_NAME} (“Faazio”, “we”, “us”,
          or “our”), which operates the Faazio apps and the website at https://faazio.com.
        </p>
        <p>
          They apply to every shop you operate on Faazio Mart, Faazio Food, and Faazio Pharma. By
          applying to become a Partner, you agree to these Partner Terms, our{" "}
          <a href="/terms" className={legalLinkClass}>
            Terms &amp; Conditions
          </a>
          , our{" "}
          <a href="/privacy" className={legalLinkClass}>
            Privacy Policy
          </a>
          , and the Content &amp; IP Licence set out in section 9 (accepted as a separate clickwrap
          in the app).
        </p>
        <p>
          <strong>This page is for reading.</strong> The binding acceptance happens when you apply
          in the Faazio Seller app: you tick the three clickwrap acceptances separately, and our
          server records the date and time, a hashed form of the connecting IP address, and the
          account that accepted. If you do not agree, do not submit an application.
        </p>
        <p>
          You confirm that you are at least 18 years old and authorised to bind the business you are
          applying for. <strong>Effective date:</strong> {EFFECTIVE_DATE}.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "2. Your application and account",
    body: (
      <>
        <p>
          A Faazio Partner account may own one or more shops. Each shop is listed with its own app,
          category, address, map pin, and any licence that applies to it. You are responsible for
          every shop under your account, including the people who help you run it.
        </p>
        <PolicyList
          items={[
            "Give us accurate, current, and complete business information — your legal name, owner name, PAN, GSTIN where you have one, address, contact phone and email, and payout bank details.",
            "Use a bank account that belongs to the business or that you are authorised to use for its payouts.",
            "Keep your login credentials and any staff sub-user access secure, and tell us promptly if you believe they have been misused.",
            "Tell us when a material detail changes — ownership, address, bank account, licences, or the contact person for your account.",
          ]}
        />
      </>
    ),
  },
  {
    id: "shops-listings",
    title: "3. Your shops and listings",
    body: (
      <>
        <p>
          You control what you sell and at what price. Listings must be accurate and lawful, and
          must not include items you are not licensed or permitted to sell.
        </p>
        <PolicyList
          items={[
            "Keep product names, descriptions, images, prices, stock, opening hours, and availability up to date.",
            "Use images and descriptions you own or are authorised to use.",
            "For Faazio Food, follow food-safety and hygiene requirements and hold any FSSAI registration or licence that applies.",
            "For Faazio Pharma, sell prescription medicines only against a valid prescription, dispense through a licensed pharmacist where the law requires it, and comply with drug-licensing rules.",
            "Do not list restricted, unsafe, counterfeit, or prohibited products.",
          ]}
        />
      </>
    ),
  },
  {
    id: "verification-compliance",
    title: "4. Verification, KYC, and compliance",
    body: (
      <>
        <p>
          Before your account can be activated, and from time to time afterwards, we may check your
          identity, business details, bank account, and licences. We may ask for documents and may
          use third-party or government verification services where they are available.
        </p>
        <PolicyList
          items={[
            "An application may stay pending while we review it, and we may ask for more information or decline it.",
            "A failed check — for example, an invalid identifier or an expired licence — can prevent activation until it is corrected.",
            "We may re-check your details after a change, and a material change may return your account to review.",
            "You must cooperate with lawful requests from regulators or authorities that relate to your shop.",
          ]}
        />
        <p>
          Verification is not a guarantee that your business, products, or licences comply with the
          law. That responsibility remains yours.
        </p>
      </>
    ),
  },
  {
    id: "tier-commission-fees",
    title: "5. Contract tier, commission, and fees",
    body: (
      <>
        <p>
          Before you apply, the Seller app shows the rate cards available. You choose a contract
          tier, and the tier, rate-card version, commission percentage, and settlement terms are
          recorded with your application. The current rate card is:
        </p>
        <PolicyList
          items={[
            <>
              <strong>Starter</strong> — 12% commission, payouts T+3 business days after delivery.
            </>,
            <>
              <strong>Standard</strong> — 10% commission, payouts T+2 business days after delivery.
            </>,
            <>
              <strong>Enterprise</strong> — 8% commission, payouts T+1 business day after delivery.
            </>,
          ]}
        />
        <p>
          If the rate card shown in the app at the time you apply differs from the summary above,
          the rate card you accept in the app governs.
        </p>
        <p>
          Commission is calculated on the item value of each delivered order at the commission rate
          that applies to your shop. Applicable taxes — including GST where it applies, TCS, and TDS
          — are accounted for as required by law. Your payout is the order value less commission and
          any amount we are required to deduct.
        </p>
        <p>
          We do not deduct a separate listing or subscription fee unless we agree to one with you in
          writing. Refunds, cancellations, and adjustments can reduce the amount payable for an
          order.
        </p>
        <p>
          We may update the rate card or commission with notice to you, for example by email or in
          the seller app. A change applies to orders placed after its effective date. If you do not
          agree, you can stop listing items or end this agreement under section 11.
        </p>
      </>
    ),
  },
  {
    id: "payouts",
    title: "6. Payouts and settlement",
    body: (
      <>
        <p>
          We pay your settled balance to the bank account on file, on your tier’s schedule. Payouts
          are made in Indian rupees through our manual payout process and are itemised in your
          seller console.
        </p>
        <PolicyList
          items={[
            "Keep your bank details accurate. We are not responsible for a delay caused by incorrect details, and a returned payment may need to be re-issued.",
            "A payout may be held or adjusted while a return, refund, cancellation, chargeback, dispute, fraud check, or compliance issue is open.",
            "We may withhold amounts we are legally required to withhold, including TCS and TDS.",
            "You are responsible for your own income tax and for any GST you are required to charge and remit on your supplies.",
          ]}
        />
      </>
    ),
  },
  {
    id: "obligations",
    title: "7. Your obligations and service standards",
    body: (
      <PolicyList
        items={[
          "Accept, reject, pack, and hand over orders promptly using the seller tools, and only reject an order for a genuine reason such as stock or operational limits.",
          "Pack items safely so they arrive in the condition a customer expects, and follow any cold-chain, handling, or labelling rules that apply.",
          "Treat customers, delivery partners, and our team with respect, and do not discriminate unlawfully.",
          "Do not use Faazio orders to solicit customers to transact off the platform, or to divert a Faazio order to another channel.",
          "Respond to customer and support issues about your orders honestly and within a reasonable time.",
          "Comply with all laws that apply to your business, your staff, your products, and your premises.",
        ]}
      />
    ),
  },
  {
    id: "customer-data",
    title: "8. Customer information",
    body: (
      <>
        <p>
          You may receive a customer’s name, delivery address, phone number, and order details so
          you can prepare and fulfil an order. Use that information only for the order and for
          related customer support.
        </p>
        <PolicyList
          items={[
            "Do not use customer information for your own marketing, or share it with anyone who does not need it to fulfil the order.",
            "Protect customer information with reasonable security and tell us promptly if you become aware of a misuse or breach.",
            "Comply with applicable privacy and data-protection law when you handle customer information.",
          ]}
        />
      </>
    ),
  },
  {
    id: "ip-licence",
    title: "9. Content and IP licence",
    body: (
      <>
        <p>
          You keep ownership of your business name, logo, shop and product photographs, menus,
          descriptions, and other material you provide (“Partner Content”).
        </p>
        <p>
          By accepting these Partner Terms, you grant {BUSINESS_LEGAL_NAME} a non-exclusive,
          royalty-free, worldwide licence to host, reproduce, resize, format, display, and promote
          your Partner Content in the Faazio apps, the website, and our marketing — including social
          media and paid campaigns. We may sublicense these rights to service providers who help us
          run or market the platform, on the same basis.
        </p>
        <PolicyList
          items={[
            "The licence lasts while your account is active and ends when this agreement ends.",
            "We may keep copies for legal, accounting, audit, or dispute purposes, and content already published may remain cached or archived for a reasonable period after removal.",
            "You confirm that you own or control the Partner Content and have the rights needed to grant this licence. You must not upload material that infringes someone else’s rights.",
            "You do not receive any rights in the Faazio name, logo, apps, or platform content beyond the limited right to use the service as a Partner.",
          ]}
        />
      </>
    ),
  },
  {
    id: "suspension-termination",
    title: "10. Suspension and termination",
    body: (
      <>
        <p>
          We may pause a shop, remove a listing, or suspend your account if you breach these Partner
          Terms, if a licence or compliance check fails, if we reasonably believe there is a safety,
          fraud, or legal risk, or if the law requires it.
        </p>
        <p>
          Either party may end this agreement by giving written notice to the other. We may end it
          immediately for a serious breach, fraud, or a legal or safety risk.
        </p>
        <p>
          When the agreement ends, we will pay the settled balance for delivered orders, less any
          refunds, adjustments, or amounts we are required to withhold, after a reasonable period to
          close open orders and disputes. Sections that by their nature should survive — such as
          record-keeping, liability, and governing law — continue to apply.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "11. Responsibility and liability",
    body: (
      <>
        <p>
          You are responsible for your business, your products and services, your staff, your
          licences, your taxes, and the Partner Content you provide. Faazio is a marketplace: the
          contract for a customer’s order is between the customer and the Partner that supplies it.
        </p>
        <p>
          To the extent permitted by law, you will cover {BUSINESS_LEGAL_NAME} for third-party
          claims, losses, or costs that arise from your products, listings, Partner Content, or
          breach of these Partner Terms. This does not apply to the extent a claim is caused by
          Faazio’s own negligence or wilful misconduct.
        </p>
        <p>
          To the extent permitted by law, Faazio is not liable for indirect, incidental, special, or
          consequential losses, or for loss of profits, data, or goodwill. Nothing in these Partner
          Terms limits rights that cannot be excluded by law.
        </p>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "12. Governing law and disputes",
    body: (
      <p>
        These Partner Terms are governed by the laws of India. Subject to any rights that cannot be
        waived, disputes are subject to the exclusive jurisdiction of the courts at {BUSINESS_CITY},{" "}
        {BUSINESS_REGION}. Before starting formal proceedings, please contact us so we can try to
        resolve the issue.
      </p>
    ),
  },
  {
    id: "changes-contact",
    title: "13. Changes and contact",
    body: (
      <>
        <p>
          We may update these Partner Terms from time to time. The effective date at the top of this
          page shows when they last changed. If we make a material change, we will notify you in the
          seller console or by email before it takes effect. Where the law allows, continuing to
          sell on Faazio after the effective date means you accept the updated terms.
        </p>
        <p>
          Questions about these Partner Terms, your application, or a payout? Email{" "}
          <a href={`mailto:${BUSINESS_EMAIL}`} className={legalLinkClass}>
            {BUSINESS_EMAIL}
          </a>{" "}
          or call{" "}
          <a href={`tel:${BUSINESS_PHONE.replace(/[^+\d]/g, "")}`} className={legalLinkClass}>
            {BUSINESS_PHONE}
          </a>
          . See also our{" "}
          <a href="/terms" className={legalLinkClass}>
            Terms &amp; Conditions
          </a>{" "}
          and{" "}
          <a href="/refunds" className={legalLinkClass}>
            Refund &amp; Cancellation Policy
          </a>
          .
        </p>
      </>
    ),
  },
];

function SellerTerms() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="seller-terms-title">
          <div className="page-width">
            <p className="eyebrow">SELLER &amp; PARTNER TERMS</p>
            <h1 id="seller-terms-title">The agreement behind the shop counter.</h1>
            <p className="page-lead">
              What it means to sell on Faazio — your rate card and payouts, the checks we run, the
              licence you give us for your content, and how the partnership can end.
            </p>
            <p className="meta mt-4">
              Effective {EFFECTIVE_DATE} · For Mart, Food, and Pharma Partners
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width">
            <div className="content-block">
              <h2 className="sr-only">Seller and partner terms details</h2>
              <Accordion
                type="multiple"
                defaultValue={sellerTermsSections.map((section) => section.id)}
              >
                {sellerTermsSections.map((section) => (
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
    </>
  );
}
