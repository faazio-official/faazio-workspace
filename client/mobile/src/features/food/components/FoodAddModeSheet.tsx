import React, { memo, useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { UtensilsCrossed, Bike, ShoppingBag, ChevronRight, ArrowLeft, X } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import AppText from '@/components/AppText';

export type FoodAddMode = 'dining' | 'delivery' | 'pickup';

interface FoodAddModeSheetProps {
  visible: boolean;
  /** Name of the dish being added, shown as a subtitle under the title. */
  itemName?: string;
  onConfirm: (mode: FoodAddMode) => void;
  onClose: () => void;
}

type Step = 'choice' | 'fulfilment';

/**
 * Food fulfilment chooser shown before an item's first add-to-cart. Step 1 asks
 * "Dining in or Food order?"; choosing "Food order" advances to step 2
 * ("Delivery or Self pickup?"). "Dining" confirms immediately. Not persisted —
 * the chosen mode only gates the add; the cart store stays untouched.
 */
const FoodAddModeSheet = memo(function FoodAddModeSheet({
  visible,
  itemName,
  onConfirm,
  onClose,
}: FoodAddModeSheetProps) {
  const [step, setStep] = useState<Step>('choice');

  useEffect(() => {
    if (visible) setStep('choice');
  }, [visible]);

  const handleChoice = (mode: FoodAddMode) => {
    onConfirm(mode);
  };

  const title = step === 'choice' ? 'How would you like to enjoy this?' : 'Food order — how should it reach you?';

  return (
    <SlideUpSheet visible={visible} onRequestClose={onClose}>
      <View style={styles.header}>
        {step === 'fulfilment' ? (
          <TouchableOpacity
            onPress={() => setStep('choice')}
            style={styles.backBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={ms(20)} color={foodTheme.textPrimary} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnSpacer} />
        )}
        <AppText style={styles.title}>{title}</AppText>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={ms(20)} color="#6B7280" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {step === 'choice' && itemName ? (
        <AppText style={styles.subtitle} numberOfLines={1}>
          {itemName}
        </AppText>
      ) : null}

      <View style={styles.options}>
        {step === 'choice' ? (
          <>
            <OptionRow
              icon={<UtensilsCrossed size={ms(20)} color={foodTheme.primary} strokeWidth={2} />}
              label="Dining"
              hint="Reserve a table & enjoy in-house"
              onPress={() => handleChoice('dining')}
            />
            <OptionRow
              icon={<Bike size={ms(20)} color={foodTheme.primary} strokeWidth={2} />}
              label="Food order"
              hint="Get it delivered or pick it up"
              onPress={() => setStep('fulfilment')}
              chevron
            />
          </>
        ) : (
          <>
            <OptionRow
              icon={<Bike size={ms(20)} color={foodTheme.primary} strokeWidth={2} />}
              label="Delivery"
              hint="We bring it to your doorstep"
              onPress={() => onConfirm('delivery')}
            />
            <OptionRow
              icon={<ShoppingBag size={ms(20)} color={foodTheme.primary} strokeWidth={2} />}
              label="Self pickup"
              hint="Collect it from the restaurant"
              onPress={() => onConfirm('pickup')}
            />
          </>
        )}
      </View>
    </SlideUpSheet>
  );
});

function OptionRow({
  icon,
  label,
  hint,
  onPress,
  chevron,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onPress: () => void;
  chevron?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.optionRow}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.optionIcon}>{icon}</View>
      <View style={styles.optionTextWrap}>
        <AppText style={styles.optionLabel}>{label}</AppText>
        <AppText style={styles.optionHint}>{hint}</AppText>
      </View>
      {chevron ? <ChevronRight size={ms(18)} color="#9CA3AF" strokeWidth={2.2} /> : null}
    </TouchableOpacity>
  );
}

export default FoodAddModeSheet;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: vs(6),
    marginBottom: vs(8),
  },
  backBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnSpacer: {
    width: ms(36),
  },
  title: {
    flex: 1,
    fontSize: ms(16),
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    paddingHorizontal: hs(8),
  },
  closeBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: ms(12),
    color: foodTheme.textSecondary,
    textAlign: 'center',
    marginBottom: vs(12),
    paddingHorizontal: hs(12),
  },
  options: {
    alignSelf: 'stretch',
    borderRadius: ms(14),
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
    marginTop: vs(4),
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(14),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF1F5',
  },
  optionIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: foodTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#111827',
  },
  optionHint: {
    fontSize: ms(11),
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: vs(1),
  },
});
