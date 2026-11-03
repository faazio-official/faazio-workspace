export type OrderStatus = "preparing" | "ready" | "out" | "scheduled" | "completed";

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  shortId: string;
  customer: string;
  customerOrders: number;
  status: OrderStatus;
  placedAt: string;
  items: OrderItem[];
  total: number;
  paid: boolean;
  priority?: boolean;
  instructions?: string;
  rider?: string;
  prepMins: number;
}

export const orders: Order[] = [
  {
    id: "7779456810",
    shortId: "8610",
    customer: "Mohammed Asif",
    customerOrders: 3,
    status: "preparing",
    placedAt: "10:52 AM",
    items: [
      { name: "Mango Fresh Juice", qty: 2, price: 120 },
      { name: "Veg Sandwich", qty: 1, price: 90 },
      { name: "Watermelon Fresh Juice", qty: 2, price: 85 },
    ],
    total: 500,
    paid: true,
    instructions: "Less sugar please",
    prepMins: 12,
  },
  {
    id: "7779456822",
    shortId: "8622",
    customer: "Priya S",
    customerOrders: 1,
    status: "preparing",
    placedAt: "10:56 AM",
    priority: true,
    items: [
      { name: "Pineapple Fresh Juice", qty: 1, price: 90 },
      { name: "Juicy Special Mix Sandwich", qty: 1, price: 140 },
    ],
    total: 230,
    paid: true,
    prepMins: 10,
  },
  {
    id: "7779456799",
    shortId: "8599",
    customer: "Karthik R",
    customerOrders: 7,
    status: "ready",
    placedAt: "10:40 AM",
    items: [{ name: "Orange Fresh Juice", qty: 2, price: 95 }],
    total: 190,
    paid: true,
    rider: "Suresh K",
    prepMins: 8,
  },
  {
    id: "7779456781",
    shortId: "8581",
    customer: "Divya M",
    customerOrders: 2,
    status: "out",
    placedAt: "10:21 AM",
    items: [
      { name: "Papaya Fresh Juice", qty: 1, price: 80 },
      { name: "Mosambi Fresh Juice", qty: 1, price: 80 },
    ],
    total: 160,
    paid: true,
    rider: "Ramesh P",
    prepMins: 8,
  },
  {
    id: "7779456700",
    shortId: "8700",
    customer: "Arun V",
    customerOrders: 4,
    status: "scheduled",
    placedAt: "Today, 06:30 PM",
    items: [
      { name: "Strawberry Fresh Juice", qty: 3, price: 110 },
      { name: "Sweet Corn Sandwich", qty: 2, price: 100 },
    ],
    total: 530,
    paid: true,
    prepMins: 15,
  },
  {
    id: "7779456612",
    shortId: "8612",
    customer: "Sneha J",
    customerOrders: 5,
    status: "completed",
    placedAt: "Yesterday, 08:12 PM",
    items: [{ name: "Mango Fresh Juice", qty: 1, price: 120 }],
    total: 120,
    paid: true,
    rider: "Ajith",
    prepMins: 7,
  },
  {
    id: "7779456535",
    shortId: "8535",
    customer: "Mohamed Ali",
    customerOrders: 1,
    status: "completed",
    placedAt: "Yesterday, 05:44 PM",
    items: [
      { name: "Muskmelon Fresh Juice", qty: 2, price: 85 },
      { name: "Veg Sandwich", qty: 1, price: 90 },
    ],
    total: 260,
    paid: true,
    rider: "Prabhu",
    prepMins: 9,
  },
];

export const orderTabs: { key: OrderStatus; label: string }[] = [
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "out", label: "Out for delivery" },
  { key: "scheduled", label: "Scheduled" },
  { key: "completed", label: "Completed" },
];
