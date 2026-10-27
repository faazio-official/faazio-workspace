import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  HiArrowRight as ArrowRight,
  HiArrowUpRight as ArrowUpRight,
  HiCheck as Check,
  HiHeart as HeartHandshake,
  HiMapPin as MapPin,
  HiBeaker as Pill,
  HiShieldCheck as ShieldCheck,
  HiShoppingBag as ShoppingBag,
  HiDevicePhoneMobile as Smartphone,
  HiBuildingStorefront as Store,
} from "react-icons/hi2";
import { PiForkKnifeFill as UtensilsCrossed } from "react-icons/pi";
import { motion, MotionConfig } from "motion/react";
import { DownloadButton } from "@/components/download-button";
import { Button } from "@/components/ui/button";
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
    label: "FAAZIO MART",
    title: "Fresh finds. Everyday essentials.",
    copy: "Your grocery list, minus the grocery trip.",
    image: martImage,
    alt: "Fresh vegetables, bread, apples, and a lemon in a grocery tote",
    icon: ShoppingBag,
    theme: "bg-brand-soft text-brand",
    action: "Discover Mart",
    detail: "Fresh produce · Pantry staples · Daily essentials",
    details:
      "From the weekly grocery list to the little things you ran out of. Explore fresh produce, pantry staples, and household essentials from neighbourhood stores in the Faazio app.",
  },
  {
    id: "food",
    label: "FAAZIO FOOD",
    title: "Good food. Great moods.",
    copy: "Local favourites for every kind of craving.",
    image: foodImage,
    alt: "Biryani, curry, and raita from a local restaurant",
    icon: UtensilsCrossed,
    theme: "bg-brand-soft text-brand",
    action: "Explore Food",
    detail: "Local restaurants · Meals · Delivery & pickup",
    details:
      "Discover meals from local restaurants and choose delivery or self-pickup at checkout. Order details and tracking are available in the app.",
  },
  {
    id: "pharma",
    label: "FAAZIO PHARMA",
    title: "A little care. Closer to home.",
    copy: "Everyday health, from nearby medicals.",
    image: pharmaImage,
    alt: "Unbranded pharmacy boxes, vitamins, a blister pack, and a bandage",
    icon: Pill,
    theme: "bg-brand-soft text-brand",
    action: "Meet Pharma",
    detail: "Nearby medicals · Prescriptions · Personal care",
    details:
      "Explore medicines, OTC products, baby care, Ayurveda, and personal care from nearby medical stores. Prescription upload is part of the planned experience. Prescription medicines require a valid prescription; availability is shown in the app.",
  },
];
type Action = "download" | "donor" | "partner" | "mart" | "food" | "pharma";
const dialogCopy = {
  download: {
    title: "Your everyday, in the Faazio app.",
    description:
      "Faazio’s journey starts in Karaikal. Official app-store links will be shared here once they are provided. There is no download link available on this page yet.",
    note: "Mart. Food. Pharma. One place for your day.",
  },
  donor: {
    title: "Be someone’s second chance.",
    description:
      "We’re building a community of people who want to help patients, families, hospitals, and blood banks. Donor registration details will be shared when the programme opens.",
    note: "For urgent medical needs, contact your hospital or local blood bank directly. This page is not an emergency service.",
  },
  partner: {
    title: "Let’s build a more connected neighbourhood.",
    description:
      "Faazio welcomes interest from local grocery stores, restaurants, and medical businesses, starting in Karaikal. Official partner contact and onboarding details will be published here when available.",
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
        <motion.section
          className="hero"
          aria-labelledby="hero-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55 }}
        >
          <img
            src={heroImage}
            width={1920}
            height={1024}
            fetchPriority="high"
            alt="Groceries, a freshly prepared biryani, and pharmacy essentials together"
            className="hero-image"
          />
          <motion.div
            className="page-width hero-content"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12 }}
          >
            <p className="hero-eyebrow">
              <span /> YOUR NEIGHBOURHOOD. NOW IN ONE APP.
            </p>
            <h1 id="hero-title">
              <span className="hero-brand">Meet Faazio.</span>Your daily essentials.
              <br />
              One app.
            </h1>
            <p className="hero-description">
              Fresh groceries. Favourite meals. Everyday care.
              <br />
              From the local places you know, with a little less effort.
            </p>
            <div className="hero-ctas">
              <DownloadButton onClick={() => setAction("download")} />
              <Button asChild variant="ghost" size="lg">
                <a href="#sectors">
                  Explore your everyday <ArrowRight />
                </a>
              </Button>
            </div>
            <p className="hero-trust">
              <MapPin size={14} /> Starting in Karaikal. Growing with you.
            </p>
          </motion.div>
          <div className="hero-category-tags" aria-hidden="true">
            <span>
              <ShoppingBag /> Mart
            </span>
            <span>
              <UtensilsCrossed /> Food
            </span>
            <span>
              <Pill /> Pharma
            </span>
          </div>
          <p className="hero-caption">A whole day’s essentials. A single destination.</p>
        </motion.section>
        <div className="local-strip">
          <div className="page-width local-strip-inner">
            <span className="local-strip-title">
              <Store size={21} strokeWidth={1.5} /> Big on convenience. Rooted in local.
            </span>
            <span className="local-strip-item">
              <ShoppingBag size={17} /> Neighbourhood stores
            </span>
            <span className="local-strip-item">
              <UtensilsCrossed size={17} /> Favourite restaurants
            </span>
            <span className="local-strip-item">
              <ShieldCheck size={17} /> Nearby medicals
            </span>
          </div>
        </div>
        <section id="sectors" className="section">
          <div className="page-width">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THREE WAYS TO MAKE YOUR DAY.</p>
                <h2>One app. All your everyday.</h2>
              </div>
              <p>
                From your first cup to your last errand.
                <br />
                There’s a little Faazio for everything.
              </p>
            </div>
            <div className="sectors-grid">
              {sectors.map((item) => (
                <motion.article
                  id={item.id}
                  key={item.id}
                  className={`sector-card ${item.theme}`}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.5, delay: sectors.indexOf(item) * 0.08 }}
                  whileHover={{ y: -6 }}
                >
                  <div className="sector-label">
                    <item.icon size={16} />
                    {item.label}
                  </div>
                  <h3 className="text-foreground">{item.title}</h3>
                  <p>{item.copy}</p>
                  <img
                    className="sector-image"
                    src={item.image}
                    alt={item.alt}
                    loading="lazy"
                    width={1024}
                    height={1024}
                  />
                  <Button
                    variant="ghost"
                    className="sector-link"
                    onClick={() => setAction(item.id as Action)}
                  >
                    {item.action}
                    <ArrowUpRight />
                  </Button>
                </motion.article>
              ))}
            </div>
            <div className="service-details">
              {sectors.map((item) => (
                <div key={item.id}>
                  <Check size={14} />
                  <span>{item.detail}</span>
                </div>
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
        <DialogContent className="max-w-[calc(100%-32px)] sm:max-w-lg rounded-lg p-7">
          <div className="dialog-symbol">
            {action === "donor" ? (
              <HeartHandshake />
            ) : action === "partner" ? (
              <Store />
            ) : (
              <Smartphone />
            )}
          </div>
          <DialogHeader>
            <DialogTitle className="text-left text-xl leading-8">
              {sector ? sector.title : copy?.title}
            </DialogTitle>
            <DialogDescription className="text-left leading-7 pt-3">
              {sector ? sector.details : copy?.description}
            </DialogDescription>
          </DialogHeader>
          {copy && (
            <p className="text-xs leading-6 text-muted-foreground border-t border-border pt-4">
              {copy.note}
            </p>
          )}
          {sector && <DownloadButton onClick={() => setAction("download")} />}
        </DialogContent>
      </Dialog>
    </MotionConfig>
  );
}
