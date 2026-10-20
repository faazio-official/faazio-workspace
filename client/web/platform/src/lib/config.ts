/** Only module allowed to read env. Keeps app code portable. */
const env = {
  gatewayUrl: process.env["NEXT_PUBLIC_GATEWAY_URL"]?.replace(/\/+$/, "") ?? "",
  supabaseUrl: process.env["NEXT_PUBLIC_SUPABASE_URL"]?.replace(/\/+$/, "") ?? "",
  supabaseAnonKey: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "",
  /** Cloudflare R2 media CDN origin (custom domain in front of the public bucket), e.g. https://img.faazio.in. */
  mediaCdnBase: process.env["NEXT_PUBLIC_MEDIA_CDN_BASE"]?.replace(/\/+$/, "") ?? "",
  /**
   * Auth mode. `mock` (default) uses the built-in demo directory; `supabase` uses GoTrue;
   * `portal` uses the gateway-native SUPER_ADMIN email+password session (HttpOnly cookies).
   */
  authMode:
    process.env["NEXT_PUBLIC_AUTH_MODE"] === "portal"
      ? "portal"
      : process.env["NEXT_PUBLIC_AUTH_MODE"] === "supabase"
        ? "supabase"
        : "mock",
  /**
   * Dev-only identity override for an `AUTH_DISABLED=true` gateway (local/MVP staging). Mapped to
   * the `X-Dev-*` headers; never sent in production builds. Empty in any real deployment.
   */
  devRole: process.env["NEXT_PUBLIC_DEV_ROLE"] ?? "",
  devSeller: process.env["NEXT_PUBLIC_DEV_SELLER"] ?? "",
  devState: process.env["NEXT_PUBLIC_DEV_STATE"] ?? "",
};

export const config = {
  appName: "Faazio Partner Portal",
  storageKey: "faazio.portal.v1",
  authStorageKey: "faazio.auth.v1",
  commissionPercent: 8,
  tcsPercent: 1,
  coinEarnRate: 1, // ops.platform_settings.COIN_EARN_RATE (coins per ₹100)
  coinRedeemRate: 0.5, // ops.platform_settings.COIN_REDEEM_RATE (₹ per coin)
  slaHours: 4,
  /** Go Chi gateway base URL. Empty = local seed mode (no network). */
  gatewayUrl: env.gatewayUrl,
  /** Supabase project URL. Empty = local seed mode. */
  supabaseUrl: env.supabaseUrl,
  supabaseAnonKey: env.supabaseAnonKey,
  /** Cloudflare R2 media CDN origin (maps stored `r2:<key>` values to displayable URLs). */
  mediaCdnBase: env.mediaCdnBase,
  /**
   * "mock" (default) signs in against the built-in demo directory; "supabase" uses GoTrue;
   * "portal" uses the gateway-native superadmin session.
   */
  authMode: env.authMode,
  /** Dev-only `X-Dev-*` identity override for an AUTH_DISABLED gateway (empty in production). */
  devRole: env.devRole,
  devSeller: env.devSeller,
  devState: env.devState,
} as const;

/** True when the portal is wired to the live gateway. */
export function remoteConfigured(): boolean {
  return config.gatewayUrl.length > 0;
}

/** True when Supabase Auth (GoTrue) is configured. */
export function authConfigured(): boolean {
  return config.supabaseUrl.length > 0 && config.supabaseAnonKey.length > 0;
}

/**
 * True when the portal authenticates against the built-in demo directory. This
 * is the default **even when Supabase credentials are present** — opt back into
 * GoTrue with `NEXT_PUBLIC_AUTH_MODE=supabase`. Storage uploads still use the
 * Supabase creds via `authConfigured()`.
 */
export function authMocked(): boolean {
  return config.authMode === "mock";
}

/** True when the portal uses gateway-native HttpOnly-cookie superadmin auth. */
export function authPortal(): boolean {
  return config.authMode === "portal";
}
