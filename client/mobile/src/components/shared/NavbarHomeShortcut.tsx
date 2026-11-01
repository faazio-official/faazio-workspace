import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Home } from 'lucide-react-native';
import { ms } from '@/utils/responsive';
import { parentRamp } from '@/theme/brandTokens';

const FAAZIO_BLUE = parentRamp.base;

interface NavbarHomeShortcutProps {
  centerX: number;
  barHeight: number;
  size?: number;
  onPress: () => void;
}

/** Floating Home affordance shared by every bottom navigation variant. */
const NavbarHomeShortcut = memo(function NavbarHomeShortcut({
  centerX,
  barHeight,
  size = ms(48),
  onPress,
}: NavbarHomeShortcutProps) {
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          left: centerX - size / 2,
          bottom: barHeight - size * 0.25,
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
        onPress={onPress}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Go to Faazio Home"
      >
        <Home size={ms(22)} color="#FFFFFF" strokeWidth={2.6} />
      </TouchableOpacity>
    </View>
  );
});

export default NavbarHomeShortcut;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 50,
    elevation: 24,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FAAZIO_BLUE,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 24,
  },
});
