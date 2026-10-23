import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { BRAND } from '../constants';
import type { UpiAppPackage } from '../paymentData';

interface UpiAppRowProps {
  app: UpiAppPackage;
  selected: boolean;
  onPress: () => void;
  /** Renders the row without a bottom separator. */
  last?: boolean;
}

/** One detected UPI app as a selectable row: monogram icon + label + radio/check. */
export default function UpiAppRow({ app, selected, onPress, last = false }: UpiAppRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
        <AppText style={styles.monogram}>{app.label.charAt(0).toUpperCase()}</AppText>
      </View>
      <AppText style={styles.label} numberOfLines={1}>
        {app.label}
      </AppText>
      {selected ? (
        <View style={styles.checkCircle}>
          <Check size={ms(12)} color="#ffffff" strokeWidth={3} />
        </View>
      ) : (
        <View style={styles.radioCircle} />
      )}
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
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(12),
  },
  iconWrapSelected: {
    backgroundColor: BRAND.green + '1A',
  },
  monogram: {
    fontSize: ms(15),
    fontWeight: '900',
    color: '#4338CA',
  },
  label: {
    flex: 1,
    fontSize: ms(14),
    fontWeight: '700',
    color: '#1F2937',
    marginRight: hs(10),
  },
  radioCircle: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 1.6,
    borderColor: '#D1D5DB',
  },
  checkCircle: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    backgroundColor: BRAND.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
});