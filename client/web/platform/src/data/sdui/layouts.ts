// Provenance: MongoDB sdui_layouts (ID-only refs; the gateway joins product/store docs)
import type { SduiLayout } from "@/data/types";

export const SDUI_LAYOUTS: SduiLayout[] = [
  {
    layoutId: "home",
    locale: "en-IN",
    path: "/home",
    version: 12,
    status: "PUBLISHED",
    sections: [
      { sectionId: "sec-hero", title: "Diwali Deals", type: "banner", itemIds: ["cmp-diwali"] },
      { sectionId: "sec-trending", title: "Trending Now", type: "rail", itemIds: ["md-1", "md-2", "md-3"] },
      { sectionId: "sec-pharma", title: "Pharmacy Essentials", type: "grid", itemIds: ["md-7", "md-8"] },
    ],
    updatedAt: "2026-09-22T06:00:00.000Z",
  },
  {
    layoutId: "home",
    locale: "en-IN",
    path: "/home",
    version: 13,
    status: "DRAFT",
    sections: [
      { sectionId: "sec-hero", title: "Festive Season", type: "banner", itemIds: ["cmp-diwali", "cmp-pongal"] },
      { sectionId: "sec-trending", title: "Trending Now", type: "rail", itemIds: ["md-1", "md-4", "md-5"] },
    ],
    updatedAt: "2026-09-25T10:30:00.000Z",
  },
];