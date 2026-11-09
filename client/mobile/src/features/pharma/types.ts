export interface PharmaQuickReorderItem {
  id: string;
  name: string;
  stripDetails: string;
  price: number;
  /** List price (MRP) when an approved server discount lowered `price`; absent otherwise. */
  mrp?: number;
}

export interface PharmaTopOffer {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  iconName: 'percent' | 'truck' | 'wallet';
}

export interface PharmaPopularMedicine {
  id: string;
  name: string;
  details: string;
  rating: number;
  price: number;
  /** List price (MRP) when an approved server discount lowered `price`; absent otherwise. */
  mrp?: number;
  imageUrl: string;
}

export interface PharmaHealthEssential {
  id: string;
  title: string;
  imageUrl: string;
}

export interface PharmaFeaturedBrand {
  id: string;
  name: string;
  logoUrl: string;
}

export interface PharmaHealthCornerArticle {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
}