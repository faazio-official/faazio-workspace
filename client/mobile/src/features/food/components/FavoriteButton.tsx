import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated';
import { useFavoriteStore } from '@/state/favoriteStore';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

interface FavoriteButtonProps {
  id: string;
  size?: number;
  iconSize?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const FavoriteButton = memo(function FavoriteButton({
  id,
  size = ms(36),
  iconSize = ms(17),
  onPress,
  accessibilityLabel = 'Toggle favourite',
}: FavoriteButtonProps) {
  const isFavorite = useFavoriteStore((state) => state.favorites.includes(id));
  const toggleFavorite = useFavoriteStore((state) => state.toggleFavorite);
  const pressAnim = useSharedValue(0);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pressAnim.value * 0.18 }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pressAnim.value * 0.24 }],
  }));

  const handlePress = () => {
    pressAnim.value = withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 140 }));
    toggleFavorite(id);
    onPress?.();
  };

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }, wrapStyle]}>
      <TouchableOpacity
        onPress={handlePress}
        style={styles.touch}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: isFavorite }}
      >
        <Animated.View style={heartStyle}>
          <Heart
            size={iconSize}
            color={isFavorite ? foodTheme.danger : '#6B7280'}
            fill={isFavorite ? foodTheme.danger : 'transparent'}
            strokeWidth={2.4}
          />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default FavoriteButton;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  touch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
