import { createFileRoute } from "@tanstack/react-router";
import {
  HiArrowRight as ArrowRight,
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
                delivery partner and show your shop accurately to nearby shoppers. It only takes a
                minute, and this is not the full application — that happens in the app once we call.
              </p>
              <p className="meta">
                Already applied in the app?{" "}
                <a href="/help-centre" className="sell-inline-link">
                  See the seller help centre <ArrowRight aria-hidden="true" />
                </a>
              </p>
            </div>
            <SellerForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
