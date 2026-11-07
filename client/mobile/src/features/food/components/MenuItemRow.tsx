import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import type { SpecialDish } from '@data/types';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
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
  const isAdded = quantity > 0;

  return (
    <View style={styles.listCard}>
      <TouchableOpacity
        style={styles.listDetails}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `${dish.dishName}, ₹${dish.price}. Opens details` : undefined}
      >
        <View style={styles.vegRow}>
          <View style={[styles.vegMark, dish.isVeg ? styles.vegMarkVeg : styles.vegMarkNonVeg]}>
            <View style={[styles.vegDot, dish.isVeg ? styles.vegDotVeg : styles.vegDotNonVeg]} />
          </View>
          <AppText style={styles.listTitle} numberOfLines={2}>{dish.dishName}</AppText>
        </View>
        <AppText numberOfLines={2} style={styles.listDesc}>
          {dish.description}
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
        {isAdded ? (
          <View style={styles.qtyStepper}>
            <TouchableOpacity
              style={styles.qtyStepperBtn}
              onPress={onDecrement}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Decrease quantity of ${dish.dishName}`}
            >
              <Minus color={foodTheme.primary} size={ms(14)} />
            </TouchableOpacity>
            <AppText style={styles.qtyStepperValue}>{quantity}</AppText>
            <TouchableOpacity
              style={styles.qtyStepperBtn}
              onPress={onIncrement}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Increase quantity of ${dish.dishName}`}
            >
              <Plus color={foodTheme.primary} size={ms(14)} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addBtnOutline}
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={`Add ${dish.dishName}`}
          >
            <Plus color={foodTheme.primary} size={ms(14)} style={styles.addBtnPlus} />
            <AppText style={styles.addBtnOutlineText}>Add</AppText>
          </TouchableOpacity>
        )}
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
  addBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: foodTheme.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: -14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnPlus: { marginRight: 2 },
  addBtnOutlineText: { color: foodTheme.primaryDeep, fontWeight: 'bold', fontSize: 14 },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: foodTheme.primary,
    borderRadius: 8,
    marginTop: -14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qtyStepperBtn: {
    paddingHorizontal: hs(12),
    paddingVertical: vs(6),
  },
  qtyStepperValue: {
    minWidth: ms(24),
    textAlign: 'center',
    color: foodTheme.primaryDeep,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
