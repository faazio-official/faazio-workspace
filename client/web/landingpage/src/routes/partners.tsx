import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { PiForkKnifeFill as UtensilsCrossed } from "react-icons/pi";
import { HiBeaker as Pill, HiBuildingStorefront as Store } from "react-icons/hi2";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
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
    name: "Grocery & local stores",
    detail: "For the weekly list and the everyday essentials.",
    icon: Store,
    theme: "bg-mart-soft text-primary",
  },
  {
    name: "Restaurants",
    detail: "For familiar favourites and the next meal.",
    icon: UtensilsCrossed,
    theme: "bg-food-soft text-food",
  },
  {
    name: "Medical stores",
    detail: "For pharmacy essentials and everyday care.",
    icon: Pill,
    theme: "bg-pharma-soft text-pharma",
  },
];

function Partners() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="partner-title">
          <div className="page-width">
            <p className="eyebrow">FOR KARAIKAL BUSINESSES</p>
            <h1 id="partner-title">Local favourites. A new way to be found.</h1>
            <p className="page-lead">
              Behind every everyday essential is a local business. Faazio brings stores,
              restaurants, and medicals into one place for your neighbourhood to explore.
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width">
            <div className="partner-types">
              {partnerTypes.map(({ name, detail, icon: Icon, theme }) => (
                <div className="partner-type" key={name}>
                  <span className={`partner-icon ${theme}`}>
                    <Icon size={24} strokeWidth={1.5} />
                  </span>
                  <h3>{name}</h3>
                  <p>{detail}</p>
                </div>
              ))}
            </div>
            <div className="partner-intents">
              <div className="partner-shopper">
                <span className="intent-label">HERE TO SHOP?</span>
                <h3>Your neighbourhood is the place to start.</h3>
                <p>Explore Mart, Food, and Pharma in the Faazio app.</p>
                <Button asChild variant="download" size="lg" className="download-button">
                  <a href="/download">Get the Faazio app</a>
                </Button>
                <span className="intent-status">
                  Starting in Karaikal · Store links coming soon
                </span>
              </div>
              <div className="partner-business">
                <span className="intent-label">OWN A LOCAL BUSINESS?</span>
                <h3>Let’s talk about your place on Faazio.</h3>
                <p>
                  We’re starting with Karaikal. Partner contact and onboarding details are coming
                  soon.
                </p>
                <Button asChild variant="outline" size="lg">
                  <a href="/about">Learn more about Faazio</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
