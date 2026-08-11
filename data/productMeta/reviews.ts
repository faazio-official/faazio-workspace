/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { Review, SpecItem, AppBrand } from '../types';

export const avatarMap: Record<string, string> = {
  'Aarav Sharma': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Priya Patel': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Rahul Verma': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Ananya Gupta': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Vikram Singh': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Neha Kapoor': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Ravi Desai': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Meera Nair': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Arjun Mehta': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?fm=jpg&fit=crop&q=80&w=56&h=56',
  'Dr. Sarah Alvi': 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?fm=jpg&fit=crop&q=80&w=56&h=56',
};

export const getProductReviews = (app: AppBrand): Review[] => {
  const food: Review[] = [
    { id: 'rev-1', user: 'Aarav Sharma', avatar: avatarMap['Aarav Sharma'], rating: 5, comment: 'Absolutely delicious! The portion size was generous and delivery was impressively quick.', date: '2 weeks ago' },
    { id: 'rev-2', user: 'Priya Patel', avatar: avatarMap['Priya Patel'], rating: 5, comment: 'Authentic flavours. Reminds me of home-cooked food. Will definitely order again.', date: '1 month ago' },
    { id: 'rev-3', user: 'Rahul Verma', avatar: avatarMap['Rahul Verma'], rating: 4, comment: 'Good food but packaging could be better. Sauce leaked a bit during delivery.', date: '3 weeks ago' },
  ];

  const mart: Review[] = [
    { id: 'rev-m1', user: 'Ananya Gupta', avatar: avatarMap['Ananya Gupta'], rating: 5, comment: 'Amazing quality! The product exceeded my expectations. Fast shipping too.', date: '1 week ago' },
    { id: 'rev-m2', user: 'Vikram Singh', avatar: avatarMap['Vikram Singh'], rating: 5, comment: 'Perfect fit and great material. Exactly as described in the listing.', date: '2 weeks ago' },
    { id: 'rev-m3', user: 'Neha Kapoor', avatar: avatarMap['Neha Kapoor'], rating: 4, comment: 'Nice product but took longer than expected for delivery. Good value for money though.', date: '3 weeks ago' },
  ];

  const grocery: Review[] = [
    { id: 'rev-g1', user: 'Ravi Desai', avatar: avatarMap['Ravi Desai'], rating: 5, comment: 'Freshest produce I have ever ordered online. The apples were incredibly crisp.', date: '4 days ago' },
    { id: 'rev-g2', user: 'Meera Nair', avatar: avatarMap['Meera Nair'], rating: 4, comment: 'Good quality but one item was missing. Customer service refunded promptly.', date: '1 week ago' },
    { id: 'rev-g3', user: 'Arjun Mehta', avatar: avatarMap['Arjun Mehta'], rating: 5, comment: 'The organic vegetables are amazing. Regular weekly order now!', date: '2 weeks ago' },
  ];

  const pharma: Review[] = [
    { id: 'rev-p1', user: 'Dr. Sarah Alvi', avatar: avatarMap['Dr. Sarah Alvi'], rating: 5, comment: 'Genuine pharmaceutical products with proper packaging and expiry dates.', date: '1 week ago' },
    { id: 'rev-p2', user: 'Rahul Verma', avatar: avatarMap['Rahul Verma'], rating: 5, comment: 'Fast delivery of my prescription medicines. Very reliable service.', date: '2 weeks ago' },
    { id: 'rev-p3', user: 'Priya Patel', avatar: avatarMap['Priya Patel'], rating: 4, comment: 'Good service but wish they had more stock of certain medicines.', date: '3 weeks ago' },
  ];

  switch (app) {
    case 'FOOD': return food;
    case 'MART': return mart;
    case 'GROCERY': return grocery;
    case 'PHARMA': return pharma;
    default: return food;
  }
};

export const getProductSpecs = (app: AppBrand): SpecItem[] => {
  const specs: Record<AppBrand, SpecItem[]> = {
    FOOD: [
      { label: 'Cuisine', value: 'Asian Fusion' },
      { label: 'Prep Time', value: '15-20 mins' },
      { label: 'Spice Level', value: 'Medium' },
      { label: 'Contains', value: 'Dairy, Gluten' },
    ],
    MART: [
      { label: 'Brand', value: 'Faazio Premium' },
      { label: 'Material', value: 'Premium Quality' },
      { label: 'Warranty', value: '1 Year' },
      { label: 'Country', value: 'Made in India' },
    ],
    GROCERY: [
      { label: 'Shelf Life', value: '5-7 Days' },
      { label: 'Storage', value: 'Refrigerate' },
      { label: 'Origin', value: 'Organic Farm' },
      { label: 'Pesticide Free', value: 'Certified' },
    ],
    PHARMA: [
      { label: 'Manufacturer', value: 'Faazio Healthcare' },
      { label: 'GMP Certified', value: 'Yes' },
      { label: 'Storage', value: 'Cool & Dry Place' },
      { label: 'Expiry', value: '24 Months' },
    ],
  };
  return specs[app] || specs.FOOD;
};

export const getProductHighlights = (app: AppBrand): string[] => {
  const h: Record<AppBrand, string[]> = {
    FOOD: ['🔥 Chef\'s Special Recipe', '🥬 Fresh Ingredients Sourced Daily', '🚀 Free Delivery on ₹499+', '♻️ Eco-Friendly Packaging'],
    MART: ['✅ 100% Authentic Products', '🔄 Easy 7-Day Returns', '🎁 Free Gift Wrapping', '📦 Secure Packaging'],
    GROCERY: ['🌱 Farm Fresh Daily', '🚜 Direct from Local Farmers', '❄️ Cold Chain Maintained', '🧪 Pesticide-Free'],
    PHARMA: ['💊 Genuine & Verified', '📋 Prescription Upload Available', '🚚 Discreet Packaging', '🔒 Temperature Controlled'],
  };
  return h[app] || h.FOOD;
};
