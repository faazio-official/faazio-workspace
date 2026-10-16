import {
  HiArrowRight as ArrowRight,
  HiArrowUpRight as ArrowUpRight,
  HiCircleStack as Coins,
  HiHeart as HeartHandshake,
  HiMapPin as MapPin,
  HiBeaker as Pill,
  HiShoppingBag as ShoppingBag,
  HiDevicePhoneMobile as Smartphone,
  HiBuildingStorefront as Store,
} from "react-icons/hi2";
import { PiForkKnifeFill as UtensilsCrossed } from "react-icons/pi";
import { motion } from "motion/react";
import { DownloadButton } from "@/components/download-button";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import martImage from "@/assets/mart.jpg";
import foodImage from "@/assets/food.jpg";
import pharmaImage from "@/assets/pharma.jpg";

type Props = { onAction: (action: "download" | "donor" | "partner") => void };

const faqs = [
  [
    "Where is Faazio launching?",
    "Our journey starts in Karaikal. Expansion to more areas is planned. Check your location in the app for the services available to you.",
  ],
  [
    "How does ordering work?",
    "Verify your phone number with an OTP, set your location, and explore nearby stores, restaurants, and medicals in the Faazio app. Order details and tracking are available in the app.",
  ],
  [
    "Can I upload a prescription?",
    "Prescription upload is part of the planned Pharma experience. The app will show the requirements and availability for your location. Prescription medicines require a valid prescription.",
  ],
  [
    "Can I book a table as well as order food?",
    "Faazio Food brings food ordering and dining booking together. Participating restaurants and available booking times will be shown in the app.",
  ],
  [
    "How can I become a blood donor?",
    "The Faazio blood-donation community is being developed to connect people with a shared purpose. Registration details will be shared when the programme opens. For urgent medical needs, contact your hospital or local blood bank directly.",
  ],
];

