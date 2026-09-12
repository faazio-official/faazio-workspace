import type { AppBrand } from '@data/types';

export interface BrandTokens {
  accent: string;
  accentDark: string;
  accentLight?: string;
  cardBg: string;
  badgeBg: string;
  btnBg: string;
  btnText: string;
  btnAdded: string;
  gradient: [string, string];
  headerGradient: [string, string];
  headerTextColor: string;
  priceColor: string;
  pillBg: string;
}

export const brandTokens: Record<AppBrand, BrandTokens> = {
  FOOD: {
    accent: '#1E5D44',
    accentDark: '#065f46',
    cardBg: '#ecfdf5',
    badgeBg: '#1E5D44',
    btnBg: '#1E5D44',
    btnText: '#ffffff',
    btnAdded: '#059669',
    gradient: ['#1E5D44', '#065f46'],
    headerGradient: ['#C2410C', '#FB923C'],
    headerTextColor: '#ffffff',
    priceColor: '#1E5D44',
    pillBg: '#1E5D4415',
  },
  MART: {
    accent: '#1162D3',
    accentDark: '#1e40af',
    cardBg: '#eff6ff',
    badgeBg: '#1162D3',
    btnBg: '#1162D3',
    btnText: '#ffffff',
    btnAdded: '#059669',
    gradient: ['#1162D3', '#1e40af'],
    headerGradient: ['#CA8A04', '#FACC15'],
    headerTextColor: '#1E1B08',
    priceColor: '#1162D3',
    pillBg: '#1162D315',
  },
  PHARMA: {
    accent: '#065F46',
    accentDark: '#064e3b',
    accentLight: '#FF7A59',
    cardBg: '#FFFBF9',
    badgeBg: '#065F46',
    btnBg: '#FF7A59',
    btnText: '#ffffff',
    btnAdded: '#059669',
    gradient: ['#FFF0E8', '#FFD5C8'],
    headerGradient: ['#0F766E', '#2DD4BF'],
    headerTextColor: '#ffffff',
    priceColor: '#FF7A59',
    pillBg: '#065F4615',
  },
};
