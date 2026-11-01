import { createFileRoute } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import {
  HiArrowRight as ArrowRight,
  HiCheck as Check,
  HiHeart as HeartHandshake,
  HiBeaker as Pill,
  HiShoppingBag as ShoppingBag,
  HiDevicePhoneMobile as Smartphone,
  HiBuildingStorefront as Store,
} from "react-icons/hi2";
import { PiForkKnifeFill as UtensilsCrossed } from "react-icons/pi";
import { motion, MotionConfig } from "motion/react";
import { DownloadButton } from "@/components/download-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FaazioCommunity } from "@/components/faazio-community";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { seoHead } from "@/lib/seo";
import heroImage from "@/assets/faazio-daily.jpg";
import martImage from "@/assets/mart.jpg";
import foodImage from "@/assets/food.jpg";
import pharmaImage from "@/assets/pharma.jpg";

const title = "Faazio — Grocery, Food & Pharmacy App in Karaikal | Daily SuperApp";
const description =
  "Faazio is your daily superapp for groceries, local restaurant food, and pharmacy essentials from nearby medical stores. Starting in Karaikal — download the Faazio app.";
const keywords =
  "Faazio, Faazio app, Faazio Karaikal, grocery delivery Karaikal, food app Karaikal, pharmacy Karaikal, medicine app, daily superapp";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => seoHead({ path: "/", title, description, keywords }),
});

const sectors = [
  {
    id: "mart",
    label: "Faazio Mart",
    title: "The weekly list, without the trip",
    copy: "Fresh produce, pantry staples and the household things you ran out of, from the shops you already know.",
    image: martImage,
    alt: "Fresh vegetables, bread, apples and a lemon in a grocery tote",
    icon: ShoppingBag,
    color: "var(--color-mart)",
    action: "Discover Mart",
    detail: "Produce · Pantry · Household",
    details:
      "From the weekly grocery list to the little things you ran out of. Explore fresh produce, pantry staples, and household essentials from neighbourhood stores in the Faazio app.",
  },
  {
    id: "food",
    label: "Faazio Food",
    title: "The meal you were thinking about",
    copy: "Local restaurants, ordered for delivery to your door or picked up on the way home.",
    image: foodImage,
    alt: "Biryani, curry and raita from a local restaurant",
    icon: UtensilsCrossed,
    color: "var(--color-food)",
    action: "Explore Food",
    detail: "Restaurants · Delivery · Pickup",
    details:
      "Discover meals from local restaurants and choose delivery or self-pickup at checkout. Order details and tracking are available in the app.",
  },
  {
    id: "pharma",
    label: "Faazio Pharma",
    title: "Everyday care, close to home",
    copy: "Medicines, personal care and baby essentials from nearby medical stores.",
    image: pharmaImage,
    alt: "Unbranded pharmacy boxes, vitamins, a blister pack and a bandage",
    icon: Pill,
    color: "var(--color-pharma)",
    action: "Meet Pharma",
    detail: "Medicals · Prescriptions · Care",
    details:
      "Explore medicines, OTC products, baby care, Ayurveda, and personal care from nearby medical stores. Prescription upload is part of the planned experience. Prescription medicines require a valid prescription; availability is shown in the app.",
  },
];

type Action = "download" | "donor" | "partner" | "mart" | "food" | "pharma";

/** CSS custom properties are not in React's CSSProperties type; this keeps the
 *  sector dot tint typed instead of casting at the call site. */
function sectorTint(color: string): CSSProperties {
  return { "--sector-color": color } as CSSProperties;
}

const dialogCopy = {
  download: {
    title: "The app is not on the stores yet",
    description:
      "Faazio starts in Karaikal. The App Store and Play Store links will be published here as soon as they are live — there is no download on this page yet.",
    note: "Mart, Food and Pharma, in one app for your day.",
  },
  donor: {
    title: "The donor programme is still being built",
    description:
      "We are putting together a community of people who want to help patients, families, hospitals and blood banks. Registration details will be shared when it opens.",
    note: "For urgent medical needs, contact your hospital or local blood bank directly. This page is not an emergency service.",
  },
  partner: {
    title: "Partner onboarding opens soon",
    description:
      "Faazio works with local grocery stores, restaurants and medical businesses, starting in Karaikal. Contact and onboarding details will be published here when they are ready.",
    note: "No application is collected or submitted on this page.",
  },
};

