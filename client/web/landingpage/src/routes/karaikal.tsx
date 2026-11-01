import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import {
  HiMapPin as MapPin,
  HiBeaker as Pill,
  HiShoppingBag as ShoppingBag,
} from "react-icons/hi2";
import { PiForkKnifeFill as UtensilsCrossed } from "react-icons/pi";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  BUSINESS_CITY,
  BUSINESS_COUNTRY,
  BUSINESS_POSTAL_CODE,
  BUSINESS_REGION,
  BUSINESS_STREET_ADDRESS,
  SITE_URL,
} from "@/lib/site";
import { seoHead, type JsonLdNode } from "@/lib/seo";

const title = "Faazio in Karaikal — Groceries, Food & Pharmacy Delivery | Puducherry";
const description =
  "Faazio is the daily superapp starting in Karaikal, Puducherry. Groceries from local stores, food from local restaurants, and pharmacy essentials nearby.";
const keywords =
  "Faazio Karaikal, grocery delivery Karaikal, food delivery Karaikal, pharmacy Karaikal, daily superapp Karaikal, Puducherry app";

const placeNode: JsonLdNode = {
  "@type": "Place",
  "@id": `${SITE_URL}/karaikal#karaikal`,
  name: BUSINESS_CITY,
  address: {
    "@type": "PostalAddress",
    addressLocality: BUSINESS_CITY,
    addressRegion: BUSINESS_REGION,
    postalCode: BUSINESS_POSTAL_CODE,
    addressCountry: BUSINESS_COUNTRY,
  },
};

export const Route = createFileRoute("/karaikal")({
  component: Karaikal,
  head: () => seoHead({ path: "/karaikal", title, description, keywords, extraNodes: [placeNode] }),
});

function Karaikal() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="karaikal-title">
          <div className="page-width">
            <p className="eyebrow">Where Faazio starts</p>
            <h1 id="karaikal-title">Made for Karaikal. Starting right here.</h1>
            <p className="page-lead">
              Faazio&apos;s journey starts in Karaikal, Puducherry, bringing the local stores,
              restaurants and medicals you already know into one daily app.
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width content-block">
            <h2>Your neighbourhood, all in one app</h2>
            <p>
              From your weekly grocery list to the little things you ran out of, Faazio brings Mart,
              Food and Pharma together for Karaikal. Explore nearby stores, order what you need, and
              follow along — all from one place.
            </p>
            <ul>
              {[
                { icon: ShoppingBag, label: "Groceries from local stores" },
                { icon: UtensilsCrossed, label: "Meals from local restaurants" },
                { icon: Pill, label: "Essentials from nearby medicals" },
              ].map(({ icon: Icon, label }) => (
                <li key={label}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <h2>Find us</h2>
            <p>
              <MapPin size={14} className="inline text-brand-ink" aria-hidden="true" />{" "}
              {BUSINESS_STREET_ADDRESS}, {BUSINESS_CITY} — {BUSINESS_POSTAL_CODE}, {BUSINESS_REGION}
              , {BUSINESS_COUNTRY}.
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
