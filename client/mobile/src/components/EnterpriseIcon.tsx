import React from 'react';
import { View } from 'react-native';
import {
  ShoppingBag, Utensils, Apple, BriefcaseMedical, Dumbbell, Shirt,
  Car, Baby, Book, Dog, Gem, Wine, Gamepad2, Headphones, Camera,
  Watch, Lamp, TreePine, Plane, Palette, Music, Sparkles, Star,
  Zap, Heart, Award, Keyboard, Tag, ShoppingCart, Milk, Croissant,
  Popcorn, Coffee, Pill, Stethoscope, Droplet,
} from 'lucide-react-native';
import { ms } from '@/utils/responsive';
import { brandRamp } from '@/theme/brandTokens';
import { categorical } from '@/theme/categorical';
import { neutral } from '@/theme/brandTokens';

/**
 * Two tiers, deliberately:
 *
 * 1. Sub-app anchors — the three keys that identify a sub-app. These carry the
 *    sub-app anchor from `brandRamp`, so the icon reads as that brand.
 * 2. Product-category keys — everything else. These are a categorical palette,
 *    not branding: 23 categories in one hue would be unreadable. They stay
 *    multi-coloured, and the three that used to collide as near-identical
 *    greens (produce / gems / watches) are now separated.
 *
 * Keys are semantic strings (`mart`, `food`, `dairy`, …), never emoji glyphs.
 * Data that still carries an emoji (the `@data/*` catalogs and server
 * `ProductView`) is normalised through `emojiAlias` so it resolves to the same
 * icon without a glyph appearing in source or UI.
 */
const iconMap = {
  // --- Sub-app anchors (fill colour, never white text) ---
  mart: { icon: ShoppingBag, color: brandRamp.MART.base },
  food: { icon: Utensils, color: brandRamp.FOOD.base },
  pharma: { icon: BriefcaseMedical, color: brandRamp.PHARMA.base },

  // --- Product-category keys: categorical palette, not brand ---
  produce: { icon: Apple, color: categorical.green },
  keyboard: { icon: Keyboard, color: categorical.blue },
  fitness: { icon: Dumbbell, color: categorical.red },
  strength: { icon: Dumbbell, color: categorical.orange },
  apparel: { icon: Shirt, color: categorical.violet },
  auto: { icon: Car, color: categorical.red },
  baby: { icon: Baby, color: categorical.pink },
  books: { icon: Book, color: categorical.amber },
  pets: { icon: Dog, color: categorical.brown },
  gems: { icon: Gem, color: categorical.cyan },
  wine: { icon: Wine, color: categorical.rose },
  gaming: { icon: Gamepad2, color: categorical.indigo },
  audio: { icon: Headphones, color: categorical.teal },
  cameras: { icon: Camera, color: categorical.purple },
  watches: { icon: Watch, color: categorical.amber },
  lighting: { icon: Lamp, color: categorical.orange },
  plants: { icon: TreePine, color: categorical.green },
  travel: { icon: Plane, color: categorical.blue },
  art: { icon: Palette, color: categorical.pink },
  music: { icon: Music, color: categorical.violet },
  sparkle: { icon: Sparkles, color: categorical.orange },
  star: { icon: Star, color: categorical.amber },
  energy: { icon: Zap, color: categorical.orange },
  love: { icon: Heart, color: categorical.rose },
  award: { icon: Award, color: categorical.amber },

  // --- Food / cart / grocery keys ---
  dining: { icon: Utensils, color: brandRamp.FOOD.base },
  cart: { icon: ShoppingCart, color: brandRamp.MART.base },
  dairy: { icon: Milk, color: categorical.blue },
  bakery: { icon: Croissant, color: categorical.amber },
  snack: { icon: Popcorn, color: categorical.orange },
  beverage: { icon: Coffee, color: categorical.brown },
  medicine: { icon: Pill, color: brandRamp.PHARMA.base },
  health: { icon: Stethoscope, color: brandRamp.PHARMA.base },
  water: { icon: Droplet, color: categorical.blue },
} as const;

export type EnterpriseIconKey = keyof typeof iconMap;

/**
 * Legacy emoji → key bridge. Written with unicode escapes on purpose: the icon
 * layer must never contain an emoji glyph, but the data layer still ships
 * emoji fields (`@data/*`, server products) that have to keep resolving.
 */
const emojiAlias: Record<string, EnterpriseIconKey> = {
  '\u{1F6CD}': 'mart',
  '\u{1F372}': 'food',
  '\u{1F48A}': 'medicine',
  '\u{1F34F}': 'produce',
  '\u{2328}': 'keyboard',
  '\u{1F3CB}': 'fitness',
  '\u{1F4AA}': 'strength',
  '\u{1F455}': 'apparel',
  '\u{1F697}': 'auto',
  '\u{1F476}': 'baby',
  '\u{1F4DA}': 'books',
  '\u{1F415}': 'pets',
  '\u{1F48E}': 'gems',
  '\u{1F377}': 'wine',
  '\u{1F3AE}': 'gaming',
  '\u{1F3A7}': 'audio',
  '\u{1F4F7}': 'cameras',
  '\u{231A}': 'watches',
  '\u{1F4A1}': 'lighting',
  '\u{1F332}': 'plants',
  '\u{2708}': 'travel',
  '\u{1F3A8}': 'art',
  '\u{1F3B5}': 'music',
  '\u{2728}': 'sparkle',
  '\u{2B50}': 'star',
  '\u{26A1}': 'energy',
  '\u{2764}': 'love',
  '\u{1F3C6}': 'award',
  '\u{1F37D}': 'dining',
  '\u{1F6D2}': 'cart',
  '\u{1F95B}': 'dairy',
  '\u{1F35E}': 'bakery',
  '\u{1F37F}': 'snack',
  '\u{2615}': 'beverage',
  '\u{1FA7A}': 'health',
  '\u{1F4A7}': 'water',
};

function normalizeEmoji(value: string): string {
  return value.replace(/[\uFE0F\u200D]/g, '');
}

function resolveKey(iconKey?: string, emoji?: string): EnterpriseIconKey | undefined {
  if (iconKey && iconKey in iconMap) return iconKey as EnterpriseIconKey;
  if (!emoji) return undefined;
  if (emoji in iconMap) return emoji as EnterpriseIconKey;
  return emojiAlias[normalizeEmoji(emoji)];
}

interface EnterpriseIconProps {
  emoji?: string;
  iconKey?: EnterpriseIconKey;
  size?: number;
  variant?: 'circle' | 'flat' | 'square';
  bgColor?: string;
}

export default function EnterpriseIcon({
  emoji,
  iconKey,
  size = 36,
  variant = 'circle',
  bgColor,
}: EnterpriseIconProps) {
  const key = resolveKey(iconKey, emoji);
  const mapped = key ? iconMap[key] : undefined;
  // Never render a raw emoji: an unmapped key falls back to a neutral tag icon.
  const Icon = mapped?.icon ?? Tag;
  const defaultColor = mapped?.color || categorical.slate;
  const iconSize = ms(size * 0.5);

  if (variant === 'circle') {
    return (
      <View style={{
        width: ms(size), height: ms(size), borderRadius: ms(size / 2),
        backgroundColor: bgColor || neutral.surfaceAlt,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={iconSize} color={defaultColor} />
      </View>
    );
  }

  if (variant === 'square') {
    return (
      <View style={{
        width: ms(size), height: ms(size), borderRadius: ms(8),
        backgroundColor: bgColor || neutral.surfaceAlt,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={iconSize} color={defaultColor} />
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={iconSize} color={defaultColor} />
    </View>
  );
}
