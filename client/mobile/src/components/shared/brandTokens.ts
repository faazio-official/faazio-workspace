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
    priceColor: '#1162D3',
    pillBg: '#1162D315',
  },
  GROCERY: {
    accent: '#10B981',
    accentDark: '#059669',
    cardBg: '#f0fdf4',
    badgeBg: '#10B981',
    btnBg: '#10B981',
    btnText: '#ffffff',
    btnAdded: '#059669',
    gradient: ['#10B981', '#059669'],
    priceColor: '#10B981',
    pillBg: '#10B98115',
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
    priceColor: '#FF7A59',
    pillBg: '#065F4615',
  },
};
