export interface Voucher { id: string; brand: string; category: 'Shopping' | 'Fuel' | 'Cinema'; faceValue: number; price: number; discount: number; mark: string; tone: 'primary' | 'success' | 'warning'; description: string }
export const initialWalletBalance = 1257.68;
export const voucherCategories = ['Shopping', 'Fuel', 'Cinema'] as const;
export const vouchers: Voucher[] = [
  { id: 'amazon', brand: 'Amazon', category: 'Shopping', faceValue: 500, price: 475, discount: 5, mark: 'a', tone: 'warning', description: 'Shopping gift voucher · Valid for 12 months. One voucher per redemption.' },
  { id: 'flipkart', brand: 'Flipkart', category: 'Shopping', faceValue: 250, price: 245, discount: 2, mark: 'F', tone: 'primary', description: 'Shopping gift voucher · Valid for 12 months. Cannot be exchanged for cash.' },
  { id: 'bata', brand: 'Bata', category: 'Shopping', faceValue: 1000, price: 900, discount: 10, mark: 'B', tone: 'success', description: 'Footwear gift voucher · Valid for 6 months at participating stores.' },
  { id: 'fuel', brand: 'IndianOil', category: 'Fuel', faceValue: 500, price: 490, discount: 2, mark: 'IO', tone: 'warning', description: 'Fuel voucher · Valid for 3 months at participating outlets.' },
  { id: 'cinema', brand: 'PVR Cinemas', category: 'Cinema', faceValue: 300, price: 270, discount: 10, mark: 'PVR', tone: 'success', description: 'Cinema gift voucher · Valid for 6 months. Booking fees excluded.' },
];
export interface VoucherPurchase { id: string; voucherId: string; brand: string; code: string; price: number }