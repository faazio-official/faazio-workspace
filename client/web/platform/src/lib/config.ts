/** Only module allowed to read env. Keeps app code portable. */
const env = {
  gatewayUrl: process.env["NEXT_PUBLIC_GATEWAY_URL"]?.replace(/\/+$/, "") ?? "",
  supabaseUrl: process.env["NEXT_PUBLIC_SUPABASE_URL"]?.replace(/\/+$/, "") ?? "",
  supabaseAnonKey: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "",
  /** Auth mode. Mocked unless explicitly opted into Supabase (`NEXT_PUBLIC_AUTH_MODE=supabase`). */
  authMode: process.env["NEXT_PUBLIC_AUTH_MODE"] === "supabase" ? "supabase" : "mock",
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
  /** "mock" (default) signs in against the built-in demo directory; "supabase" uses GoTrue. */
  authMode: env.authMode,
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
