import {
  HiArrowRight as ArrowRight,
  HiCircleStack as Coins,
  HiOutlineHeart as HeartHandshake,
  HiBeaker as Pill,
  HiBuildingStorefront as Store,
} from "react-icons/hi2";
import { PiForkKnifeFill as UtensilsCrossed } from "react-icons/pi";
import { motion } from "motion/react";
import { DownloadButton } from "@/components/download-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import martImage from "@/assets/mart.jpg";
import foodImage from "@/assets/food.jpg";
import pharmaImage from "@/assets/pharma.jpg";
import { faqs } from "@/lib/faqs";

type Props = { onAction: (action: "download" | "donor" | "partner") => void };

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

const steps = [
  {
    number: "01",
    title: "Get the app and sign in",
    copy: "Open Faazio and verify your phone number with a one-time code. No forms to fill in.",
  },
  {
    number: "02",
    title: "Set where you are",
    copy: "Your location decides which stores, restaurants and medicals are actually near you.",
  },
  {
    number: "03",
    title: "Order and follow along",
    copy: "Pick what you need, then watch the order and its tracking in the app.",
  },
];

export function FaazioCommunity({ onAction }: Props) {
  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.45 }}
        className="section how"
        id="how-it-works"
        aria-labelledby="how-title"
      >
        <div className="page-width how-layout">
          <div className="how-copy">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title" className="headline" style={{ marginTop: 12 }}>
              Your next errand, minus the running around.
            </h2>
            <p className="lead">
              Groceries for home. A meal you are craving. Everyday pharmacy essentials. Start with
              what you need.
            </p>
            <DownloadButton onClick={() => onAction("download")} />
            <p className="hero-note">
              <span className="open-dot" aria-hidden="true" />
              Starting in Karaikal · Store links coming soon
            </p>
            <a href="#faq" className="btn btn-ghost btn-sm how-link">
              Questions before you start?
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
          <ol className="steps">
            {steps.map((step, index) => (
              <motion.li
                key={step.number}
                className="step"
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <span className="step-number" aria-hidden="true">
                  {step.number}
                </span>
                <div className="step-body">
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                  {index === steps.length - 1 && (
                    <div className="step-thumbs">
                      {[
                        { image: martImage, name: "Groceries" },
                        { image: foodImage, name: "Meals" },
                        { image: pharmaImage, name: "Everyday care" },
                      ].map((item) => (
                        <figure key={item.name}>
                          <img
                            src={item.image}
                            alt={item.name}
                            width={1024}
                            height={1024}
                            loading="lazy"
                          />
                          <figcaption>{item.name}</figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </motion.section>

      {/* One line of fact, not a banner. */}
      <section className="rewards" aria-labelledby="rewards-title">
        <div className="page-width rewards-inner">
          <div className="rewards-copy">
            <Coins
              size={18}
              strokeWidth={1.5}
              aria-hidden="true"
              className="text-muted-foreground"
            />
            <h3 id="rewards-title">FaazioCoins on every order</h3>
            <p>Daily streaks, and a little back for the routine.</p>
          </div>
          <span className="meta">Earned in the app</span>
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.45 }}
        id="community"
        className="donor"
        aria-labelledby="donor-title"
      >
        <div className="page-width donor-inner">
          <div className="donor-copy">
            <p className="eyebrow">Blood donation</p>
            <h2 id="donor-title" className="headline">
              Some deliveries mean more.
            </h2>
            <p>
              We are building a community of people who show up for patients, families and each
              other. Registration opens when the programme is ready.
            </p>
            <button type="button" className="btn btn-donor" onClick={() => onAction("donor")}>
              Become a donor
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <HeartHandshake className="donor-mark" strokeWidth={1.25} aria-hidden="true" />
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.45 }}
        id="partners"
        className="section"
        aria-labelledby="partner-title"
      >
        <div className="page-width">
          <div className="section-head">
            <div className="section-head-copy">
              <p className="eyebrow">For Karaikal businesses</p>
              <h2 id="partner-title" className="headline" style={{ marginTop: 12 }}>
                Local favourites, a new way to be found.
              </h2>
            </div>
            <p>
              Behind every everyday essential is a local business. Faazio brings stores, restaurants
              and medicals into one place for your neighbourhood.
            </p>
          </div>

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
              <DownloadButton onClick={() => onAction("download")} />
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
              <button type="button" className="btn btn-outline" onClick={() => onAction("partner")}>
                View partnership details
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.45 }}
        id="download"
        className="download"
        aria-labelledby="download-title"
      >
        <div className="page-width download-inner">
          <div className="download-copy">
            <p className="eyebrow">Your daily superapp</p>
            <h2 id="download-title" className="headline">
              A little more life. A lot less app-hopping.
            </h2>
            <p>Make room for the things that matter. Get Faazio.</p>
          </div>
          <div className="download-actions">
            <DownloadButton onClick={() => onAction("download")} />
            <span className="meta">Mart · Food · Pharma</span>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.45 }}
        id="faq"
        className="section"
        aria-labelledby="faq-title"
      >
        <div className="page-width faq-grid">
          <div className="faq-copy">
            <p className="eyebrow">Good questions</p>
            <h2 id="faq-title" className="headline" style={{ marginTop: 12 }}>
              A little clarity goes a long way.
            </h2>
            <p className="lead">The everyday things you might want to know first.</p>
          </div>
          <Accordion type="single" collapsible>
            {faqs.map(([question, answer], i) => (
              <AccordionItem value={`faq-${i}`} key={question}>
                <AccordionTrigger className="py-5 text-left text-[15px] font-medium">
                  {question}
                </AccordionTrigger>
                <AccordionContent className="text-[15px] leading-7 text-muted-foreground">
                  {answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </motion.section>
    </>
  );
}
