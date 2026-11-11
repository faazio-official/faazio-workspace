import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { FileText } from 'lucide-react-native';
import AppText from '@/components/AppText';
import Checkbox from '@/components/shared/Checkbox';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { neutral, parentRamp } from '@/theme/brandTokens';
import { hs, ms, vs } from '@/utils/responsive';
import type { ContractTier } from '@/services/api/GatewayClient';

export type AgreementKind = 'terms' | 'partner' | 'ip';

/**
 * Short, plain-language summaries shown in-app. The binding full text is published at
 * faazio.com/terms; these screens exist so the applicant understands what they are accepting
 * without scrolling a wall of legal prose.
 */
export const AGREEMENT_COPY: Record<
  AgreementKind,
  { title: string; intro: string; points: string[] }
> = {
  terms: {
    title: 'Terms of Service',
    intro: 'The rules that apply while your shops sell on Faazio.',
    points: [
      'You keep ownership of your business and your products.',
      'Faazio charges the commission on your rate card for each delivered order.',
      'Payouts settle after delivery, net of commission, TCS and TDS.',
      'A shop that breaches food-safety or listing rules can be suspended.',
      'Either side can end the agreement with written notice.',
    ],
  },
  partner: {
    title: 'Seller / Partner Agreement',
    intro: 'What you commit to as a Faazio seller partner.',
    points: [
      'Your business, PAN, GSTIN and licence details are accurate.',
      'Prices, stock and opening hours are kept up to date.',
      'Orders are packed and handed over to the agreed standard.',
      'Faazio may review shops and remove listings that break these rules.',
    ],
  },
  ip: {
    title: 'Content & IP licence',
    intro: 'How Faazio may use your brand and product material.',
    points: [
      'You grant Faazio a royalty-free, worldwide licence to use your brand name, logo, product images and menus.',
      'The licence covers the apps, the website and marketing campaigns.',
      'It lasts while your account is active and ends when the agreement ends.',
      'You confirm you own or control the material you upload.',
    ],
  },
};

/** Compact rate-card summary for the selected tier. Reads only server values. */
export function ContractSummary({ tier }: { tier: ContractTier | null }) {
  if (!tier) {
    return (
      <View style={styles.summary}>
        <AppText style={styles.summaryMuted}>
          Select a contract tier to see your commission and payout terms.
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.summary}>
      <View style={styles.summaryRow}>
        <AppText style={styles.summaryKey}>Commission</AppText>
        <AppText style={styles.summaryValue}>{tier.commissionPct}%</AppText>
      </View>
      <View style={styles.summaryRow}>
        <AppText style={styles.summaryKey}>Payout</AppText>
        <AppText style={styles.summaryValue}>T+{tier.settlementDays} business days</AppText>
      </View>
      <AppText style={styles.summaryTerms}>{tier.settlementTerms}</AppText>
      <AppText style={styles.summaryVersion}>Rate card {tier.rateCardVersion}</AppText>
    </View>
  );
}

/** Checkbox + short label + a "Read" link that opens the summary sheet. */
export function ClickwrapRow({
  label,
  checked,
  onToggle,
  onRead,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  onRead: () => void;
}) {
  return (
    <View style={styles.row}>
      <Checkbox checked={checked} onToggle={onToggle} size={20} />
      <View style={styles.rowBody}>
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <AppText style={styles.rowLabel}>{label}</AppText>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRead} activeOpacity={0.7} accessibilityRole="button">
          <AppText style={styles.readLink}>Read the summary</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Bottom-sheet summary for one agreement. Concise bullets, not long paragraphs. */
export function TermsViewer({
  kind,
  visible,
  onClose,
}: {
  kind: AgreementKind | null;
  visible: boolean;
  onClose: () => void;
}) {
  const copy = kind ? AGREEMENT_COPY[kind] : null;
  return (
    <SlideUpSheet visible={visible} onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetIcon}>
          <FileText size={ms(20)} color={parentRamp.base} strokeWidth={2.2} />
        </View>
        <AppText style={styles.sheetTitle}>{copy?.title ?? ''}</AppText>
        <AppText style={styles.sheetIntro}>{copy?.intro ?? ''}</AppText>
        {(copy?.points ?? []).map((point) => (
          <View key={point} style={styles.point}>
            <View style={styles.dot} />
            <AppText style={styles.pointText}>{point}</AppText>
          </View>
        ))}
        <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
          <AppText style={styles.doneText}>Done</AppText>
        </TouchableOpacity>
      </View>
    </SlideUpSheet>
  );
}

const styles = StyleSheet.create({
  summary: {
    marginTop: vs(10),
    backgroundColor: parentRamp.tint,
    borderRadius: ms(12),
    paddingHorizontal: hs(14),
    paddingVertical: vs(12),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: vs(2),
  },
  summaryKey: { fontSize: ms(12), color: neutral.inkMuted },
  summaryValue: { fontSize: ms(13), fontWeight: '600', color: neutral.ink },
  summaryTerms: {
    marginTop: vs(6),
    fontSize: ms(12),
    lineHeight: ms(18),
    color: neutral.inkMuted,
  },
  summaryVersion: { marginTop: vs(4), fontSize: ms(11), color: neutral.inkSubtle },
  summaryMuted: { fontSize: ms(12), lineHeight: ms(18), color: neutral.inkMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: hs(10),
    marginTop: vs(14),
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: ms(13), lineHeight: ms(19), color: neutral.ink },
  readLink: { marginTop: vs(2), fontSize: ms(12), color: parentRamp.base, fontWeight: '600' },
  sheet: { width: '100%', paddingBottom: vs(8) },
  sheetIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: parentRamp.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(10),
  },
  sheetTitle: { fontSize: ms(20), fontWeight: '600', color: neutral.ink },
  sheetIntro: { marginTop: vs(4), fontSize: ms(13), lineHeight: ms(19), color: neutral.inkMuted },
  point: { flexDirection: 'row', gap: hs(8), marginTop: vs(10) },
  dot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: parentRamp.base,
    marginTop: vs(6),
  },
  pointText: { flex: 1, fontSize: ms(13), lineHeight: ms(20), color: neutral.ink },
  doneBtn: {
    marginTop: vs(20),
    minHeight: Math.max(46, vs(46)),
    borderRadius: ms(10),
    backgroundColor: parentRamp.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { fontSize: ms(14), fontWeight: '600', color: parentRamp.onBase },
});
