// Data access layer. Every screen-level read goes through here so mocks can be
// swapped for real DB/API calls without touching UI code.
import * as hub from "@/mocks/hub";
import * as finance from "@/mocks/finance";
import * as help from "@/mocks/help";
import { orderTabs } from "@/mocks/orders";
import { outOfStockOptions, menuFilters } from "@/mocks/menu";
import { scheduleOffReasons, rushDurations, days } from "@/mocks/outlet";
import { paperSizes } from "@/mocks/settings";

export const api = {
  hub,
  finance,
  help,
  orderTabs,
  outOfStockOptions,
  menuFilters,
  scheduleOffReasons,
  rushDurations,
  days,
  paperSizes,
};
