import React from 'react';
import { View } from 'react-native';
import {
  ShoppingBag, Utensils, Apple, BriefcaseMedical, Dumbbell, Shirt,
  Car, Baby, Book, Dog, Gem, Wine, Gamepad2, Headphones, Camera,
  Watch, Lamp, TreePine, Plane, Palette, Music, Sparkles, Star,
  Zap, Heart, Award,
} from 'lucide-react-native';
import { ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { brandRamp } from '@/theme/brandTokens';
import { categorical } from '@/theme/categorical';

/**
 * Two tiers, deliberately:
 *
 * 1. Category emoji — the three that identify a sub-app. These carry the
 *    sub-app anchor from `brandRamp`, so the icon reads as that brand.
 * 2. Product-category emoji — everything else. These are a categorical palette,
 *    not branding: 23 categories in one hue would be unreadable. They stay
 *    multi-coloured, but the three that used to collide as near-identical
 *    greens (🍏 💎 ⌚) are now separated.
 */
const iconMap: Record<string, { icon: React.ComponentType<any>; color: string }> = {
  // --- Category emoji: sub-app anchors (fill colour, never white text) ---
  '🛍️': { icon: ShoppingBag, color: brandRamp.MART.base },
  '🍲': { icon: Utensils, color: brandRamp.FOOD.base },
  '💊': { icon: BriefcaseMedical, color: brandRamp.PHARMA.base },

  // --- Product-category emoji: categorical palette, not brand ---
  // 🍏 / 💎 / ⌚ used to be three near-identical greens; they are now
  // green / cyan / amber so they read as three different categories.
  '🍏': { icon: Apple, color: categorical.green },
  '⌨️': { icon: Dumbbell, color: categorical.blue },
  '👕': { icon: Shirt, color: categorical.violet },
  '🚗': { icon: Car, color: categorical.red },
  '👶': { icon: Baby, color: categorical.pink },
  '📚': { icon: Book, color: categorical.amber },
  '🐕': { icon: Dog, color: categorical.brown },
  '💎': { icon: Gem, color: categorical.cyan },
  '🍷': { icon: Wine, color: categorical.rose },
  '🎮': { icon: Gamepad2, color: categorical.indigo },
  '🎧': { icon: Headphones, color: categorical.teal },
  '📷': { icon: Camera, color: categorical.purple },
  '⌚': { icon: Watch, color: categorical.amber },
  '💡': { icon: Lamp, color: categorical.orange },
  '🌲': { icon: TreePine, color: categorical.green },
  '✈️': { icon: Plane, color: categorical.blue },
  '🎨': { icon: Palette, color: categorical.pink },
  '🎵': { icon: Music, color: categorical.violet },
  '✨': { icon: Sparkles, color: categorical.orange },
  '⭐': { icon: Star, color: categorical.amber },
  '⚡': { icon: Zap, color: categorical.orange },
  '❤️': { icon: Heart, color: categorical.rose },
  '🏆': { icon: Award, color: categorical.amber },
};

interface EnterpriseIconProps {
  emoji: string;
  size?: number;
  variant?: 'circle' | 'flat' | 'square';
  bgColor?: string;
}

export default function EnterpriseIcon({ emoji, size = 36, variant = 'circle', bgColor }: EnterpriseIconProps) {
  const mapped = iconMap[emoji];
  const Icon = mapped?.icon;
  const defaultColor = mapped?.color || categorical.slate;
  const iconSize = ms(size * 0.5);

  if (variant === 'circle') {
    return (
      <View style={{
        width: ms(size), height: ms(size), borderRadius: ms(size / 2),
        backgroundColor: bgColor || '#f1f5f9',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {Icon ? <Icon size={iconSize} color={defaultColor} /> : <AppText style={{ fontSize: iconSize }}>{emoji}</AppText>}
      </View>
    );
  }

  if (variant === 'square') {
    return (
      <View style={{
        width: ms(size), height: ms(size), borderRadius: ms(8),
        backgroundColor: bgColor || '#f1f5f9',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {Icon ? <Icon size={iconSize} color={defaultColor} /> : <AppText style={{ fontSize: iconSize }}>{emoji}</AppText>}
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {Icon ? <Icon size={iconSize} color={defaultColor} /> : <AppText style={{ fontSize: iconSize }}>{emoji}</AppText>}
    </View>
  );
}
