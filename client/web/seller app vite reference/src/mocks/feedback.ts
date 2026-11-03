export interface Review {
  id: string;
  orderId: string;
  customer: string;
  customerOrders: number;
  rating: number;
  date: string;
  text?: string;
  items: string[];
  replied?: string;
}

export interface Complaint {
  id: string;
  orderId: string;
  customer: string;
  issue: string;
  date: string;
  status: "open" | "resolved";
  amount: number;
}

export const reviews: Review[] = [
  { id: "r1", orderId: "7779456612", customer: "NAFILSHAHA", customerOrders: 4, rating: 5, date: "31 Oct, 08:40 PM", text: "Very fresh juice, quick delivery!", items: ["Mango Fresh Juice"] },
  { id: "r2", orderId: "7779456535", customer: "Unnikrishnan M", customerOrders: 1, rating: 4, date: "30 Oct, 06:12 PM", items: ["Muskmelon Fresh Juice", "Veg Sandwich"] },
  { id: "r3", orderId: "7779456411", customer: "Sanjay", customerOrders: 2, rating: 5, date: "28 Oct, 01:20 PM", text: "Best orange juice in Karaikal.", items: ["Orange Fresh Juice"] },
  { id: "r4", orderId: "7779456309", customer: "Fathima", customerOrders: 6, rating: 3, date: "26 Oct, 09:05 PM", text: "Taste good but bit less quantity", items: ["Papaya Fresh Juice"] },
  { id: "r5", orderId: "7779456201", customer: "Ravi Kumar", customerOrders: 1, rating: 5, date: "24 Oct, 04:44 PM", items: ["Pineapple Fresh Juice"] },
];

export const complaints: Complaint[] = [];
