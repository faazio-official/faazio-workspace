import type { Order } from "./types";
const R = (name: string, address: string) => ({ name, address, phone: "+919000000001" });
const C = (name: string, address: string) => ({ name, address, phone: "+919000000002" });
export const historyOrders: Order[] = [
  { id: "ZIP-ORD-MY167J", restaurant: R("Elite Juice Bar", "Igra school, 6/1 thiagarajar street, Karaikal, Puducherry 609602, India"), customer: C("Maahira", "Igra school, 6/1 thiagarajar street, 7, Thiagarajar St, Karaikal, Puducherry 609602, India"),
    items: [{ name: "Pine Apple", qty: 1, price: 60 }, { name: "Sweet Lime", qty: 2, price: 60 }, { name: "Blue Curacao Mojito", qty: 1, price: 80 }, { name: "Lime Pine Apple", qty: 1, price: 60 }, { name: "Lime Juice", qty: 2, price: 30 }],
    deliveryFee: 30, packingCharge: 35, tip: 10, payment: "online", type: "Standard", status: "delivered", createdAt: "2026-11-06T13:34:00" },
  { id: "ZIP-ORD-YAILEB", restaurant: R("Juice World V2 Family Restaurant", "Kamaraj Salai, Karaikal, Puducherry 609602, India"), customer: C("Sukanya", "Aathmalayaa senai secondary school, XR3F+R5 Kottucherry, Puducherry, India"),
    items: [{ name: "Chicken Fried Rice", qty: 1, price: 150 }, { name: "Gobi 65", qty: 1, price: 90 }],
    deliveryFee: 30, packingCharge: 0, tip: 0, payment: "online", type: "Standard", status: "delivered", createdAt: "2026-11-06T12:40:00" },
  { id: "ZIP-ORD-NPQZN5", restaurant: R("Hotel Raaman", "Hotel Raman, Bharathiyar Rd, Karaikal, Tamil Nadu 609602, India"), customer: C("Durga Devi", "No.14 H M T Colony Thiruvalluvar Nagar Patchur, WRGC+RXM, SH 147, Karaikal, Puducherry 609602, India"),
    items: [{ name: "Veg Meals (South Indian)", qty: 1, price: 120 }, { name: "Veg Biryani", qty: 1, price: 90 }],
    deliveryFee: 30, packingCharge: 0, tip: 10, payment: "online", type: "Standard", status: "delivered", createdAt: "2026-11-06T11:59:00" },
  { id: "ZIP-ORD-B34SCW", restaurant: R("Hotel Arasan", "Bharathiyar Rd, Karaikal, Puducherry 609602, India"), customer: C("Siva", "102, saraswathy nagar 2nd cross patchur, WRCC+X4P, Karaikal, Puducherry 609602, India"),
    items: [{ name: "Parotta", qty: 4, price: 25 }, { name: "Chicken Gravy", qty: 1, price: 110 }],
    deliveryFee: 30, packingCharge: 10, tip: 0, payment: "online", type: "Standard", status: "delivered", createdAt: "2026-11-05T20:12:00" },
  { id: "ZIP-ORD-QDTERY", restaurant: R("Kimichi Tower", "Plot No. 57, Thomas Arul street, Keezhaveli, Karaikal, Puducherry 609602, India"), customer: C("Yasmin", "no9,pasumpon nagar 3rd cross karaikal 609602, WRGR+HCG, Karaikal, Puducherry 609602, India"),
    items: [{ name: "Korean Fried Chicken", qty: 2, price: 220 }, { name: "Kimchi Ramen", qty: 1, price: 130 }],
    deliveryFee: 30, packingCharge: 0, tip: 10, payment: "online", type: "Standard", status: "delivered", createdAt: "2026-11-04T19:40:00" },
  { id: "ZIP-ORD-ULVV9P", restaurant: R("Kimichi Tower", "Plot No. 57, Thomas Arul street, Keezhaveli, Karaikal, Puducherry 609602, India"), customer: C("Mohannad", "15, JAWAHAR STREET, AMBARAGATHUR, XP4G+G56, Ambagarathur, Puducherry 609601, India"),
    items: [{ name: "Chick-Pop Cheese Fries", qty: 1, price: 343 }, { name: "Honey Chili", qty: 1, price: 340 }],
    deliveryFee: 30, packingCharge: 0, tip: 10, payment: "online", type: "Standard", status: "delivered", createdAt: "2026-11-04T17:59:00" },
  { id: "ZIP-ORD-XTJLIP", restaurant: R("Delice Restaurant", "Madha Kovil St, Karaikal, Puducherry 609602, India"), customer: C("Eshwar Mathi", "11 Kamban Nagar Keezhakasakudy Karaikal, Puducherry 609604, India"),
    items: [{ name: "Shawarma Plate", qty: 2, price: 140 }, { name: "Lime Soda", qty: 2, price: 40 }],
    deliveryFee: 30, packingCharge: 0, tip: 10, payment: "online", type: "Standard", status: "delivered", createdAt: "2026-11-04T14:10:00" },
  { id: "ZIP-ORD-YRKG5J", restaurant: R("The Mint Max", "1st Floor, No 30, 1st Cross, Karaikal, Puducherry 609602, India"), customer: C("Edward Anand", "35, Sornammbalam St, Karaikal, Puducherry 609602, India"),
    items: [{ name: "Chicken Burger", qty: 2, price: 160 }, { name: "French Fries", qty: 1, price: 70 }],
    deliveryFee: 30, packingCharge: 0, tip: 0, payment: "online", type: "Standard", status: "delivered", createdAt: "2026-11-03T19:34:00" },
  { id: "ZIP-ORD-DLVMCZ", restaurant: R("Le Royal Mandi", "180, Thomas Arul St, Karaikal, Puducherry 609602, India"), customer: C("Farisha", "180 Samathuva puram, samathuvapuram 180, Pudhuthurai Rd, Puththurai, Karaikal, Puducherry 609602, India"),
    items: [{ name: "Extra Mayonnaise", qty: 1, price: 25 }, { name: "Chicken Mandi Single", qty: 1, price: 260 }, { name: "Alfaham Chicken Quarter", qty: 1, price: 160 }],
    deliveryFee: 30, packingCharge: 0, tip: 10, payment: "cod", type: "Standard", status: "delivered", createdAt: "2026-11-02T10:12:00" },
  { id: "ZIP-ORD-SU58FT", restaurant: R("The Mint Max", "1st Floor, No 30, 1st Cross, Karaikal, Puducherry 609602, India"), customer: C("Niyas M", "1st Floor, No 30, 1st Cross, WRMH+RJF, Aaniyar Nagar 2nd Cross Rd, Thandhai Periyar Nagar, Karaikal, Puducherry 609602, India"),
    items: [{ name: "Zinger Wrap", qty: 1, price: 150 }, { name: "Cold Coffee", qty: 1, price: 81 }],
    deliveryFee: 30, packingCharge: 0, tip: 10, payment: "online", type: "Standard", status: "delivered", createdAt: "2026-11-01T20:11:00" },
];
// Orders the mock "dispatcher" offers when the partner is on duty.
export const incomingPool: Omit<Order, "createdAt" | "status">[] = [
  { id: "ZIP-ORD-K7PQ2A", restaurant: R("Elite Juice Bar", "Igra school, 6/1 thiagarajar street, Karaikal, Puducherry 609602, India"), customer: C("Arjun", "22, Nehru Street, Karaikal, Puducherry 609602, India"),
    items: [{ name: "Watermelon Juice", qty: 2, price: 50 }, { name: "Blue Curacao Mojito", qty: 1, price: 80 }], deliveryFee: 30, packingCharge: 15, tip: 20, payment: "cod", type: "Standard" },
  { id: "ZIP-ORD-H3MZ8T", restaurant: R("Hotel Raaman", "Hotel Raman, Bharathiyar Rd, Karaikal, Tamil Nadu 609602, India"), customer: C("Priya", "8, Bharathi Nagar, Karaikal, Puducherry 609602, India"),
    items: [{ name: "Veg Meals (South Indian)", qty: 2, price: 120 }], deliveryFee: 30, packingCharge: 0, tip: 10, payment: "online", type: "Standard" },
];
