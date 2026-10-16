import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  HiArrowRight as ArrowRight,
  HiArrowUpRight as ArrowUpRight,
  HiCheck as Check,
  HiHeart as HeartHandshake,
  HiMapPin as MapPin,
  HiBars3 as Menu,
  HiBeaker as Pill,
  HiShieldCheck as ShieldCheck,
  HiShoppingBag as ShoppingBag,
  HiDevicePhoneMobile as Smartphone,
  HiBuildingStorefront as Store,
  HiXMark as X,
} from "react-icons/hi2";
import { PiForkKnifeFill as UtensilsCrossed } from "react-icons/pi";
import { motion, MotionConfig } from "motion/react";
import { DownloadButton } from "@/components/download-button";
import { FaazioLogo } from "@/components/faazio-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FaazioCommunity } from "@/components/faazio-community";
import { DEFAULT_OG_IMAGE, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, SITE_NAME, SITE_URL } from "@/lib/site";
import heroImage from "@/assets/faazio-daily.jpg";
import martImage from "@/assets/mart.jpg";
import foodImage from "@/assets/food.jpg";
import pharmaImage from "@/assets/pharma.jpg";

const canonicalUrl = `${SITE_URL}/`;
const title = "Faazio — Grocery, Food & Pharmacy App in Karaikal | Daily SuperApp";
const description =
  "Faazio is your daily superapp for groceries, local restaurant food, and pharmacy essentials from nearby medical stores. Starting in Karaikal — download the Faazio app.";
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: SITE_NAME,
      url: canonicalUrl,
      logo: `${SITE_URL}/android-chrome-512x512.png`,
      areaServed: { "@type": "City", name: "Karaikal" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: ["Faazio App", "Faazio SuperApp"],
      url: canonicalUrl,
      publisher: { "@id": `${SITE_URL}/#org` },
      inLanguage: "en-IN",
    },
    {
      "@type": "MobileApplication",
      name: SITE_NAME,
      operatingSystem: "Android, iOS",
      applicationCategory: "ShoppingApplication",
      description,
      publisher: { "@id": `${SITE_URL}/#org` },
    },
  ],
};
export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      {
        name: "keywords",
        content:
          "Faazio, Faazio app, Faazio Karaikal, grocery delivery Karaikal, food app Karaikal, pharmacy Karaikal, medicine app, daily superapp",
      },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl },
      { property: "og:locale", content: "en_IN" },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { property: "og:image:width", content: String(OG_IMAGE_WIDTH) },
      { property: "og:image:height", content: String(OG_IMAGE_HEIGHT) },
      {
        property: "og:image:alt",
        content: "Groceries, a freshly prepared meal, and pharmacy essentials from Faazio",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: DEFAULT_OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
  }),
});

const navLinks = [
  { label: "Explore Faazio", href: "#sectors" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Our community", href: "#community" },
  { label: "For partners", href: "#partners" },
];
const sectors = [
  {
    id: "mart",
    label: "FAAZIO MART",
    title: "Fresh finds. Everyday essentials.",
    copy: "Your grocery list, minus the grocery trip.",
    image: martImage,
    alt: "Fresh vegetables, bread, apples, and a lemon in a grocery tote",
    icon: ShoppingBag,
    theme: "bg-mart-soft text-primary",
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
    theme: "bg-food-soft text-food",
    action: "Explore Food",
    detail: "Local restaurants · Meals · Dining bookings",
    details:
      "Discover meals from local restaurants and plan your next sit-down meal with dining bookings. Participating restaurants and availability are shown in the app.",
  },
  {
    id: "pharma",
    label: "FAAZIO PHARMA",
    title: "A little care. Closer to home.",
    copy: "Everyday health, from nearby medicals.",
    image: pharmaImage,
    alt: "Unbranded pharmacy boxes, vitamins, a blister pack, and a bandage",
    icon: Pill,
    theme: "bg-pharma-soft text-pharma",
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const sector = sectors.find((item) => item.id === action);
  const copy =
    action === "download" || action === "donor" || action === "partner" ? dialogCopy[action] : null;
  return (
    <MotionConfig reducedMotion="user">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <nav aria-label="Main navigation" className="page-width site-nav">
          <a href="#" aria-label="Faazio home" className="wordmark">
            <FaazioLogo className="wordmark-logo" />
          </a>
          <div className="nav-links">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
          <div className="nav-actions">
            <span className="nav-location">
              <MapPin size={13} /> Starting in Karaikal
            </span>
            <DownloadButton compact onClick={() => setAction("download")} />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </nav>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="mobile-menu md:hidden"
          >
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ))}
            <span className="text-xs text-muted-foreground">
              Starting in Karaikal. Growing with you.
            </span>
          </nav>
        )}
      </header>
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
      <footer className="site-footer">
        <div className="page-width">
          <div className="footer-top">
            <div className="footer-brand">
              <a href="#" className="wordmark" aria-label="Faazio home">
                <FaazioLogo className="wordmark-logo" />
              </a>
              <p>
                Your daily superapp.
                <br />
                Made for your neighbourhood.
              </p>
            </div>
            <div className="footer-links">
              <div>
                <h3>Your everyday</h3>
                <a href="#mart">Faazio Mart</a>
                <a href="#food">Faazio Food</a>
                <a href="#pharma">Faazio Pharma</a>
              </div>
              <div>
                <h3>Better together</h3>
                <a href="#community">Blood donation</a>
                <a href="#partners">Partner with us</a>
                <a href="#how-it-works">How it works</a>
              </div>
              <div>
                <h3>A little help</h3>
                <a href="#faq">FAQs</a>
                <a href="#download">Get the app</a>
                <a href="#hero-title">Our beginning</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getUTCFullYear()} Faazio. Made for daily India.</span>
            <span>Starting in Karaikal · More neighbourhoods to come</span>
          </div>
        </div>
      </footer>
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
