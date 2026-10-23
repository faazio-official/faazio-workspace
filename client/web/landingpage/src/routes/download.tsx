import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { HiArrowUpRight as ArrowUpRight, HiDevicePhoneMobile as Smartphone } from "react-icons/hi2";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
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
            <p className="eyebrow">YOUR DAILY SUPERAPP</p>
            <h1 id="download-title">A little more life. A lot less app-hopping.</h1>
            <p className="page-lead">
              Make room for the things that matter. Mart, Food, and Pharma in one place for your
              day.
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width content-block">
            <div className="dialog-symbol">
              <Smartphone />
            </div>
            <h2 style={{ marginTop: 20 }}>Your everyday, in the Faazio app</h2>
            <p>
              Faazio’s journey starts in Karaikal. Official App Store and Play Store links will be
              shared here once they are provided — there is no download link available on this page
              yet.
            </p>
            <p>
              <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold">
                Explore Faazio <ArrowUpRight size={15} />
              </a>
            </p>
          </div>
        </section>
        <section className="download-band">
          <div className="page-width download-inner">
            <div>
              <p className="eyebrow">STARTING IN KARAIKAL</p>
              <h2>Groceries. Food. Pharma. One place for your day.</h2>
              <p>Official app-store links are coming soon.</p>
            </div>
            <div className="download-actions">
              <Button asChild variant="download" size="lg" className="download-button">
                <a href="/">
                  <span>Mart · Food · Pharma · More</span>
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
