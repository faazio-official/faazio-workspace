import { useSyncExternalStore } from "react";
import { restaurant } from "@/mocks/restaurant";
import { orders as mockOrders, type Order, type OrderStatus } from "@/mocks/orders";
import { menuCategories, addons as mockAddons, type MenuCategory, type Addon, type StockState, type MenuItem } from "@/mocks/menu";
import { reviews as mockReviews, complaints as mockComplaints } from "@/mocks/feedback";
import { timings as mockTimings, upcomingOccasions, staff as mockStaff, contacts as mockContacts, type DayTiming, type Occasion, type Staff } from "@/mocks/outlet";
import { appSettings, communications, deliverySettings } from "@/mocks/settings";

// Single in-memory store seeded from /mocks. Swap actions for API calls when a DB is connected.
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export interface AppState {
  restaurant: typeof restaurant;
  online: boolean;
  rush: { on: boolean; until?: string };
  scheduleOff: null | { reason: string; from: string; to: string };
  orders: Order[];
  categories: MenuCategory[];
  addons: Addon[];
  reviews: typeof mockReviews;
  complaints: typeof mockComplaints;
  timings: DayTiming[];
  occasions: Occasion[];
  customOccasions: Occasion[];
  staff: Staff[];
  contacts: typeof mockContacts;
  settings: typeof appSettings;
  comms: typeof communications;
  delivery: typeof deliverySettings;
  silentBanner: boolean;
  cart: Record<string, number>;
}

let state: AppState = {
  restaurant: clone(restaurant),
  online: true,
  rush: { on: false },
  scheduleOff: null,
  orders: clone(mockOrders),
  categories: clone(menuCategories),
  addons: clone(mockAddons),
  reviews: clone(mockReviews),
  complaints: clone(mockComplaints),
  timings: clone(mockTimings),
  occasions: clone(upcomingOccasions),
  customOccasions: [],
  staff: clone(mockStaff),
  contacts: clone(mockContacts),
  settings: clone(appSettings),
  comms: clone(communications),
  delivery: clone(deliverySettings),
  silentBanner: true,
  cart: {},
};

const listeners = new Set<() => void>();
export const getState = () => state;
export function setState(fn: (s: AppState) => Partial<AppState>) {
  state = { ...state, ...fn(state) };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useApp<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

// ---------- actions ----------
export const actions = {
  setOnline: (online: boolean) => setState(() => ({ online })),
  moveOrder: (id: string, status: OrderStatus) =>
    setState((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) })),
  rejectOrder: (id: string) => setState((s) => ({ orders: s.orders.filter((o) => o.id !== id) })),
  setItemStock: (itemId: string, stock: StockState) =>
    setState((s) => ({
      categories: s.categories.map((c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, stock } : i)) })),
    })),
  updateItem: (itemId: string, patch: Partial<MenuItem>) =>
    setState((s) => ({
      categories: s.categories.map((c) => ({ ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) })),
    })),
  addItem: (categoryId: string, item: MenuItem) =>
    setState((s) => ({ categories: s.categories.map((c) => (c.id === categoryId ? { ...c, items: [...c.items, item] } : c)) })),
  deleteItem: (itemId: string) =>
    setState((s) => ({ categories: s.categories.map((c) => ({ ...c, items: c.items.filter((i) => i.id !== itemId) })) })),
  setCategoryEnabled: (id: string, enabled: boolean) =>
    setState((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, enabled } : c)) })),
  addCategory: (name: string) =>
    setState((s) => ({ categories: [...s.categories, { id: "c" + Date.now(), name, subName: name, enabled: true, items: [] }] })),
  setAddonStock: (id: string, inStock: boolean) =>
    setState((s) => ({ addons: s.addons.map((a) => (a.id === id ? { ...a, inStock } : a)) })),
  addAddon: (a: Addon) => setState((s) => ({ addons: [...s.addons, a] })),
  replyReview: (id: string, reply: string) =>
    setState((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, replied: reply } : r)) })),
  setTimings: (timings: DayTiming[]) => setState(() => ({ timings })),
  setOccasionStatus: (id: string, status: "open" | "closed") =>
    setState((s) => ({ occasions: s.occasions.map((o) => (o.id === id ? { ...o, status } : o)) })),
  addCustomOccasion: (o: Occasion) => setState((s) => ({ customOccasions: [...s.customOccasions, o] })),
  removeCustomOccasion: (id: string) => setState((s) => ({ customOccasions: s.customOccasions.filter((o) => o.id !== id) })),
  addStaff: (st: Staff) => setState((s) => ({ staff: [...s.staff, st] })),
  removeStaff: (id: string) => setState((s) => ({ staff: s.staff.filter((x) => x.id !== id) })),
  addContact: (key: "orderReminder" | "restaurantPage", phone: string) =>
    setState((s) => ({ contacts: { ...s.contacts, [key]: [...s.contacts[key], phone] } })),
  removeContact: (key: "orderReminder" | "restaurantPage", phone: string) =>
    setState((s) => ({ contacts: { ...s.contacts, [key]: s.contacts[key].filter((p) => p !== phone) } })),
  setSettings: (p: Partial<AppState["settings"]>) => setState((s) => ({ settings: { ...s.settings, ...p } })),
  setComms: (p: Partial<AppState["comms"]>) => setState((s) => ({ comms: { ...s.comms, ...p } })),
  setDelivery: (p: Partial<AppState["delivery"]>) => setState((s) => ({ delivery: { ...s.delivery, ...p } })),
  setRush: (rush: AppState["rush"]) => setState(() => ({ rush })),
  setScheduleOff: (v: AppState["scheduleOff"]) => setState(() => ({ scheduleOff: v, online: v ? false : true })),
  hideSilentBanner: () => setState(() => ({ silentBanner: false })),
  addToCart: (id: string, d: number) =>
    setState((s) => {
      const n = Math.max(0, (s.cart[id] ?? 0) + d);
      const cart = { ...s.cart, [id]: n };
      if (!n) delete cart[id];
      return { cart };
    }),
  clearCart: () => setState(() => ({ cart: {} })),
};

export const totalItems = (cats: MenuCategory[]) => cats.reduce((n, c) => n + c.items.length, 0);
export const stockLabel = (s: StockState) =>
  s.type === "in" ? "In stock" : s.type === "hold" ? "On hold" : s.until;
