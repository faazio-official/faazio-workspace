import React, { memo, useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import AppText from '@/components/AppText';
import { foodTheme } from '../constants/theme';
import type { DishAddon } from '@/services/api/GatewayClient';

interface AddonPickerSheetProps {
  visible: boolean;
  dishName: string;
  basePrice: number;
  /** Approved + linked add-ons fetched for this dish. */
  addons: DishAddon[];
  onClose: () => void;
  onConfirm: (selected: DishAddon[]) => void;
}

/** Multi-select add-on sheet shown before a dish with extras is added to the cart. */
const AddonPickerSheet = memo(function AddonPickerSheet({
  visible,
  dishName,
  basePrice,
  addons,
  onClose,
  onConfirm,
}: AddonPickerSheetProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Reset the selection whenever the sheet closes so the next dish starts clean.
  React.useEffect(() => {
    if (!visible) setSelectedIds([]);
  }, [visible]);

  const selected = useMemo(
    () => addons.filter((a) => selectedIds.includes(a.id)),
    [addons, selectedIds],
  );
  const addonTotal = selected.reduce((sum, a) => sum + a.price, 0);

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <SlideUpSheet visible={visible} onRequestClose={onClose}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText style={styles.title}>Make it yours</AppText>
          <AppText style={styles.subtitle} numberOfLines={1}>{dishName}</AppText>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close add-ons"
        >
          <X size={ms(22)} color={foodTheme.textSecondary} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {addons.map((addon) => {
        const checked = selectedIds.includes(addon.id);
        return (
          <TouchableOpacity
            key={addon.id}
            onPress={() => toggle(addon.id)}
            style={styles.row}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`${addon.name}, ₹${addon.price}`}
          >
            <View style={[styles.checkbox, checked && styles.checkboxActive]}>
              {checked ? <Check size={ms(14)} color={foodTheme.white} strokeWidth={3} /> : null}
            </View>
            <View style={styles.rowText}>
              <AppText style={styles.rowName}>{addon.name}</AppText>
              {addon.groupName ? <AppText style={styles.rowGroup}>{addon.groupName}</AppText> : null}
            </View>
            <AppText style={styles.rowPrice}>₹{addon.price.toLocaleString('en-IN')}</AppText>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        onPress={() => onConfirm(selected)}
        style={styles.confirmBtn}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Add to cart, ₹${basePrice + addonTotal}`}
      >
        <AppText style={styles.confirmText}>
          {selected.length > 0
            ? `Add to cart · ₹${(basePrice + addonTotal).toLocaleString('en-IN')}`
            : `Add without extras · ₹${basePrice.toLocaleString('en-IN')}`}
        </AppText>
      </TouchableOpacity>
    </SlideUpSheet>
  );
});

export default AddonPickerSheet;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    marginTop: vs(4),
    marginBottom: SPACE.BLOCK,
  },
  headerText: { flex: 1 },
  title: { fontSize: ms(18), fontWeight: '800', color: foodTheme.textPrimary },
  subtitle: { marginTop: vs(2), fontSize: ms(12), color: foodTheme.textSecondary },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: ms(18),
    backgroundColor: foodTheme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: vs(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: foodTheme.divider,
  },
  rowText: { flex: 1, marginLeft: hs(10) },
  rowName: { fontSize: ms(14), fontWeight: '600', color: foodTheme.textPrimary },
  rowGroup: { marginTop: vs(1), fontSize: ms(11), color: foodTheme.textMuted },
  rowPrice: { fontSize: ms(14), fontWeight: '700', color: foodTheme.textPrimary },
  checkbox: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(5),
    borderWidth: 1.5,
    borderColor: foodTheme.dotInactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: foodTheme.ratingGreen,
    borderColor: foodTheme.ratingGreen,
  },
  confirmBtn: {
    marginTop: SPACE.BLOCK,
    borderRadius: ms(12),
    backgroundColor: foodTheme.primary,
    alignItems: 'center',
    paddingVertical: vs(13),
  },
  confirmText: { fontSize: ms(14), fontWeight: '800', color: foodTheme.white },
});
