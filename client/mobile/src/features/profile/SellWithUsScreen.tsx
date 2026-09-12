import React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Store, BadgeCheck, Lock } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SELLER_SETUP_FIELDS } from '@data/index';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SellWithUs'>;

/**
 * Mock "Sell with us" onboarding page — shows the required details a partner
 * must provide to list products on Faazio. Read-only fixture (no backend yet).
 */
export function SellWithUsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Fixed header — pinned while content scrolls */}
      <View style={[styles.header, { paddingTop: insets.top + vs(8) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Sell with us</AppText>
        <View style={{ width: ms(40) }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >

        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Store size={ms(22)} color="#1162D3" strokeWidth={2.2} />
          </View>
          <AppText style={styles.heroTitle}>Partner with Faazio</AppText>
          <AppText style={styles.heroSub}>
            List your products on Mart, Grocery, Food & Pharma and reach thousands of buyers.
          </AppText>
        </View>

        {/* Required details */}
        <View style={styles.sectionCard}>
          <AppText style={styles.sectionTitle}>Required details</AppText>
          <AppText style={styles.sectionNote}>
            These details are required to open your seller account.
          </AppText>
          {SELLER_SETUP_FIELDS.map((field) => (
            <View key={field.key} style={styles.fieldRow}>
              <AppText style={styles.fieldLabel}>{field.label}</AppText>
              <AppText style={styles.fieldValue}>{field.sample ?? '—'}</AppText>
              {field.hint ? <AppText style={styles.fieldHint}>{field.hint}</AppText> : null}
            </View>
          ))}
        </View>

        {/* Mock action */}
        <TouchableOpacity style={styles.submitBtn} activeOpacity={0.85}>
          <BadgeCheck size={ms(18)} color="#ffffff" strokeWidth={2.2} />
          <AppText style={styles.submitText}>Submit for review (mock)</AppText>
        </TouchableOpacity>

        <View style={styles.secureNote}>
          <Lock size={ms(12)} color="#94A3B8" strokeWidth={2.2} />
          <AppText style={styles.secureNoteText}>
            Demo only — no data is sent. Seller onboarding moves server-side with the Go Chi backend.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: vs(16),
    paddingHorizontal: hs(16),
    paddingBottom: vs(32),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: vs(12),
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backButton: {
    width: ms(40),
    height: ms(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#0f172a',
  },
  heroCard: {
    backgroundColor: '#1162D3',
    borderRadius: ms(20),
    padding: hs(18),
    marginBottom: vs(14),
  },
  heroIcon: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(12),
  },
  heroTitle: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroSub: {
    fontSize: ms(12),
    color: '#DBEAFE',
    lineHeight: ms(18),
    marginTop: vs(6),
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(18),
    padding: hs(16),
    marginBottom: vs(14),
  },
  sectionTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionNote: {
    fontSize: ms(11),
    color: '#94A3B8',
    marginTop: vs(2),
    marginBottom: vs(12),
  },
  fieldRow: {
    paddingVertical: vs(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF1F5',
  },
  fieldLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldValue: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#0f172a',
    marginTop: vs(3),
  },
  fieldHint: {
    fontSize: ms(11),
    color: '#64748B',
    marginTop: vs(2),
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    height: Math.max(50, vs(50)),
    borderRadius: ms(14),
    backgroundColor: '#1162D3',
  },
  submitText: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: vs(14),
    paddingHorizontal: hs(8),
    gap: hs(6),
  },
  secureNoteText: {
    fontSize: ms(10.5),
    color: '#94A3B8',
    lineHeight: ms(15),
    flex: 1,
  },
});
