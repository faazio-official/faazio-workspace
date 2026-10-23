import {
  BUSINESS_CITY,
  BUSINESS_COUNTRY,
  BUSINESS_DESCRIPTION,
  BUSINESS_EMAIL,
  BUSINESS_LEGAL_NAME,
  BUSINESS_NAME,
  BUSINESS_PHONE,
  BUSINESS_POSTAL_CODE,
  BUSINESS_PROFILES,
  BUSINESS_REGION,
  BUSINESS_STREET_ADDRESS,
  DEFAULT_OG_IMAGE,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

export type JsonLdNode = { "@type": string; [key: string]: unknown };

/**
 * LocalBusiness knowledge-graph nodes (Organization upgraded with address +
 * contact so Karaikal-based queries associate with the brand).
 */
export function localBusinessNode(): JsonLdNode {
  const node: JsonLdNode = {
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#org`,
    name: BUSINESS_NAME,
    alternateName: BUSINESS_LEGAL_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/android-chrome-512x512.png`,
    image: DEFAULT_OG_IMAGE,
    description: BUSINESS_DESCRIPTION,
    telephone: BUSINESS_PHONE,
    email: BUSINESS_EMAIL,
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS_STREET_ADDRESS,
      addressLocality: BUSINESS_CITY,
      addressRegion: BUSINESS_REGION,
      postalCode: BUSINESS_POSTAL_CODE,
      addressCountry: BUSINESS_COUNTRY,
    },
    areaServed: { "@type": "City", name: BUSINESS_CITY },
  };
  if (BUSINESS_PROFILES.length > 0) {
    node["sameAs"] = [...BUSINESS_PROFILES];
  }
  return node;
}

/** Platform-wide static nodes shared by every page's JSON-LD graph. */
export function sharedGraphNodes(): JsonLdNode[] {
  return [
    localBusinessNode(),
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: ["Faazio App", "Faazio SuperApp"],
      url: `${SITE_URL}/`,
      publisher: { "@id": `${SITE_URL}/#org` },
      inLanguage: "en-IN",
    },
    {
      "@type": "MobileApplication",
      name: SITE_NAME,
      operatingSystem: "Android, iOS",
      applicationCategory: "ShoppingApplication",
      description: BUSINESS_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#org` },
    },
  ];
}

/** A WebPage node linking into the shared WebSite/graph for a given route. */
export function webPageNode(path: string, title: string, description: string): JsonLdNode {
  return {
    "@type": "WebPage",
    "@id": `${SITE_URL}${path}`,
    url: `${SITE_URL}${path}`,
    name: title,
    description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#org` },
    inLanguage: "en-IN",
  };
}

type HeadOptions = {
  path: string;
  title: string;
  description: string;
  keywords: string;
  /** Extra graph nodes merged after the shared WebSite/MobileApplication/org nodes. */
  extraNodes?: JsonLdNode[];
};

/**
 * Builds the `meta`/`links`/`scripts` block a file route's `head()` returns.
 * Every route derives canonical URLs, OG/Twitter cards, and JSON-LD from the
 * same business identity in `src/lib/site.ts`.
 */
export function seoHead({ path, title, description, keywords, extraNodes = [] }: HeadOptions) {
  const canonicalUrl = `${SITE_URL}${path}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [webPageNode(path, title, description), ...sharedGraphNodes(), ...extraNodes],
  };
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "keywords", content: keywords },
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
  };
}