export function FaazioCommunity({ onAction }: Props) {
  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.5 }}
        className="section how-section"
        id="how-it-works"
        aria-labelledby="how-title"
      >
        <div className="page-width how-layout">
          <div className="how-intro">
            <p className="eyebrow">HOW FAAZIO WORKS</p>
            <h2 id="how-title">
              Your next errand.
              <br />
              <span className="text-primary">Minus the running around.</span>
            </h2>
            <p className="section-copy">
              Groceries for home. A meal you’re craving. Everyday pharmacy essentials. Start with
              what you need, all in Faazio.
            </p>
            <DownloadButton onClick={() => onAction("download")} />
            <p className="availability-note">
              <MapPin size={14} /> Starting in Karaikal · Store links coming soon
            </p>
            <a href="#faq" className="how-question">
              Questions before you get started? <ArrowRight size={15} />
            </a>
          </div>
          <ol className="journey-steps">
            <motion.li
              initial={{ opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
            >
              <span className="journey-number">01</span>
              <div className="journey-detail">
                <span className="journey-kicker">
                  <Smartphone size={15} /> YOUR FIRST STEP
                </span>
                <h3>Get Faazio on your phone</h3>
                <p>Open the app and sign in with your phone number and OTP.</p>
              </div>
            </motion.li>
            <motion.li
              initial={{ opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
            >
              <span className="journey-number">02</span>
              <div className="journey-detail">
                <span className="journey-kicker">
                  <MapPin size={15} /> KEEP IT LOCAL
                </span>
                <h3>See what’s near you</h3>
                <p>
                  Set your location to see available stores, restaurants, and medicals in your area.
                </p>
              </div>
            </motion.li>
            <motion.li
              initial={{ opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
            >
              <span className="journey-number">03</span>
              <div className="journey-detail">
                <span className="journey-kicker">
                  <ShoppingBag size={15} /> MAKE IT AN EVERYDAY THING
                </span>
                <h3>Choose. Order. Follow along.</h3>
                <p>Pick your essentials and view your order details and tracking in the app.</p>
                <div className="journey-products">
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
              </div>
            </motion.li>
          </ol>
        </div>
      </motion.section>
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.5 }}
        className="rewards-band"
      >
        <div className="page-width rewards-inner">
          <div className="reward-icon">
            <Coins size={30} strokeWidth={1.5} />
          </div>
          <div>
            <p className="eyebrow">LITTLE ORDERS. LITTLE WINS.</p>
            <h3>Everyday deserves a little extra.</h3>
            <p>FaazioCoins. Daily streaks. More to look forward to.</p>
          </div>
          <span className="reward-note">
            Your routine, rewarded <ArrowUpRight size={17} />
          </span>
        </div>
      </motion.section>
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.5 }}
        id="community"
        className="donor-band"
      >
        <div className="page-width donor-inner">
          <HeartHandshake className="donor-illustration" strokeWidth={1} />
          <div>
            <p className="eyebrow text-donor">A LITTLE HELP. A SECOND CHANCE.</p>
            <h2>Some deliveries mean more.</h2>
            <p>
              Be someone’s second chance. Join a community that believes
              <br className="hidden lg:block" /> in showing up for patients, families, and each
              other.
            </p>
            <Button variant="donor" size="lg" onClick={() => onAction("donor")}>
              Become a donor <ArrowUpRight />
            </Button>
          </div>
          <span className="donor-side">
            A community
            <br />
            with heart.
          </span>
        </div>
      </motion.section>
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.5 }}
        id="partners"
        className="section partner-section"
        aria-labelledby="partner-title"
      >
        <div className="page-width">
          <div className="partner-heading">
            <div>
              <p className="eyebrow">FOR KARAIKAL BUSINESSES</p>
              <h2 id="partner-title">
                Local favourites.
                <br />
                <span className="text-primary">A new way to be found.</span>
              </h2>
            </div>
            <p>
              Behind every everyday essential is a local business. Faazio brings stores,
              restaurants, and medicals into one place for your neighbourhood to explore.
            </p>
          </div>
          <div className="partner-types">
            {[
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
            ].map(({ name, detail, icon: Icon, theme }) => (
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
              <DownloadButton onClick={() => onAction("download")} />
              <span className="intent-status">Starting in Karaikal · Store links coming soon</span>
            </div>
            <div className="partner-business">
              <span className="intent-label">OWN A LOCAL BUSINESS?</span>
              <h3>Let’s talk about your place on Faazio.</h3>
              <p>
                We’re starting with Karaikal. Partner contact and onboarding details are coming
                soon.
              </p>
              <Button variant="outline" size="lg" onClick={() => onAction("partner")}>
                View partnership details <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      </motion.section>
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.5 }}
        id="download"
        className="download-band"
      >
        <div className="page-width download-inner">
          <div>
            <p className="eyebrow">YOUR DAILY SUPERAPP</p>
            <h2>
              A little more life.
              <br />A lot less app-hopping.
            </h2>
            <p>Make room for the things that matter. Get Faazio.</p>
          </div>
          <div className="download-actions">
            <DownloadButton onClick={() => onAction("download")} />
            <span>Mart · Food · Pharma · More</span>
          </div>
        </div>
      </motion.section>
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.5 }}
        id="faq"
        className="section"
      >
        <div className="page-width faq-grid">
          <div>
            <p className="eyebrow">GOOD QUESTIONS.</p>
            <h2>
              A little clarity
              <br />
              goes a long way.
            </h2>
            <p className="section-copy">
              The everyday things you might
              <br className="hidden sm:block" /> want to know.
            </p>
          </div>
          <Accordion type="single" collapsible>
            {faqs.map(([question, answer], i) => (
              <AccordionItem value={`faq-${i}`} key={question}>
                <AccordionTrigger className="py-6 text-[15px] font-semibold">
                  {question}
                </AccordionTrigger>
                <AccordionContent className="leading-7 text-muted-foreground">
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