function Index() {
  const [action, setAction] = useState<Action | null>(null);
  const sector = sectors.find((item) => item.id === action);
  const copy =
    action === "download" || action === "donor" || action === "partner" ? dialogCopy[action] : null;

  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        {/* Hero: a scene. The photograph carries the colour; the type sits in
            the calm left side it was composed to leave open. */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-media">
            <img
              src={heroImage}
              width={1920}
              height={1024}
              fetchPriority="high"
              alt="Groceries, a freshly prepared biryani and pharmacy essentials together"
            />
          </div>
          <motion.div
            className="page-width hero-inner"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="hero-copy">
              <p className="eyebrow">Karaikal · Mart, Food and Pharma</p>
              <h1 id="hero-title" className="display hero-title">
                Your neighbourhood,
                <br />
                <em>in one app.</em>
              </h1>
              <p className="hero-lead">
                Groceries from the shop down the road. Dinner from the place you like. Medicine from
                the medical you trust. One app, one delivery.
              </p>
              <div className="hero-actions">
                <DownloadButton onClick={() => setAction("download")} />
                <a href="#sectors" className="btn btn-outline">
                  See what&apos;s inside
                  <ArrowRight aria-hidden="true" />
                </a>
              </div>
              <p className="hero-note">
                <span className="open-dot" aria-hidden="true" />
                Starting in Karaikal. Growing with you.
              </p>
            </div>
          </motion.div>
        </section>

        <div className="strip">
          <div className="page-width strip-inner">
            <span className="strip-lead">
              <Store size={18} strokeWidth={1.5} aria-hidden="true" />
              Local shops, not a warehouse
            </span>
            <div className="strip-items">
              <span className="strip-item">
                <span className="open-dot" aria-hidden="true" />
                Neighbourhood stores
              </span>
              <span className="strip-item">
                <span className="open-dot" aria-hidden="true" />
                Local restaurants
              </span>
              <span className="strip-item">
                <span className="open-dot" aria-hidden="true" />
                Nearby medicals
              </span>
            </div>
          </div>
        </div>

        <section id="sectors" className="section">
          <div className="page-width">
            <div className="section-head">
              <div className="section-head-copy">
                <p className="eyebrow">Three parts of your day</p>
                <h2 className="headline" style={{ marginTop: 12 }}>
                  One app. All your everyday.
                </h2>
              </div>
              <p>
                From your first cup to your last errand. There is a little Faazio for all of it.
              </p>
            </div>
            <div className="sectors">
              {sectors.map((item, index) => (
                <motion.article
                  id={item.id}
                  key={item.id}
                  className="sector"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: index * 0.06 }}
                >
                  <div className="sector-media">
                    <img
                      src={item.image}
                      alt={item.alt}
                      loading="lazy"
                      width={1024}
                      height={1024}
                    />
                  </div>
                  <div className="sector-body">
                    <p className="sector-label" style={sectorTint(item.color)}>
                      <span className="open-dot" aria-hidden="true" />
                      {item.label}
                    </p>
                    <h3>{item.title}</h3>
                    <p className="sector-copy">{item.copy}</p>
                    <div className="sector-foot">
                      <span className="sector-detail">{item.detail}</span>
                      <button
                        type="button"
                        className="sector-action"
                        onClick={() => setAction(item.id as Action)}
                      >
                        {item.action}
                        <ArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <FaazioCommunity onAction={setAction} />
      </main>
      <SiteFooter />

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
      >
        <DialogContent className="dialog-panel">
          <div className="dialog-mark">
            {action === "donor" ? (
              <HeartHandshake aria-hidden="true" />
            ) : action === "partner" ? (
              <Store aria-hidden="true" />
            ) : (
              <Smartphone aria-hidden="true" />
            )}
          </div>
          <DialogHeader>
            <DialogTitle className="text-left text-xl leading-8">
              {sector ? sector.title : copy?.title}
            </DialogTitle>
            <DialogDescription className="pt-3 text-left leading-7">
              {sector ? sector.details : copy?.description}
            </DialogDescription>
          </DialogHeader>
          {copy && <p className="dialog-note">{copy.note}</p>}
          {sector && (
            <div style={{ marginTop: 20 }}>
              <DownloadButton onClick={() => setAction("download")} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MotionConfig>
  );
}
