import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { ms, vs } from '@/utils/responsive';
import SubAppHeaderBackdrop from './SubAppHeaderBackdrop';

const MART_HEADER_TOP_GAP = vs(12);
const MART_HEADER_BTN_H = Math.max(40, vs(40));
const MART_HEADER_BOTTOM_PAD = vs(12);

/** Height of the lean Mart sub-app header (back button only, no searchbar/rail). */
export const martSubAppHeaderH = (topInset: number) =>
  topInset + MART_HEADER_TOP_GAP + MART_HEADER_BTN_H + MART_HEADER_BOTTOM_PAD;

interface MartSubAppHeaderProps {
  gradient: [string, string];
  textColor: string;
  onBack: () => void;
}

/**
 * Lean Mart sub-app header — just the gradient backdrop and a back button.
 * The Mart sub-app has no searchbar or category rail, so this header is
 * intentionally free of search chrome.
 */
export default function MartSubAppHeader({ gradient, textColor, onBack }: MartSubAppHeaderProps) {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  return (
    <View style={[styles.headerOuter, { height: martSubAppHeaderH(topInset) }]}>
      <SubAppHeaderBackdrop gradient={gradient} />
      <View style={[styles.headerContent, { paddingTop: topInset + MART_HEADER_TOP_GAP }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={ms(18)} color={textColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  headerContent: {
    paddingBottom: MART_HEADER_BOTTOM_PAD,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: MART_HEADER_BTN_H,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
});
