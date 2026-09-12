import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, MapPin, ChevronDown, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import DietToggle from './DietToggle';

interface FoodHeaderProps {
  area?: string;
  onBack?: () => void;
  onAreaPress?: () => void;
}

/**
 * Section 1 — food sub-app home header. Back button (left) + location. Renders
 * below the status bar inset since FoodHome owns its own chrome.
 */
const FoodHeader = memo(function FoodHeader({
  area = 'Anna Nagar, Chennai',
  onBack,
  onAreaPress,
}: FoodHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + vs(8) }]}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={ms(20)} color={foodTheme.textPrimary} strokeWidth={2.4} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.location}
          onPress={onAreaPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Location: ${area}`}
        >
          <MapPin size={ms(22)} color={foodTheme.primary} strokeWidth={2.2} />
          <View style={styles.locationTextWrap}>
            <View style={styles.areaRow}>
              <AppText style={styles.area} numberOfLines={1}>
                {area}
              </AppText>
              <ChevronDown size={ms(16)} color={foodTheme.textPrimary} strokeWidth={2.4} />
            </View>
            <View style={styles.deliveryRow}>
              <AppText style={styles.deliveryText}>Delivering to </AppText>
              <AppText style={styles.deliveryTo}>Home</AppText>
              <ChevronRight size={ms(12)} color={foodTheme.primary} strokeWidth={2.6} />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.dietRow}>
        <DietToggle />
      </View>
    </View>
  );
});

export default FoodHeader;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(10),
    backgroundColor: foodTheme.background,
  },
  row: {
    minHeight: vs(72),
    flexDirection: 'row',
    alignItems: 'center',
  },
  dietRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: vs(4),
  },
  backBtn: {
    width: ms(40),
    height: vs(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: hs(10),
  },
  location: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    minHeight: vs(48),
  },
  locationTextWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: vs(2),
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
  },
  area: {
    fontSize: ms(18),
    fontWeight: '700',
    color: foodTheme.textPrimary,
    flexShrink: 1,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryText: {
    fontSize: ms(12.5),
    fontWeight: '400',
    color: foodTheme.textSecondary,
  },
  deliveryTo: {
    fontSize: ms(12.5),
    fontWeight: '700',
    color: foodTheme.primary,
  },
});
