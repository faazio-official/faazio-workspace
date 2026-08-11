export interface GroceryAisleCategory {
  id: string;
  name: string;
  imageUrl: string;
}

export interface GroceryTrustBadge {
  id: number;
  title: string;
  subtitle: string;
  bgColor: string;
  icon: 'shield' | 'leaf' | 'truck' | 'cube';
}

const squareImg = (id: string, w = 300) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

export const GROCERY_TRUST_BADGES: GroceryTrustBadge[] = [
  { id: 1, title: 'Great Prices', subtitle: 'Lower than market', bgColor: '#E6F4EA', icon: 'shield' },
  { id: 2, title: '100% Fresh', subtitle: 'Quality you can trust', bgColor: '#FFF3E0', icon: 'leaf' },
  { id: 3, title: 'Fast Delivery', subtitle: 'At your doorstep', bgColor: '#E3F2FD', icon: 'truck' },
  { id: 4, title: 'Wide Range', subtitle: 'Everything you need', bgColor: '#FCE4EC', icon: 'cube' },
];

export const GROCERY_AISLES: GroceryAisleCategory[] = [
  { id: 'ga-1', name: 'Rice & Grains', imageUrl: squareImg('photo-1586201375761-83865001e31c') },
  { id: 'ga-2', name: 'Pulses & Dals', imageUrl: squareImg('photo-1515543904379-3d757afe72e4') },
  { id: 'ga-3', name: 'Atta, Flours & Sooji', imageUrl: squareImg('photo-1509440159596-0249088772ff') },
  { id: 'ga-4', name: 'Cooking Oils & Ghee', imageUrl: squareImg('photo-1474979266404-7eaacbcd87c5') },
  { id: 'ga-5', name: 'Sugar, Salt & Jaggery', imageUrl: squareImg('photo-1526948531399-320e7e40f0ca') },
  { id: 'ga-6', name: 'Tea, Coffee & Health Drinks', imageUrl: squareImg('photo-1544787219-7f47ccb76574') },
  { id: 'ga-7', name: 'Spices & Masalas', imageUrl: squareImg('photo-1596040033229-a9821ebd058d') },
  { id: 'ga-8', name: 'Instant & Ready Mixes', imageUrl: squareImg('photo-1615485290382-441e4d049cb5') },
  { id: 'ga-9', name: 'Noodles, Pasta & Vermicelli', imageUrl: squareImg('photo-1612927395847-4a9a4dbe1d5c') },
  { id: 'ga-10', name: 'Sauces, Ketchup & Pickles', imageUrl: squareImg('photo-1472476443507-c7a5948772fc') },
  { id: 'ga-11', name: 'Biscuits & Snacks', imageUrl: squareImg('photo-1600026453320-ef36ea012f6b') },
  { id: 'ga-12', name: 'Breakfast & Cereals', imageUrl: squareImg('photo-1517673132405-a56a62b18caf') },
  { id: 'ga-13', name: 'Milk, Dairy & Paneer', imageUrl: squareImg('photo-1550583724-b2692b85b150') },
  { id: 'ga-14', name: 'Juices & Drinks', imageUrl: squareImg('photo-1544252890-c3e95e867389') },
  { id: 'ga-15', name: 'Frozen Food & Ice Cream', imageUrl: squareImg('photo-1580915411954-282cb1b0d780') },
  { id: 'ga-16', name: 'Baby Food & Infant Care', imageUrl: squareImg('photo-1595815771614-5fc0e125f409') },
  { id: 'ga-17', name: 'Chocolates & Desserts', imageUrl: squareImg('photo-1549007994-cb92caebd54b') },
  { id: 'ga-18', name: 'Bakery & Bread', imageUrl: squareImg('photo-1509440159596-0249088772ff') },
  { id: 'ga-19', name: 'Dry Fruits & Nuts', imageUrl: squareImg('photo-1604068549290-dea0e4a305ca') },
  { id: 'ga-20', name: 'Seeds & Superfoods', imageUrl: squareImg('photo-1610824352934-c10d87b700cc') },
  { id: 'ga-21', name: 'Cleaning Essentials', imageUrl: squareImg('photo-1585421514284-efb74c2b69ba') },
  { id: 'ga-22', name: 'Paper Products & Disposables', imageUrl: squareImg('photo-1607613009820-a29f7bb81c04') },
  { id: 'ga-23', name: 'Personal Care & Hygiene', imageUrl: squareImg('photo-1556228578-0d85b1a4d571') },
  { id: 'ga-24', name: 'Pet Care Essentials', imageUrl: squareImg('photo-1548199973-03cce0bbc87b') },
  { id: 'ga-25', name: 'Household Essentials', imageUrl: squareImg('photo-1585699324551-f6c309eedeca') },
];
