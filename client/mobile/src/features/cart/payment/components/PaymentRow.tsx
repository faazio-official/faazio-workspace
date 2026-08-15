import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Check, ChevronRight, Plus } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { BRAND } from '../constants';

export type Trailing = 'radio' | 'check' | 'chevron' | 'add';

interface PaymentRowProps {
  icon: LucideIcon | string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  selected?: boolean;
  trailing?: Trailing;
  onPress?: () => void;
  /** Renders the row without a bottom separator (for the last item). */
  last?: boolean;
}

/**
 * Reusable payment list row: icon | title(+subtitle) | trailing indicator.
 * Trailing variants: radio (unselected circle), check (green selected),
 * chevron (More Options), add (orange "+").
 */
export default function PaymentRow({
  icon,
  iconBg = '#F3F4F6',
  title,
  subtitle,
  selected = false,
  trailing = 'radio',
  onPress,
  last = false,
}: PaymentRowProps) {
  const isAdd = trailing === 'add';
  const Icon = typeof icon === 'string' ? null : icon;

  const renderTrailing = () => {
    if (isAdd) {
      return (
        <View style={styles.addChip}>
          <Plus size={ms(14)} color={BRAND.orange} strokeWidth={2.6} />
        </View>
      );
    }
    if (trailing === 'chevron') {
      return <ChevronRight size={ms(18)} color="#9CA3AF" strokeWidth={2.2} />;
    }
    if (trailing === 'check' && selected) {
      return (
        <View style={styles.checkCircle}>
          <Check size={ms(12)} color="#ffffff" strokeWidth={3} />
        </View>
      );
    }
    return <View style={[styles.radioCircle, selected && styles.radioCircleSelected]} />;
  };

  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        {Icon ? <Icon size={ms(18)} color={BRAND.ink} strokeWidth={2} /> : <AppText style={styles.emoji}>{icon as string}</AppText>}
      </View>
      <View style={styles.textWrap}>
        <AppText style={[styles.title, isAdd && { color: BRAND.orange }]} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {renderTrailing()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(13),
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F4',
    borderStyle: 'dashed',
  },
  iconWrap: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(11),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(12),
  },
  emoji: {
    fontSize: ms(16),
  },
  textWrap: {
    flex: 1,
    marginRight: hs(10),
  },
  title: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: ms(11),
    color: '#6B7280',
    marginTop: vs(2),
  },
  radioCircle: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 1.6,
    borderColor: '#D1D5DB',
  },
  radioCircleSelected: {
    borderColor: BRAND.green,
  },
  checkCircle: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    backgroundColor: BRAND.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChip: {
    width: ms(26),
    height: ms(26),
    borderRadius: ms(13),
    backgroundColor: `${BRAND.orange}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
