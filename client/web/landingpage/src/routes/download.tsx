import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { HiArrowUpRight as ArrowUpRight, HiDevicePhoneMobile as Smartphone } from "react-icons/hi2";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_URL } from "@/lib/site";
import { seoHead, type JsonLdNode } from "@/lib/seo";

const title = "Download the Faazio app — Groceries, Food & Pharmacy in one app";
const description =
  "Get the Faazio app for groceries, local food, and pharmacy essentials in Karaikal. Official App Store and Play Store links will be shared here once available.";
const keywords =
  "download Faazio, Faazio app, Faazio Android, Faazio iOS, Faazio app store, Faazio play store, daily superapp";

const mobileAppNode: JsonLdNode = {
  "@type": "SoftwareApplication",
  name: "Faazio",
  applicationCategory: "ShoppingApplication",
  operatingSystem: "Android, iOS",
  offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  publisher: { "@id": `${SITE_URL}/#org` },
};

export const Route = createFileRoute("/download")({
  component: Download,
  head: () =>
    seoHead({ path: "/download", title, description, keywords, extraNodes: [mobileAppNode] }),
});

function Download() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="download-title">
          <div className="page-width">
            <p className="eyebrow">Your daily superapp</p>
            <h1 id="download-title">A little more life. A lot less app-hopping.</h1>
            <p className="page-lead">
              Make room for the things that matter. Mart, Food and Pharma in one place for your day.
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width content-block">
            <div className="dialog-mark">
              <Smartphone aria-hidden="true" />
            </div>
            <h2 style={{ marginTop: 0 }}>The app is not on the stores yet</h2>
            <p>
              Faazio starts in Karaikal. The App Store and Play Store links will be published here
              as soon as they are live — there is no download on this page yet.
            </p>
            <p>
              <a href="/" className="btn btn-ghost btn-sm" style={{ paddingInline: 0 }}>
                Explore Faazio
                <ArrowUpRight aria-hidden="true" />
              </a>
            </p>
          </div>
        </section>
        <section className="download">
          <div className="page-width download-inner">
            <div className="download-copy">
              <p className="eyebrow">Starting in Karaikal</p>
              <h2 className="headline">Groceries. Food. Pharma. One place for your day.</h2>
              <p>Official app-store links are coming soon.</p>
            </div>
            <div className="download-actions">
              <a href="/" className="btn btn-primary">
                Mart · Food · Pharma
                <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
