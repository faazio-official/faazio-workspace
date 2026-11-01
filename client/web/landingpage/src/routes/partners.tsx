import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { HiArrowRight as ArrowRight } from "react-icons/hi2";
import { PiForkKnifeFill as UtensilsCrossed } from "react-icons/pi";
import { HiBeaker as Pill, HiBuildingStorefront as Store } from "react-icons/hi2";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { seoHead } from "@/lib/seo";

const title = "Partner with Faazio — local stores, restaurants & medicals in Karaikal";
const description =
  "Faazio brings nearby grocery stores, restaurants, and medicals into one app for Karaikal. Find out how local businesses can be part of the Faazio neighbourhood.";
const keywords =
  "Faazio partners, partner with Faazio, local stores Karaikal, restaurants Karaikal, medical stores Karaikal, Faazio onboarding";

export const Route = createFileRoute("/partners")({
  component: Partners,
  head: () => seoHead({ path: "/partners", title, description, keywords }),
});

const partnerTypes = [
  {
    name: "Grocery stores",
    detail: "For the weekly list and the everyday essentials.",
    icon: Store,
  },
  {
    name: "Restaurants",
    detail: "For familiar favourites and the next meal.",
    icon: UtensilsCrossed,
  },
  {
    name: "Medical stores",
    detail: "For pharmacy essentials and everyday care.",
    icon: Pill,
  },
];

function Partners() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="partner-title">
          <div className="page-width">
            <p className="eyebrow">For Karaikal businesses</p>
            <h1 id="partner-title">Local favourites. A new way to be found.</h1>
            <p className="page-lead">
              Behind every everyday essential is a local business. Faazio brings stores, restaurants
              and medicals into one place for your neighbourhood to explore.
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width">
            <div className="partner-types">
              {partnerTypes.map(({ name, detail, icon: Icon }) => (
                <div className="partner-type" key={name}>
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="text-muted-foreground"
                  />
                  <h3 style={{ marginTop: 12 }}>{name}</h3>
                  <p>{detail}</p>
                </div>
              ))}
            </div>
            <div className="partner-intents">
              <div className="intent">
                <p className="eyebrow">Here to shop</p>
                <h3>Your neighbourhood is the place to start.</h3>
                <p>Explore Mart, Food and Pharma in the Faazio app.</p>
                <a href="/download" className="btn btn-primary">
                  Get the Faazio app
                </a>
                <span className="intent-status">
                  <span className="open-dot" aria-hidden="true" />
                  Starting in Karaikal · Store links coming soon
                </span>
              </div>
              <div className="intent">
                <p className="eyebrow">Own a local business</p>
                <h3>Let&apos;s talk about your place on Faazio.</h3>
                <p>
                  We are starting with Karaikal. Partner contact and onboarding details are coming
                  soon.
                </p>
                <a href="/about" className="btn btn-outline">
                  Learn more about Faazio
                  <ArrowRight aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
