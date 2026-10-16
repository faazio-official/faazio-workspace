/**
 * Single source of truth for canonical site metadata (SEO). Every route builds
 * absolute URLs from `SITE_URL` so Open Graph/Twitter/JSON-LD stay consistent.
 */
export const SITE_URL = "https://faazio.com";

export const SITE_NAME = "Faazio";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export const OG_IMAGE_WIDTH = 1200;

export const OG_IMAGE_HEIGHT = 630;
