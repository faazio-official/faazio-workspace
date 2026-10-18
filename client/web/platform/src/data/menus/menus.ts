// Provenance: directory.menus (seller_id, status from 0017). Seed fallback for the menu editor;
// the gateway hydrates real rows (price in rupees -> paisa) when configured.
import type { MenuItemRecord } from "@/data/types";

export const MENUS: MenuItemRecord[] = [
  { venueId: "store-f1", dishId: "rm-f1-1", name: "Hyderabadi Chicken Biryani", pricePaisa: 34900, mrpPaisa: 39900, isVeg: false, cuisine: "Hyderabadi", rating: 4.7, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?fm=jpg&q=80&w=400", sellerId: "sel-2", status: "ACTIVE" },
  { venueId: "store-f1", dishId: "rm-f1-2", name: "Veg Dum Biryani", pricePaisa: 27900, isVeg: true, cuisine: "Hyderabadi", rating: 4.5, image: "https://images.unsplash.com/photo-1642821373181-696a86d70e0e?fm=jpg&q=80&w=400", sellerId: "sel-2", status: "ACTIVE" },
  { venueId: "store-f2", dishId: "rm-f2-1", name: "Margherita Pizza", pricePaisa: 29900, isVeg: true, cuisine: "Italian", rating: 4.6, image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?fm=jpg&q=80&w=400", sellerId: "sel-2", status: "PENDING_REVIEW" },
  { venueId: "store-f2", dishId: "rm-f2-2", name: "Pepperoni Pizza", pricePaisa: 39900, isVeg: false, cuisine: "Italian", rating: 4.8, image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?fm=jpg&q=80&w=400", sellerId: "sel-2", status: "DRAFT" },
  { venueId: "dn-1", dishId: "rm-dn-1", name: "Paneer Butter Masala", pricePaisa: 32000, isVeg: true, cuisine: "North Indian", rating: 4.6, image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?fm=jpg&q=80&w=400", status: "DRAFT" },
];