import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../../constants/theme';

interface OrderHeaderProps {
  area?: string;
  onAreaPress?: () => void;
}

/**
 * Section 1 — order feed header. Location column (orange pin + area + chevron,
 * "Delivering to Home" + chevron).
 */
const OrderHeader = memo(function OrderHeader({
  area = 'Anna Nagar, Chennai',
  onAreaPress,
}: OrderHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: insets.top + vs(8) }]}>
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
            <ChevronDown size={ms(15)} color="#1E2022" strokeWidth={2.4} />
          </View>
          <View style={styles.deliveryRow}>
            <AppText style={styles.deliveryText}>Delivering to </AppText>
            <AppText style={styles.deliveryTo}>Home</AppText>
            <ChevronDown size={ms(11)} color={foodTheme.primary} strokeWidth={2.6} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});

export default OrderHeader;

const styles = StyleSheet.create({
  row: {
    minHeight: vs(72),
    paddingHorizontal: hs(16),
    paddingBottom: vs(10),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    color: '#1E2022',
    flexShrink: 1,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(1),
  },
  deliveryText: {
    fontSize: ms(12.5),
    fontWeight: '400',
    color: '#666666',
  },
  deliveryTo: {
    fontSize: ms(12.5),
    fontWeight: '700',
    color: foodTheme.primary,
  },
});
