import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, ChevronLeft, Lock, Store } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { SELLER_SETUP_FIELDS } from '@data/index';
import type { AppBrand } from '@data/types';
import { gateway, type SellerApplication } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SellWithUs'>;

const CATEGORIES: { value: AppBrand; label: string }[] = [
  { value: 'MART', label: 'Mart' },
  { value: 'FOOD', label: 'Food' },
  { value: 'PHARMA', label: 'Pharma' },
];

/** Label/placeholder sourced from the stable @data contract (keeps the fixture meaningful). */
const setup = (key: string) => SELLER_SETUP_FIELDS.find((f) => f.key === key);

interface FormState {
  businessName: string;
  ownerName: string;
  gstin: string;
  pan: string;
  businessAddress: string;
  contactPhone: string;
  stateCode: string;
}

/**
 * "Sell with us" partner onboarding. Collects the minimum seller-account details and submits a
 * PENDING_REVIEW application via `GatewayClient.submitSellerApplication` (sellers.sellers).
 * KYC documents + the payout bank account are added after the account is created.
 */
export function SellWithUsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState<FormState>({
    businessName: '',
    ownerName: user?.name ?? '',
    gstin: '',
    pan: '',
    businessAddress: '',
    contactPhone: user?.phone ?? '',
    stateCode: '',
  });
  const [category, setCategory] = useState<AppBrand>('MART');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SellerApplication | null>(null);

  const update = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (!form.businessName.trim() || !form.ownerName.trim()) {
      setError('Business and owner name are required.');
      return;
    }
    if (form.stateCode.trim().length !== 2) {
      setError('Enter a 2-letter state code (e.g. MH).');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await gateway.submitSellerApplication({
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        category,
        gstin: form.gstin.trim() || undefined,
        pan: form.pan.trim().toUpperCase() || undefined,
        businessAddress: form.businessAddress.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        stateCode: form.stateCode.trim().toUpperCase(),
      });
      setResult(res);
    } catch {
      setError('Could not submit right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
        keyboardShouldPersistTaps="handled"
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

        {result ? (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <BadgeCheck size={ms(26)} color="#16A34A" strokeWidth={2.2} />
            </View>
            <AppText style={styles.successTitle}>Application submitted</AppText>
            <AppText style={styles.successBody}>
              We received your details and your account is now in review.
            </AppText>
            <View style={styles.successRow}>
              <AppText style={styles.successKey}>Application ID</AppText>
              <AppText style={styles.successValue}>{result.sellerId}</AppText>
            </View>
            <View style={styles.successRow}>
              <AppText style={styles.successKey}>Status</AppText>
              <AppText style={styles.successValue}>Pending review</AppText>
            </View>
            <AppText style={styles.successNote}>
              KYC documents and bank details are collected once your account is approved.
            </AppText>
            <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.goBack()} activeOpacity={0.9}>
              <AppText style={styles.submitText}>Done</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Application form */}
            <View style={styles.sectionCard}>
              <AppText style={styles.sectionTitle}>Business details</AppText>
              <AppText style={styles.sectionNote}>
                These details are required to open your seller account.
              </AppText>

              <AppText style={styles.inputLabel}>Category</AppText>
              <View style={styles.chipRow}>
                {CATEGORIES.map((c) => {
                  const active = category === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCategory(c.value)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <AppText style={[styles.chipText, active && styles.chipTextActive]}>
                        {c.label}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInputField
                label={setup('businessName')?.label ?? 'Business name'}
                placeholder={setup('businessName')?.placeholder ?? 'e.g. Sharma Traders'}
                value={form.businessName}
                onChangeText={update('businessName')}
              />
              <TextInputField
                label={setup('ownerName')?.label ?? 'Owner / contact name'}
                placeholder={setup('ownerName')?.placeholder ?? 'Full name'}
                value={form.ownerName}
                onChangeText={update('ownerName')}
              />
              <TextInputField
                label={setup('gstin')?.label ?? 'GSTIN'}
                placeholder={setup('gstin')?.placeholder ?? '22ABCDE1234F1Z5'}
                value={form.gstin}
                onChangeText={update('gstin')}
                autoCapitalize="characters"
              />
              <TextInputField
                label="PAN"
                placeholder="ABCDE1234F"
                value={form.pan}
                onChangeText={update('pan')}
                autoCapitalize="characters"
              />
              <TextInputField
                label={setup('businessAddress')?.label ?? 'Business address'}
                placeholder={setup('businessAddress')?.placeholder ?? 'Full address'}
                value={form.businessAddress}
                onChangeText={update('businessAddress')}
              />
              <TextInputField
                label={setup('contactPhone')?.label ?? 'Contact phone'}
                placeholder={setup('contactPhone')?.placeholder ?? '+91 00000 00000'}
                value={form.contactPhone}
                onChangeText={update('contactPhone')}
                keyboardType="phone-pad"
              />
              <TextInputField
                label="State code"
                placeholder="e.g. MH"
                value={form.stateCode}
                onChangeText={update('stateCode')}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>

            {error ? <AppText style={styles.errorText}>{error}</AppText> : null}

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              activeOpacity={0.85}
              onPress={submit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <BadgeCheck size={ms(18)} color="#ffffff" strokeWidth={2.2} />
                  <AppText style={styles.submitText}>Submit for review</AppText>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.secureNote}>
              <Lock size={ms(12)} color="#94A3B8" strokeWidth={2.2} />
              <AppText style={styles.secureNoteText}>
                Your details are sent over an authenticated connection. KYC and bank verification
                follow once your account is created.
              </AppText>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface TextInputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'phone-pad';
  maxLength?: number;
}

function TextInputField({
  label,
  placeholder,
  value,
  onChangeText,
  autoCapitalize,
  keyboardType,
  maxLength,
}: TextInputFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <AppText style={styles.inputLabel}>{label}</AppText>
      <AppTextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  );
}

export default SellWithUsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACE.SECTION,
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.BLOCK,
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
    marginBottom: SPACE.SECTION,
  },
  heroIcon: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
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
    marginBottom: SPACE.SECTION,
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
    marginBottom: SPACE.BLOCK,
  },
  fieldWrap: {
    marginTop: vs(12),
  },
  inputLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: vs(6),
  },
  input: {
    height: Math.max(46, vs(46)),
    backgroundColor: '#F8FAFC',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: hs(12),
    fontSize: ms(14),
    fontWeight: '600',
    color: '#0f172a',
  },
  chipRow: {
    flexDirection: 'row',
    gap: hs(8),
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(10),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  chipActive: {
    borderColor: '#1162D3',
    backgroundColor: '#EFF6FF',
  },
  chipText: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#64748B',
  },
  chipTextActive: {
    color: '#1162D3',
  },
  errorText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: vs(10),
    textAlign: 'center',
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
  submitBtnDisabled: {
    opacity: 0.7,
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
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(18),
    padding: hs(18),
    alignItems: 'center',
  },
  successIcon: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  successTitle: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#0f172a',
  },
  successBody: {
    fontSize: ms(12),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: ms(18),
    marginTop: vs(6),
    marginBottom: SPACE.SECTION,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: vs(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF1F5',
  },
  successKey: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#94A3B8',
  },
  successValue: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#0f172a',
  },
  successNote: {
    fontSize: ms(10.5),
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: ms(15),
    marginTop: SPACE.BLOCK,
    marginBottom: SPACE.SECTION,
  },
});