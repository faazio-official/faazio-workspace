/** Only module allowed to read env. Keeps app code portable. */
export const config = {
  appName: "Faazio Partner Portal",
  storageKey: "faazio.portal.v1",
  commissionPercent: 8,
  tcsPercent: 1,
  coinEarnRate: 1, // ops.platform_settings.COIN_EARN_RATE (coins per ₹100)
  coinRedeemRate: 0.5, // ops.platform_settings.COIN_REDEEM_RATE (₹ per coin)
  slaHours: 4,
} as const;
