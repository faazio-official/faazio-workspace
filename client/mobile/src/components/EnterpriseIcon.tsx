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

const iconMap: Record<string, { icon: React.ComponentType<any>; color: string }> = {
  '🛍️': { icon: ShoppingBag, color: '#1162D3' },
  '🍲': { icon: Utensils, color: '#1E5D44' },
  '🍏': { icon: Apple, color: '#10B981' },
  '💊': { icon: BriefcaseMedical, color: '#065F46' },
  '⌨️': { icon: Dumbbell, color: '#2563eb' },
  '👕': { icon: Shirt, color: '#7c3aed' },
  '🚗': { icon: Car, color: '#dc2626' },
  '👶': { icon: Baby, color: '#ec4899' },
  '📚': { icon: Book, color: '#d97706' },
  '🐕': { icon: Dog, color: '#92400e' },
  '💎': { icon: Gem, color: '#0d9488' },
  '🍷': { icon: Wine, color: '#be123c' },
  '🎮': { icon: Gamepad2, color: '#6366f1' },
  '🎧': { icon: Headphones, color: '#0891b2' },
  '📷': { icon: Camera, color: '#4f46e5' },
  '⌚': { icon: Watch, color: '#0f766e' },
  '💡': { icon: Lamp, color: '#d97706' },
  '🌲': { icon: TreePine, color: '#15803d' },
  '✈️': { icon: Plane, color: '#2563eb' },
  '🎨': { icon: Palette, color: '#db2777' },
  '🎵': { icon: Music, color: '#7c3aed' },
  '✨': { icon: Sparkles, color: '#f59e0b' },
  '⭐': { icon: Star, color: '#f59e0b' },
  '⚡': { icon: Zap, color: '#f59e0b' },
  '❤️': { icon: Heart, color: '#e11d48' },
  '🏆': { icon: Award, color: '#d97706' },
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
  const defaultColor = mapped?.color || '#64748b';
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
