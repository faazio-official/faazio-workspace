export interface MartCategoryTile {
  id: string;
  name: string;
  imageUrl: string;
  bgColor: string;
}

const squareImg = (id: string, w = 300) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

export const MART_ALL_CATEGORIES: MartCategoryTile[] = [
  { id: 'cat-1', name: 'Mobiles & Accessories', imageUrl: squareImg('photo-1511707171634-5f897ff02aa9'), bgColor: '#F0F4FF' },
  { id: 'cat-2', name: 'Electronics', imageUrl: squareImg('photo-1498049794561-7780e7231661'), bgColor: '#F0F4FF' },
  { id: 'cat-3', name: 'Fashion', imageUrl: squareImg('photo-1445205170230-053b83016050'), bgColor: '#FFF0F5' },
  { id: 'cat-4', name: 'Home & Kitchen', imageUrl: squareImg('photo-1556911220-bff31c812dba'), bgColor: '#FFF5E6' },
  { id: 'cat-5', name: 'Beauty & Personal Care', imageUrl: squareImg('photo-1596462502278-27bfdc403348'), bgColor: '#FFF0F5' },
  { id: 'cat-6', name: 'Toys, Kids & Baby', imageUrl: squareImg('photo-1558060370-d644479cb6f7'), bgColor: '#F0FFF0' },
  { id: 'cat-7', name: 'Grocery', imageUrl: squareImg('photo-1542838132-92c53300491e'), bgColor: '#F0FFF0' },
  { id: 'cat-8', name: 'Health & Pharmacy', imageUrl: squareImg('photo-1587854692152-cbe660dbde88'), bgColor: '#F0FFF0' },
  { id: 'cat-9', name: 'Furniture', imageUrl: squareImg('photo-1555041469-a586c61ea9bc'), bgColor: '#FFF5E6' },
  { id: 'cat-10', name: 'Sports, Books & More', imageUrl: squareImg('photo-1461896836934-ffe607ba8211'), bgColor: '#F0F4FF' },
  { id: 'cat-11', name: 'Automotive', imageUrl: squareImg('photo-1486262715619-67b85e0b08d3'), bgColor: '#F0F4FF' },
  { id: 'cat-12', name: 'Pet Supplies', imageUrl: squareImg('photo-1548199973-03cce0bbc87b'), bgColor: '#FFF5E6' },
  { id: 'cat-13', name: 'Watches & Accessories', imageUrl: squareImg('photo-1524805444758-089113d48a6d'), bgColor: '#F0F4FF' },
  { id: 'cat-14', name: 'Bags & Luggage', imageUrl: squareImg('photo-1553062407-98eeb64c6a62'), bgColor: '#FFF0F5' },
  { id: 'cat-15', name: 'Jewellery', imageUrl: squareImg('photo-1599643478518-a784e5dc4c8f'), bgColor: '#FFF0F5' },
  { id: 'cat-16', name: 'Footwear', imageUrl: squareImg('photo-1549298916-b41d501d3772'), bgColor: '#F0FFF0' },
  { id: 'cat-17', name: 'Stationery', imageUrl: squareImg('photo-1456735190827-d1262f71b8a3'), bgColor: '#F0F4FF' },
  { id: 'cat-18', name: 'Musical Instruments', imageUrl: squareImg('photo-1510915361894-db8b60106cb1'), bgColor: '#FFF5E6' },
  { id: 'cat-19', name: 'Cameras & Accessories', imageUrl: squareImg('photo-1502920917128-1aa500764cbd'), bgColor: '#F0F4FF' },
  { id: 'cat-20', name: 'Lighting', imageUrl: squareImg('photo-1507473885765-e6ed057f782c'), bgColor: '#FFF5E6' },
  { id: 'cat-21', name: 'Garden & Outdoor', imageUrl: squareImg('photo-1416879595882-3373a0480b5b'), bgColor: '#F0FFF0' },
  { id: 'cat-22', name: 'Smart Home', imageUrl: squareImg('photo-1558002038-1055907df827'), bgColor: '#F0F4FF' },
  { id: 'cat-23', name: 'Party & Occasions', imageUrl: squareImg('photo-1530103862676-de8c9debad1d'), bgColor: '#FFF0F5' },
  { id: 'cat-24', name: 'Travel Essentials', imageUrl: squareImg('photo-1503220317375-aaad61436b1b'), bgColor: '#F0FFF0' },
];
