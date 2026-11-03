// Restaurant / outlet profile mock. Replace with DB fetch later.
export const restaurant = {
  id: "22868390",
  name: "Bangalore Juicy and Foods",
  area: "Karaikal",
  city: "Karaikal, Karaikal",
  cuisines: "Desserts, Shake, Juices, Beverages",
  address:
    "Bharathiyar Salai, Near Govt Arignar Anna College, Karaikal Main Road, Karaikal, Puducherry 609602",
  rating: 4.6,
  ratingCount: 26,
  ownerName: "Bangalore Juicy and Foods",
  ownerPhone: "+91 8015034866",
  ownerEmail: "bangalorejuicyandfoods@gmail.com",
  coverImage:
    "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=900&q=70",
};

export type Restaurant = typeof restaurant;
