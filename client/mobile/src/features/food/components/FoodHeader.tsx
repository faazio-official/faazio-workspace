import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, MapPin, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { foodTheme } from '../constants/theme';
import DietToggle from './DietToggle';
import ScheduleToggle from './ScheduleToggle';
import type { SduiHeaderTheme } from '@/services/api/sduiLayout';

interface FoodHeaderProps {
  onBack?: () => void;
  /** Opens the Food search screen (rendered inside the themed SDUI header). */
  onSearch?: () => void;
  /** Location shown in the search bar, e.g. the active district or "All India". */
  locationLabel?: string;
  /** SDUI `header_theme`: tints the native header surface + search bar to match the hero. */
  theme?: SduiHeaderTheme;
}

/**
 * Dedicated Food header — back chevron + centered diet toggle. Renders below
 * the status-bar inset. The toggle is uncontrolled, so it reads/writes the
 * shared `foodFilterStore` like the rest of the Food home.
 *
 * When an SDUI layout is live it also renders the location + search row in the payload's
 * `header_theme` colours, so the top of the screen matches the published banner.
 */
const FoodHeader = memo(function FoodHeader({ onBack, onSearch, locationLabel, theme }: FoodHeaderProps) {
  const insets = useSafeAreaInsets();
  const themed = theme !== undefined;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + vs(8) },
        theme ? { backgroundColor: theme.background_hex } : null,
      ]}
    >
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.iconBtn, themed ? styles.iconBtnThemed : null]}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={ms(20)} color={themed ? '#FFFFFF' : foodTheme.textPrimary} strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.toggleWrap}>
          <View style={styles.toggleRow}>
            <DietToggle />
            <View style={styles.scheduleWrap}>
              <ScheduleToggle />
            </View>
          </View>
        </View>

        <View style={styles.spacer} />
      </View>

      {theme ? (
        <TouchableOpacity
          style={[styles.searchRow, { backgroundColor: theme.search_bar_bg_hex }]}
          onPress={onSearch}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Search restaurants near ${locationLabel ?? 'you'}`}
        >
          <MapPin size={ms(15)} color="#FFFFFF" strokeWidth={2.4} />
          <AppText style={styles.location}>{locationLabel ?? 'Your city'}</AppText>
          <View style={styles.divider} />
          <Search size={ms(15)} color="rgba(255,255,255,0.7)" strokeWidth={2.2} />
          <AppText style={styles.searchPlaceholder} numberOfLines={1}>
            Search restaurants...
          </AppText>
        </TouchableOpacity>
      ) : null}
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
  iconBtn: {
    width: ms(40),
    height: vs(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  toggleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleWrap: {
    marginLeft: hs(6),
  },
  spacer: {
    width: ms(40),
  },
  iconBtnThemed: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(7),
    minHeight: vs(42),
    borderRadius: ms(999),
    paddingHorizontal: hs(14),
    marginBottom: vs(8),
  },
  location: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: ms(13),
  },
  divider: {
    width: 1,
    height: vs(15),
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: hs(2),
  },
  searchPlaceholder: {
    flex: 1,
    color: 'rgba(255,255,255,0.62)',
    fontSize: ms(13),
  },
});
