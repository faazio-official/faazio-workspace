import { createFileRoute } from "@tanstack/react-router";
import {
  HiArrowRight as ArrowRight,
  HiOutlineBanknotes,
  HiOutlineCheckCircle,
  HiOutlineClipboardDocumentCheck,
  HiOutlineIdentification,
  HiOutlineInformationCircle,
  HiOutlineMapPin,
  HiOutlineSparkles,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { SellerForm } from "@/components/sell-with-us/seller-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { seoHead } from "@/lib/seo";

const title = "Sell with us — list your shop on Faazio in Karaikal";
const description =
  "Own a grocery store, restaurant or medical shop in Karaikal? Send your details, drop a pin on your shop, and the Faazio partner team will call you back to finish onboarding in the app.";
const keywords =
  "sell with Faazio, become a Faazio partner, list my shop Faazio, Faazio seller Karaikal, grocery partner Karaikal, restaurant partner Karaikal, pharmacy partner Karaikal";

export const Route = createFileRoute("/sell-with-us")({
  component: SellWithUs,
  head: () => seoHead({ path: "/sell-with-us", title, description, keywords }),
});

const benefits = [
  {
    icon: HiOutlineMapPin,
    title: "Be found nearby",
    copy: "Shoppers across Karaikal find your shop in the Faazio app — no advertising budget needed.",
  },
  {
    icon: HiOutlineUserGroup,
    title: "Bring in repeat buyers",
    copy: "Turn a walk-in customer into a regular who orders from you every week.",
  },
  {
    icon: HiOutlineSparkles,
    title: "Onboard at your pace",
    copy: "Send this short enquiry. Keep your rates, catalogue and terms; the app handles the rest.",
  },
];

const steps = [
  {
    title: "You send this enquiry",
    copy: "A minute of essentials and a pin on your shop. Nothing is created yet — no account, no password.",
  },
  {
    title: "The partner team calls you",
    copy: "We talk through your shop, your rates and the platform fee on the number you gave us.",
  },
  {
    title: "You finish the application in the app",
    copy: "The full, verified application — PAN, bank, documents and OTP — happens securely in the Faazio app.",
  },
];

const needs = [
  { icon: HiOutlineIdentification, lead: "PAN card", copy: "of the owner or the business" },
  {
    icon: HiOutlineClipboardDocumentCheck,
    lead: "A shop address and a phone",
    copy: "the number that receives the OTP",
  },
  { icon: HiOutlineBanknotes, lead: "Bank passbook", copy: "for payouts" },
  {
    icon: HiOutlineCheckCircle,
    lead: "GSTIN, if you have one",
    copy: "optional, but it speeds up verification",
  },
];

const faqs = [
  {
    q: "Is this the application?",
    a: "No. This page is an enquiry — it sends your interest to our partner team and creates no account. The full, verified application (PAN, bank, documents and OTP) happens in the Faazio app after we call you.",
  },
  {
    q: "What happens after I submit?",
    a: "The partner team calls the number you gave us to talk through your shop, your rates and the platform fee. If it's a fit, you finish the application in the app and a district admin reviews it.",
  },
  {
    q: "Do I need the app first?",
    a: "No. Send the enquiry here, then install the Faazio app when we call. The app is where the verified application is completed.",
  },
  {
    q: "What if I don't have a shop location yet?",
    a: "A registered shop address is required to list. If you're still setting up, call or email us and we'll explain what you'll need — nothing is sent without a pinned location.",
  },
  {
    q: "Is there a fee to list?",
    a: "Listing is free. Faazio earns a commission on delivered orders, at the platform fee you agree with the partner team — that's the percentage this form asks for.",
  },
];

function SellWithUs() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="sell-title">
          <div className="page-width">
            <p className="eyebrow">Sell with us</p>
            <h1 id="sell-title">Your shop, reachable by the whole neighbourhood.</h1>
            <p className="page-lead">
              Tell us a little about your shop and where it is. We&apos;ll call you back to get you
              onto Faazio — groceries, food or pharmacy.
            </p>
          </div>
        </section>

        <section className="section" aria-label="Why sell on Faazio">
          <div className="page-width">
            <div className="benefits-grid">
              {benefits.map(({ icon: Icon, title: benefitTitle, copy }) => (
                <div key={benefitTitle} className="benefit">
                  <span className="benefit-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3>{benefitTitle}</h3>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="enquiry-title">
          <div className="page-width">
            <div className="sell-intro">
              <h2 id="enquiry-title">Tell us about your shop</h2>
              <p>
                Fill in the essentials, then drop a pin where your shop is. The pin helps us route a
                delivery partner and show your shop accurately to nearby shoppers — it takes a
                minute.
              </p>
            </div>

            <aside className="sell-note" aria-labelledby="sell-note-title">
              <HiOutlineInformationCircle aria-hidden="true" className="sell-note-icon" />
              <div>
                <h2 id="sell-note-title">This is an enquiry, not the application</h2>
                <p>
                  You won&apos;t create an account or upload documents here. This short form just
                  starts the conversation; the verified application happens in the Faazio app once
                  we&apos;ve spoken. Already applied in the app?{" "}
                  <a href="/help-centre" className="sell-inline-link">
                    See the seller help centre <ArrowRight aria-hidden="true" />
                  </a>
                </p>
              </div>
            </aside>

            <div className="sell-expect">
              <div className="sell-panel">
                <h2>What happens next</h2>
                <ol className="sell-steps">
                  {steps.map((step) => (
                    <li key={step.title}>
                      <strong>{step.title}.</strong> {step.copy}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="sell-panel">
                <h2>What you&apos;ll need when you apply</h2>
                <ul className="sell-needs">
                  {needs.map(({ icon: Icon, lead, copy }) => (
                    <li key={lead}>
                      <Icon aria-hidden="true" />
                      <span>
                        <strong>{lead}</strong> — {copy}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <SellerForm />
          </div>
        </section>

        <section className="section" aria-labelledby="sell-faq-title">
          <div className="page-width sell-faq">
            <h2 id="sell-faq-title">Before you ask</h2>
            <div className="sell-faq-list">
              {faqs.map((item) => (
                <div key={item.q} className="sell-faq-q">
                  <h3>{item.q}</h3>
                  <p>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
