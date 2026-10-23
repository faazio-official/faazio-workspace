/**
 * Single source of truth for canonical site metadata (SEO). Every route builds
 * absolute URLs from `SITE_URL` so Open Graph/Twitter/JSON-LD stay consistent.
 */
export const SITE_URL = "https://faazio.com";

export const SITE_NAME = "Faazio";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export const OG_IMAGE_WIDTH = 1200;

export const OG_IMAGE_HEIGHT = 630;

/**
 * LocalBusiness identity (JSON-LD). The legal entity behind Faazio is
 * FA CREATORS, registered in Karaikal, Puducherry.
 */
export const BUSINESS_NAME = "Faazio";

export const BUSINESS_LEGAL_NAME = "FA CREATORS";

export const BUSINESS_DESCRIPTION =
  "Faazio — daily superapp for groceries, food, and pharmacy in Karaikal.";

export const BUSINESS_STREET_ADDRESS = "54/2, Church Street, J.M. Kathija Complex";

export const BUSINESS_CITY = "Karaikal";

export const BUSINESS_REGION = "Puducherry";

export const BUSINESS_POSTAL_CODE = "609602";

export const BUSINESS_COUNTRY = "IN";

export const BUSINESS_PHONE = "+91-9843631722";

export const BUSINESS_EMAIL = "fashoppingofficial@gmail.com";

/**
 * Officially verified public profiles. Only add live URLs — the LocalBusiness
 * `sameAs` property is omitted while this list is empty (no fabricated links).
 */
export const BUSINESS_PROFILES: string[] = [];
