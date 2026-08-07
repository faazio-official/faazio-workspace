import React from 'react';
import { StyleSheet, View, TouchableOpacity, StatusBar } from 'react-native';
import type { TextInput } from 'react-native';
import { ArrowLeft, Search } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Rect as SvgRect, Circle as SvgCircle } from 'react-native-svg';
import { SCREEN_W, hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';

const SUB_HEADER_NOTCH_INSET = StatusBar.currentHeight ?? 0;
const SUB_HEADER_TOP_GAP = vs(12);
const SUB_HEADER_ROW_H = vs(24);
const SUB_HEADER_ROW_GAP = vs(10);
const SUB_HEADER_SEARCH_H = Math.max(40, vs(40));
const SUB_HEADER_BOTTOM_PAD = vs(12);
export const SUB_HEADER_H =
  SUB_HEADER_NOTCH_INSET + SUB_HEADER_TOP_GAP + SUB_HEADER_ROW_H + SUB_HEADER_ROW_GAP + SUB_HEADER_SEARCH_H + SUB_HEADER_BOTTOM_PAD;

interface SubAppHeaderProps {
  title: string;
  gradient: [string, string];
  textColor: string;
  onBack: () => void;
  searchValue: string;
  onSearchChange: (text: string) => void;
  searchPlaceholder: string;
  rightSlot?: React.ReactNode;
  inputRef?: React.RefObject<TextInput | null>;
}

export default function SubAppHeader({
  title,
  gradient,
  textColor,
  onBack,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  rightSlot,
  inputRef,
}: SubAppHeaderProps) {
  return (
    <View style={styles.headerOuter}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGrad id="subHeaderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={gradient[0]} />
            <Stop offset="100%" stopColor={gradient[1]} />
          </SvgGrad>
        </Defs>
        <SvgRect width="100%" height="100%" fill="url(#subHeaderGrad)" />
        <SvgCircle cx={SCREEN_W * 1.1} cy={vs(-20)} r={ms(96)} fill="rgba(255,255,255,0.05)" />
        <SvgCircle cx={hs(-30)} cy={vs(120)} r={ms(96)} fill="rgba(255,255,255,0.04)" />
      </Svg>
      <View style={styles.headerContent}>
        <View style={styles.headerTopRow}>
          <View style={styles.brandChip}>
            <AppText style={[styles.brandTitle, { color: textColor }]} numberOfLines={1}>
              {title}
            </AppText>
          </View>
          {rightSlot}
        </View>
        <View style={styles.searchRow}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={ms(18)} color={textColor} />
          </TouchableOpacity>
          <View style={styles.searchPill}>
            <Search size={ms(14)} color="#94a3b8" />
            <AppTextInput
              ref={inputRef}
              style={styles.searchInput}
              value={searchValue}
              onChangeText={onSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>
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
    height: SUB_HEADER_H,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  headerContent: {
    paddingTop: SUB_HEADER_NOTCH_INSET + SUB_HEADER_TOP_GAP,
    paddingBottom: SUB_HEADER_BOTTOM_PAD,
    paddingHorizontal: hs(16),
    gap: SUB_HEADER_ROW_GAP,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: SUB_HEADER_ROW_H,
  },
  brandChip: {
    height: SUB_HEADER_ROW_H,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: ms(12),
    paddingHorizontal: hs(12),
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  backBtn: {
    width: ms(40),
    height: SUB_HEADER_SEARCH_H,
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  searchPill: {
    flex: 1,
    height: SUB_HEADER_SEARCH_H,
    borderRadius: ms(22),
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(14),
    gap: hs(8),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: ms(12),
    fontWeight: '600',
    color: '#0f172a',
    padding: 0,
  },
});
