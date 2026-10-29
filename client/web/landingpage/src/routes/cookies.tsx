import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { FaazioLogo } from "@/components/faazio-logo";
import {
  LEGAL_EFFECTIVE_DATE,
  PolicyList,
  type PolicySection,
  legalLinkClass,
} from "@/components/legal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { seoHead } from "@/lib/seo";
import { BUSINESS_EMAIL } from "@/lib/site";

const title = "Cookie Policy — Faazio | How faazio.com uses cookies";
const description =
  "How the Faazio website uses cookies and similar technologies, what each type does, and how you can control or disable them in your browser.";
const keywords =
  "Faazio cookie policy, Faazio cookies, faazio.com cookies, Faazio website cookies, manage cookies Faazio";

export const Route = createFileRoute("/cookies")({
  component: CookiePolicy,
  head: () => seoHead({ path: "/cookies", title, description, keywords }),
});

const cookieSections: PolicySection[] = [
  {
    id: "what-are-cookies",
    title: "1. What cookies are",
    body: (
      <p>
        Cookies are small text files that a website stores on your device. They help a site remember
        your actions and preferences over time. We also use similar technologies such as local
        storage and pixels, and this policy refers to them collectively as “cookies”.
      </p>
    ),
  },
  {
    id: "cookies-we-use",
    title: "2. Cookies we use",
    body: (
      <>
        <p>
          The faazio.com website is built to work without advertising or cross-site tracking. We use
          only the minimum needed to run and secure the site:
        </p>
        <PolicyList
          items={[
            <>
              <strong>Essential / functional.</strong> Needed for the site and any signed-in areas
              to work, and to remember basic preferences. These cannot be switched off without
              breaking parts of the site.
            </>,
            <>
              <strong>Security and reliability.</strong> Used to protect against abuse and to keep
              the site stable. Our servers also keep basic request logs (such as IP address, browser
              type, and the page requested).
            </>,
            <>
              <strong>Preferences.</strong> Remember choices such as your selected area, so you do
              not have to set them again.
            </>,
          ]}
        />
        <p>
          The Faazio mobile apps do not use browser cookies. They store session tokens securely on
          your device (iOS Keychain / Android Keystore).
        </p>
      </>
    ),
  },
  {
    id: "analytics",
    title: "3. Analytics",
    body: (
      <p>
        faazio.com does not use third-party advertising cookies and does not sell your data. We may
        use privacy-respecting, aggregated measurement to understand which pages are useful. Where
        we do, the data is not used to identify you personally.
      </p>
    ),
  },
  {
    id: "third-parties",
    title: "4. Third parties",
    body: (
      <p>
        Some parts of the site load resources from third parties, such as web fonts. When your
        browser requests these resources, the provider (for example Google Fonts) receives your IP
        address as part of that request. These providers have their own privacy and cookie policies.
      </p>
    ),
  },
  {
    id: "managing-cookies",
    title: "5. Managing cookies",
    body: (
      <>
        <p>
          You can control or delete cookies through your browser settings. Most browsers let you
          block cookies, clear them, or delete them when you close the browser. Blocking essential
          cookies may affect how parts of the site work.
        </p>
        <PolicyList
          items={[
            "Chrome: Settings → Privacy and security → Cookies and other site data.",
            "Safari: Settings → Privacy → Manage Website Data.",
            "Firefox: Settings → Privacy & Security → Cookies and Site Data.",
            "Edge: Settings → Cookies and site permissions.",
          ]}
        />
      </>
    ),
  },
  {
    id: "changes-contact",
    title: "6. Changes and contact",
    body: (
      <>
        <p>
          We may update this policy from time to time; the effective date at the top of this page
          shows when it last changed.
        </p>
        <p>
          Questions about cookies? Email{" "}
          <a href={`mailto:${BUSINESS_EMAIL}`} className={legalLinkClass}>
            {BUSINESS_EMAIL}
          </a>{" "}
          or see our{" "}
          <a href="/privacy" className={legalLinkClass}>
            Privacy Policy
          </a>{" "}
          for how we handle personal data.
        </p>
      </>
    ),
  },
];

function CookiePolicy() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="cookies-title">
          <div className="page-width">
            <div className="mb-4 flex items-center gap-3 text-primary">
              <FaazioLogo className="h-7 w-auto" aria-hidden="true" />
            </div>
            <p className="eyebrow">COOKIE POLICY</p>
            <h1 id="cookies-title">A light touch on cookies.</h1>
            <p className="page-lead">
              How the Faazio website uses cookies and similar technologies — and how you can control
              them.
            </p>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Effective {LEGAL_EFFECTIVE_DATE} · Applies to faazio.com
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width">
            <div className="content-block">
              <h2 className="sr-only">Cookie policy details</h2>
              <Accordion type="multiple" defaultValue={cookieSections.map((section) => section.id)}>
                {cookieSections.map((section) => (
                  <AccordionItem
                    key={section.id}
                    id={section.id}
                    value={section.id}
                    className="scroll-mt-24"
                  >
                    <AccordionTrigger className="py-6 font-display text-[19px] font-bold">
                      {section.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6">{section.body}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MotionConfig>
  );
}
