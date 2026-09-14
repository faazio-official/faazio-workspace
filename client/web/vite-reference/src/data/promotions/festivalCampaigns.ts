// Provenance: promo.festival_campaigns + promo.festival_optins
import type { FestivalCampaign, SellerOptin } from "@/data/types";

export const FESTIVAL_CAMPAIGNS: FestivalCampaign[] = [
  {
    campaignId: "cmp-utsav-2026",
    name: "Faazio Utsav 2026",
    scope: "GLOBAL",
    startsAt: "2026-09-05T00:00:00.000Z",
    endsAt: "2026-09-25T23:59:00.000Z",
    bannerUrl: "mock://banner/utsav-2026.jpg",
    status: "LIVE",
    createdBy: "acc-3",
  },
  {
    campaignId: "cmp-mh-ganesh",
    name: "Ganesh Utsav Maharashtra",
    scope: "STATE",
    stateCode: "MH",
    startsAt: "2026-09-08T00:00:00.000Z",
    endsAt: "2026-09-18T23:59:00.000Z",
    bannerUrl: "mock://banner/mh-ganesh.jpg",
    status: "LIVE",
    createdBy: "acc-2",
  },
  {
    campaignId: "cmp-mh-diwali",
    name: "Diwali Dhamaka Maharashtra",
    scope: "STATE",
    stateCode: "MH",
    startsAt: "2026-10-28T00:00:00.000Z",
    endsAt: "2026-11-08T23:59:00.000Z",
    bannerUrl: "mock://banner/mh-diwali.jpg",
    status: "SCHEDULED",
    createdBy: "acc-2",
  },
  {
    campaignId: "cmp-ka-onam",
    name: "Onam Special Karnataka",
    scope: "STATE",
    stateCode: "KA",
    startsAt: "2026-08-20T00:00:00.000Z",
    endsAt: "2026-08-30T23:59:00.000Z",
    bannerUrl: "mock://banner/ka-onam.jpg",
    status: "ENDED",
    createdBy: "acc-3",
  },
];

export const SELLER_OPTINS: SellerOptin[] = [
  {
    optinId: "opt-1",
    campaignId: "cmp-mh-ganesh",
    sellerId: "sel-1",
    productId: "md-1",
    discountPercent: 30,
    status: "APPROVED",
  },
  {
    optinId: "opt-2",
    campaignId: "cmp-utsav-2026",
    sellerId: "sel-1",
    productId: "fm-f1",
    discountPercent: 22,
    status: "PENDING",
  },
  {
    optinId: "opt-3",
    campaignId: "cmp-utsav-2026",
    sellerId: "sel-4",
    productId: "ph-2",
    discountPercent: 12,
    status: "APPROVED",
  },
];
