import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { seoHead } from "@/lib/seo";

const title = "About Faazio — Karaikal's daily superapp | Groceries, Food & Pharmacy";
const description =
  "Faazio is the daily superapp from Karaikal — groceries, local food, and pharmacy in one app. A local company built by FA CREATORS to make the everyday a little easier.";
const keywords =
  "about Faazio, Faazio Karaikal, Faazio app, daily superapp, groceries food pharmacy app, FA CREATORS";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => seoHead({ path: "/about", title, description, keywords }),
});

function About() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="about-title">
          <div className="page-width">
            <p className="eyebrow">About Faazio</p>
            <h1 id="about-title">Your neighbourhood, in one app.</h1>
            <p className="page-lead">
              Faazio brings groceries, local restaurant food and pharmacy essentials from nearby
              stores into a single everyday place.
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width content-block">
            <h2>Built for the everyday</h2>
            <p>
              Faazio started with a simple idea: the things you need most — fresh groceries, a meal
              you are craving, everyday pharmacy essentials — should not take a dozen trips and a
              handful of apps. So Faazio brings your neighbourhood together in one app.
            </p>
            <h2>Rooted in Karaikal</h2>
            <p>
              Faazio&apos;s journey starts in Karaikal, Puducherry. From the local stores you know
              to favourite restaurants and nearby medicals, Faazio is made for the way
              neighbourhoods shop today — starting exactly where it matters first.
            </p>
            <h2>Our promise</h2>
            <p>
              One app for your daily essentials. Local partners you recognise. A little less running
              around, and a little more time for the things that matter. Faazio is operated by FA
              CREATORS from Karaikal, Puducherry.
            </p>
            <div style={{ marginTop: 32 }}>
              <a href="/download" className="btn btn-primary">
                Get the Faazio app
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
