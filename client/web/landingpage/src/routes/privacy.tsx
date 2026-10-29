import { createFileRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { PolicyList, type PolicySection } from "@/components/legal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { seoHead } from "@/lib/seo";
import {
  BUSINESS_CITY,
  BUSINESS_EMAIL,
  BUSINESS_LEGAL_NAME,
  BUSINESS_PHONE,
  BUSINESS_POSTAL_CODE,
  BUSINESS_REGION,
  BUSINESS_STREET_ADDRESS,
} from "@/lib/site";

const title = "Privacy Policy — Faazio | How we handle your data";
const description =
  "Read the Faazio privacy policy — what personal data we collect across Mart, Food, Pharma, and community features, how we use and share it, how to delete your account, and the rights you have.";
const keywords =
  "Faazio privacy policy, Faazio data protection, Faazio app privacy, Faazio personal data, Faazio Karaikal privacy, DPDP, data deletion Faazio";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
  head: () => seoHead({ path: "/privacy", title, description, keywords }),
});

const privacySections: PolicySection[] = [
  {
    id: "who-we-are",
    title: "1. Who we are and what this policy covers",
    body: (
      <>
        <p>
          Faazio is a daily superapp operated by {BUSINESS_LEGAL_NAME}, based in {BUSINESS_CITY},{" "}
          {BUSINESS_REGION}, India. This policy explains what personal data we collect through the
          Faazio apps (Mart, Food, Pharma, and community features) and the website at
          https://faazio.com, why we collect it, how we use and share it, and the choices you have.
        </p>
        <p>
          It applies to customers, delivery partners, and seller partners. By creating an account or
          using Faazio, you confirm that you have read and understood this policy. If you do not
          agree with it, please do not use the service.
        </p>
        <p>
          <strong>Effective date:</strong> 28 October 2026.
        </p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "2. Information we collect",
    body: (
      <>
        <PolicyList
          items={[
            <>
              <strong>Account and contact details.</strong> Your name, email address, phone number,
              and saved delivery addresses. We verify phone numbers with a one-time password (OTP).
            </>,
            <>
              <strong>Orders and transactions.</strong> Items ordered, order value, fulfilment
              method, delivery address, order status, payment status, and any support, return, or
              refund requests you raise.
            </>,
            <>
              <strong>Location.</strong> With your permission, we use your device's approximate and
              precise location to show nearby stores and estimate delivery. Customers share location
              only while using the app. Delivery partners share location while they are online on a
              delivery so we can dispatch, coordinate, and support active orders.
            </>,
            <>
              <strong>Camera and photos.</strong> If you grant camera or photo permission, we use it
              only for the feature you choose — for example, uploading a prescription or partner
              verification document. You can use the rest of Faazio without granting these
              permissions, although some features will not work.
            </>,
            <>
              <strong>Device and technical data.</strong> Device model, operating system, app
              version, IP address, and diagnostic or security logs.
            </>,
            <>
              <strong>Usage data.</strong> In-app events such as products viewed or features used,
              linked to a hashed identifier. We use this to understand what is working and improve
              recommendations.
            </>,
            <>
              <strong>Push notifications.</strong> A Firebase Cloud Messaging token so we can send
              order updates and service messages. You can disable notifications in your device
              settings.
            </>,
            <>
              <strong>Installed payment apps.</strong> To show the UPI payment options available at
              checkout, we check which UPI apps (for example Google Pay, PhonePe, Paytm, Amazon Pay,
              or BHIM) are installed on your device. This check happens locally on your device; we
              do not transmit the list of installed apps to our servers.
            </>,
            <>
              <strong>Community and reviews.</strong> If you use Faazio Community (including blood
              donation features) or post a review, we collect the details you choose to submit.
              Public views redact sensitive contact details where appropriate.
            </>,
            <>
              <strong>Partner information.</strong> If you join as a seller or delivery partner, we
              collect the business, identity, vehicle, and KYC information needed to verify you,
              plus payout details. Sensitive documents are stored in private storage with restricted
              access.
            </>,
            <>
              <strong>Website.</strong> faazio.com does not use advertising or third-party analytics
              cookies. Our servers keep basic request logs (such as IP address, browser type, and
              the page requested) for security and reliability. The site loads web fonts from Google
              Fonts, which receives your IP address as part of that request.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "3. How we use your information",
    body: (
      <>
        <p>We use personal data to:</p>
        <PolicyList
          items={[
            "create and manage your account and verify your phone number;",
            "take, fulfil, and deliver orders, including sharing the minimum details needed with sellers and delivery partners;",
            "process payments, payouts, refunds, and returns;",
            "provide customer support and respond to your requests;",
            "personalise your experience, including product recommendations based on usage events;",
            "send transactional messages such as OTPs, order status, and delivery updates, and — where permitted — service or promotional messages that you can opt out of;",
            "protect the service, prevent fraud and abuse, and keep the platform secure;",
            "troubleshoot, monitor performance, and improve the app and website;",
            "comply with legal obligations and enforce our terms.",
          ]}
        />
        <p>
          We process personal data on the basis of your consent, the need to perform our contract
          with you, legal obligations, and other lawful grounds permitted under applicable law.
        </p>
      </>
    ),
  },
  {
    id: "how-we-share",
    title: "4. How we share your information",
    body: (
      <>
        <p>We share personal data only as needed for the purposes described in this policy:</p>
        <PolicyList
          items={[
            <>
              <strong>Service providers.</strong> Companies that help us run Faazio, including cloud
              hosting and content delivery (Render, Vercel, Cloudflare), databases and storage
              (Supabase, MongoDB Atlas, Aiven Valkey), SMS/OTP and push notifications (Google
              Firebase), maps and places (Google), and payment or payout processing (Razorpay). They
              may process data only for the services they provide to us.
            </>,
            <>
              <strong>Sellers and merchants.</strong> The order and fulfilment details needed to
              prepare and hand over your order.
            </>,
            <>
              <strong>Delivery partners.</strong> Your name, phone number, drop-off location and
              address, and order details while a delivery is assigned to them.
            </>,
            <>
              <strong>Legal and safety.</strong> We may disclose data if required by law, a court
              order, or a lawful request from a public authority, or where necessary to protect the
              rights, safety, or security of Faazio, our users, or the public.
            </>,
            <>
              <strong>Business transfer.</strong> If Faazio is involved in a merger, acquisition, or
              sale of assets, personal data may be transferred as part of that transaction, subject
              to this policy.
            </>,
            <>
              <strong>Aggregated information.</strong> We may share aggregated or de-identified
              information that cannot reasonably be used to identify you.
            </>,
          ]}
        />
        <p>
          We do not sell or rent your personal data, and we do not share it with third-party
          advertisers. Some of our service providers may process data outside India; where that
          happens, we take steps to require appropriate safeguards.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "5. How long we keep your information",
    body: (
      <>
        <p>
          We keep personal data only for as long as needed for the purposes described in this
          policy, to comply with legal obligations, to resolve disputes, and to enforce our
          agreements.
        </p>
        <PolicyList
          items={[
            "Account data is kept while your account is active. If you ask us to delete your account, we remove or anonymise the data unless we are required to keep it by law.",
            "Order and transaction records are kept for as long as required by tax, accounting, consumer-protection, and dispute-resolution rules.",
            "Prescription images and partner KYC documents are kept only as long as needed to provide the service and meet legal obligations, then deleted.",
            "Usage events are kept for about 90 days.",
            "Security and audit logs are currently kept for about 7 days.",
            "Abandoned carts are cleared after about 30 days.",
            "Blood donation requests expire automatically, generally within a day.",
          ]}
        />
        <p>When a retention period ends, we delete or anonymise the data.</p>
      </>
    ),
  },
  {
    id: "delete-account",
    title: "6. Delete your account",
    body: (
      <>
        <p>
          You can permanently delete your Faazio account in the app or by email. Deleting your
          account removes your personal data; a limited set of records is kept where the law
          requires it.
        </p>

        <h3 className="mt-6 font-display text-[19px] font-bold text-foreground">
          Delete your account in the app
        </h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-7 text-muted-foreground">
          <li>Open the Faazio app and go to the Account (You) tab.</li>
          <li>Open Privacy and security, then tap Delete account.</li>
          <li>Review what is deleted and kept, then confirm Delete my account.</li>
        </ol>

        <h3 className="mt-6 font-display text-[19px] font-bold text-foreground">
          Delete your account by email
        </h3>
        <p>
          If you cannot sign in, email{" "}
          <a
            href={`mailto:${BUSINESS_EMAIL}?subject=Delete%20my%20account`}
            className="font-semibold text-primary underline underline-offset-4"
          >
            {BUSINESS_EMAIL}
          </a>{" "}
          with the subject “Delete my account” from the email or phone number on your account. We
          may ask you to verify your identity before acting.
        </p>

        <h3 className="mt-6 font-display text-[19px] font-bold text-foreground">What we delete</h3>
        <PolicyList
          items={[
            "Account and profile details — name, email address, and phone number.",
            "Saved delivery addresses and default-address selection.",
            "Saved card tokens stored on your device.",
            "Favourites, recent searches, and cart contents.",
            "Prescription images and prescription details you uploaded.",
            "Blood donation records and notification device tokens.",
            "FaazioCoins balance and streak progress.",
          ]}
        />

        <h3 className="mt-6 font-display text-[19px] font-bold text-foreground">
          What we keep, and for how long
        </h3>
        <PolicyList
          items={[
            "Order, payment, return, and tax invoice records are kept as long as required by tax, accounting, consumer-protection, and dispute-resolution rules. They are no longer linked to your name, email address, or phone number.",
            "Security and audit logs are currently kept for about 7 days, then deleted.",
            "Hashed usage events are kept for about 90 days, then deleted.",
          ]}
        />
        <p>
          We complete deletion within 30 days of a verified request, except for records we must
          retain under the periods above. See{" "}
          <a href="#retention" className="font-semibold text-primary underline underline-offset-4">
            Section 5, “How long we keep your information”
          </a>{" "}
          for the full retention schedule.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "7. Your rights and choices",
    body: (
      <>
        <p>
          Subject to applicable law, including India's Digital Personal Data Protection Act, 2023,
          you may:
        </p>
        <PolicyList
          items={[
            "access a copy of the personal data we hold about you;",
            "correct or update inaccurate information;",
            "request deletion of your account and personal data;",
            "withdraw consent at any time, for example by disabling location, camera, or notification permissions;",
            "object to or request restriction of certain processing;",
            "request portability of data you provided, where applicable;",
            "opt out of promotional messages while continuing to receive essential service messages.",
          ]}
        />
        <p>
          To exercise a right, email{" "}
          <a
            href={`mailto:${BUSINESS_EMAIL}`}
            className="font-semibold text-primary underline underline-offset-4"
          >
            {BUSINESS_EMAIL}
          </a>{" "}
          with the subject “Privacy request”. We may need to verify your identity before acting. We
          will respond within the time required by applicable law. If you are in the EEA or UK, you
          may also have additional rights under the GDPR and can complain to your local supervisory
          authority. In India, you can complain to the Data Protection Board of India.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "8. Children's privacy",
    body: (
      <p>
        Faazio is intended for adults. It is not directed to children under 18, and we do not
        knowingly collect personal data from anyone under 18. If you believe a child has provided us
        with personal data, contact us at{" "}
        <a
          href={`mailto:${BUSINESS_EMAIL}`}
          className="font-semibold text-primary underline underline-offset-4"
        >
          {BUSINESS_EMAIL}
        </a>{" "}
        and we will delete it.
      </p>
    ),
  },
  {
    id: "security",
    title: "9. How we protect your information",
    body: (
      <>
        <p>
          We use technical and organisational safeguards designed to protect your personal data,
          including:
        </p>
        <PolicyList
          items={[
            "encryption in transit using HTTPS/TLS;",
            "encryption at rest through our cloud infrastructure providers;",
            "access controls and least-privilege permissions for systems that hold personal data;",
            "secure storage for session tokens on your device (iOS Keychain / Android Keystore);",
            "private storage and short-lived signed links for prescriptions and partner documents;",
            "monitoring and audit logs to detect misuse.",
          ]}
        />
        <p>
          We do not store full card numbers or CVV codes. No method of transmission or storage is
          completely secure, so please protect your account and contact us immediately if you
          suspect unauthorised access. We will never ask for your password or OTP by phone, email,
          or message.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "10. Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time. The effective date at the top of this page
        shows when it last changed. If we make a material change, we will notify you in the app or
        on this page before it takes effect. Please review this page periodically.
      </p>
    ),
  },
  {
    id: "contact",
    title: "11. Contact us",
    body: (
      <>
        <p>
          If you have questions, requests, or concerns about this policy or your personal data,
          contact:
        </p>
        <address className="mt-3 not-italic text-[14px] leading-7 text-muted-foreground">
          <strong>{BUSINESS_LEGAL_NAME}</strong>
          <br />
          {BUSINESS_STREET_ADDRESS}
          <br />
          {BUSINESS_CITY}, {BUSINESS_REGION} {BUSINESS_POSTAL_CODE}
          <br />
          India
          <br />
          Email:{" "}
          <a
            href={`mailto:${BUSINESS_EMAIL}`}
            className="font-semibold text-primary underline underline-offset-4"
          >
            {BUSINESS_EMAIL}
          </a>
          <br />
          Phone:{" "}
          <a
            href={`tel:${BUSINESS_PHONE.replace(/[^+\d]/g, "")}`}
            className="font-semibold text-primary underline underline-offset-4"
          >
            {BUSINESS_PHONE}
          </a>
        </address>
        <p>
          We aim to respond within a reasonable time and within any deadline required by applicable
          law.
        </p>
      </>
    ),
  },
];

function PrivacyPolicy() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader />
      <main id="main">
        <section className="page-hero" aria-labelledby="privacy-title">
          <div className="page-width">
            <p className="eyebrow">PRIVACY POLICY</p>
            <h1 id="privacy-title">Your privacy, in plain language.</h1>
            <p className="page-lead">
              How Faazio collects, uses, shares, and protects your information across our Mart,
              Food, Pharma, and community features.
            </p>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Effective 28 October 2026 · Applies to faazio.com and the Faazio apps
            </p>
          </div>
        </section>
        <section className="section">
          <div className="page-width">
            <div className="content-block">
              <h2 className="sr-only">Privacy policy details</h2>
              <Accordion
                type="multiple"
                defaultValue={privacySections.map((section) => section.id)}
              >
                {privacySections.map((section) => (
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
