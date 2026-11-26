import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import type { SpecialDish } from '@data/types';
import AppText from '@/components/AppText';
import AddToCartControl from '@/components/shared/AddToCartControl';
import { localizedDishDesc, localizedDishName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';
import { hs, ms } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import RemoteImage from './RemoteImage';

interface MenuItemRowProps {
  dish: SpecialDish;
  /** Current quantity of this dish in the active restaurant's cart slice. */
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  /** Open the dish detail page. */
  onPress?: () => void;
}

/**
 * A single menu list row — thumb, name/description/price and either an outlined
 * "Add" button or a − qty + stepper once added. Shared by the restaurant profile
 * and the full Restaurant Menu page so both render identical rows.
 */
const MenuItemRow = memo(function MenuItemRow({
  dish,
  quantity,
  onAdd,
  onIncrement,
  onDecrement,
  onPress,
}: MenuItemRowProps) {
  const language = useLanguageStore((s) => s.language);
  const dishName = localizedDishName(dish, language);
  const dishDesc = localizedDishDesc(dish, language);

  return (
    <View style={styles.listCard}>
      <TouchableOpacity
        style={styles.listDetails}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `${dishName}, ₹${dish.price}. Opens details` : undefined}
      >
        <View style={styles.vegRow}>
          <View style={[styles.vegMark, dish.isVeg ? styles.vegMarkVeg : styles.vegMarkNonVeg]}>
            <View style={[styles.vegDot, dish.isVeg ? styles.vegDotVeg : styles.vegDotNonVeg]} />
          </View>
          <AppText style={styles.listTitle} numberOfLines={2}>{dishName}</AppText>
        </View>
        <AppText numberOfLines={2} style={styles.listDesc}>
          {dishDesc}
        </AppText>
        <View style={styles.listPriceRow}>
          <AppText style={styles.listPrice}>₹{dish.price}</AppText>
          {dish.mrp !== undefined && dish.mrp > dish.price ? (
            <AppText style={styles.listMrp}>₹{dish.mrp}</AppText>
          ) : null}
        </View>
      </TouchableOpacity>
      <View style={styles.listImageWrapper}>
        <RemoteImage uri={dish.image} variant="dish" style={styles.listImage} />
        <AddToCartControl
          quantity={quantity}
          onAdd={onAdd}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          accent={foodTheme.primaryDeep}
          onAccent={foodTheme.white}
          variant="outline"
          label={dishName}
          style={styles.addControl}
        />
      </View>
    </View>
  );
});

export default MenuItemRow;

const styles = StyleSheet.create({
  listCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 24,
  },
  listDetails: { flex: 1, paddingRight: 16 },
  vegRow: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(6), marginBottom: 4 },
  vegMark: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  vegMarkVeg: { borderColor: '#15803D' },
  vegMarkNonVeg: { borderColor: '#B91C1C' },
  vegDot: { width: 6, height: 6, borderRadius: 3 },
  vegDotVeg: { backgroundColor: '#15803D' },
  vegDotNonVeg: { backgroundColor: '#B91C1C' },
  listTitle: { flexShrink: 1, fontSize: ms(16), fontWeight: '600', color: foodTheme.textPrimary, marginBottom: 4 },
  listDesc: { fontSize: ms(13), color: foodTheme.textSecondary, lineHeight: 18, marginBottom: 8 },
  listPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: hs(6) },
  listPrice: { fontSize: ms(15), fontWeight: 'bold', color: foodTheme.textPrimary },
  listMrp: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#999999',
    textDecorationLine: 'line-through',
  },
  listImageWrapper: { alignItems: 'center' },
  listImage: { width: 110, height: 110, borderRadius: 16, backgroundColor: '#F3F4F6' },
  addControl: { marginTop: -14 },
});
