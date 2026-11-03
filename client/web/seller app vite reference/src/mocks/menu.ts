export type StockState =
  | { type: "in" }
  | { type: "out"; until: string } // human label e.g. "Back in stock at 2:00 PM"
  | { type: "hold" }; // on hold by platform

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  veg: boolean;
  description?: string;
  image?: string;
  stock: StockState;
}

export interface MenuCategory {
  id: string;
  name: string;
  subName: string;
  enabled: boolean;
  items: MenuItem[];
}

export interface Addon {
  id: string;
  name: string;
  group: string;
  price: number;
  veg: boolean;
  inStock: boolean;
}

const j = (id: string, name: string, price: number, stock: StockState = { type: "in" }): MenuItem => ({
  id,
  name,
  price,
  veg: true,
  stock,
  description: "Freshly squeezed, served chilled. No added preservatives.",
});

export const menuCategories: MenuCategory[] = [
  {
    id: "juices",
    name: "Juices",
    subName: "Juices",
    enabled: true,
    items: [
      j("j1", "Anar Fresh Juice", 120),
      j("j2", "Strawberry Fresh Juice", 110, { type: "out", until: "No stock set. Turn item in stock manually" }),
      j("j3", "Carrot Fresh Juice", 80),
      j("j4", "Mango Fresh Juice", 120),
      j("j5", "Muskmelon Fresh Juice", 85),
      j("j6", "Pineapple Fresh Juice", 90),
      j("j7", "Mosambi Fresh Juice", 80),
      j("j8", "Orange Fresh Juice", 95),
      j("j9", "Watermelon Fresh Juice", 85, { type: "out", until: "No stock set. Turn item in stock manually" }),
      j("j10", "Papaya Fresh Juice", 80),
      j("j11", "Grape Fresh Juice", 90),
    ],
  },
  {
    id: "shakes",
    name: "Shakes",
    subName: "Milkshakes",
    enabled: true,
    items: [
      j("s1", "Chocolate Shake", 130),
      j("s2", "Vanilla Shake", 120),
      j("s3", "Oreo Shake", 140),
      j("s4", "Butterscotch Shake", 130),
    ],
  },
  {
    id: "sandwiches",
    name: "Sandwiches",
    subName: "Sandwiches",
    enabled: true,
    items: [
      { id: "w1", name: "Veg Sandwich", price: 90, veg: true, stock: { type: "in" } },
      { id: "w2", name: "Juicy Special Mix Sandwich", price: 140, veg: true, stock: { type: "in" } },
      { id: "w3", name: "Sweet Corn Sandwich", price: 100, veg: true, stock: { type: "hold" } },
    ],
  },
  {
    id: "rolls",
    name: "Rolls",
    subName: "Rolls",
    enabled: true,
    items: [
      { id: "r1", name: "Beef Kathi Roll", price: 110, veg: false, stock: { type: "hold" } },
      { id: "r2", name: "Paneer Roll", price: 100, veg: true, stock: { type: "in" } },
    ],
  },
];

export const addons: Addon[] = [
  { id: "a1", name: "Extra Ice Cream Scoop", group: "Toppings", price: 30, veg: true, inStock: true },
  { id: "a2", name: "Dry Fruits", group: "Toppings", price: 25, veg: true, inStock: true },
  { id: "a3", name: "Extra Cheese", group: "Sandwich extras", price: 20, veg: true, inStock: false },
];

export const outOfStockOptions = [
  { key: "2h", label: "2 hours" },
  { key: "4h", label: "4 hours" },
  { key: "next", label: "Next business day", sub: "Opens tomorrow at 12:00 AM" },
  { key: "custom", label: "Custom date & time" },
  { key: "manual", label: "I will turn it back in stock myself" },
] as const;

export const menuFilters = [
  "On hold",
  "Out of stock",
  "In stock",
  "Veg",
  "Non-veg",
  "Egg",
  "Missing images",
  "Missing description",
  "Recommended",
];
