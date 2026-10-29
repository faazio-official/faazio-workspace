/** Only module allowed to read env. Keeps app code portable. */
const env = {
  gatewayUrl: process.env["NEXT_PUBLIC_GATEWAY_URL"]?.replace(/\/+$/, "") ?? "",
  /** Cloudflare R2 media CDN origin (custom domain in front of the public bucket), e.g. https://img.faazio.in. */
  mediaCdnBase: process.env["NEXT_PUBLIC_MEDIA_CDN_BASE"]?.replace(/\/+$/, "") ?? "",
  /** Public legal pages shown on the sign-in screen. */
  termsUrl: process.env["NEXT_PUBLIC_TERMS_URL"]?.trim() ?? "",
  privacyUrl: process.env["NEXT_PUBLIC_PRIVACY_URL"]?.trim() ?? "",
};

/** Landing-page legal pages, used when the matching NEXT_PUBLIC_* URL is not set. */
const DEFAULT_TERMS_URL = "https://faazio.com/terms";
const DEFAULT_PRIVACY_URL = "https://faazio.com/privacy";

export const config = {
  appName: "Faazio Partner Portal",
  storageKey: "faazio.portal.v1",
  tcsPercent: 1,
  coinEarnRate: 1, // ops.platform_settings.COIN_EARN_RATE (coins per ₹100)
  coinRedeemRate: 0.5, // ops.platform_settings.COIN_REDEEM_RATE (₹ per coin)
  slaHours: 4,
  /** Go Chi gateway base URL. The browser only talks to the same-origin /api/gateway proxy. */
  gatewayUrl: env.gatewayUrl,
  /** Cloudflare R2 media CDN origin (maps stored `r2:<key>` values to displayable URLs). */
  mediaCdnBase: env.mediaCdnBase,
  /** Terms & Conditions URL, defaulting to the landing page when unset. */
  termsUrl: env.termsUrl || DEFAULT_TERMS_URL,
  /** Privacy Policy URL, defaulting to the landing page when unset. */
  privacyUrl: env.privacyUrl || DEFAULT_PRIVACY_URL,
} as const;

/** True when the portal is wired to the live gateway. */
export function remoteConfigured(): boolean {
  return config.gatewayUrl.length > 0;
}
