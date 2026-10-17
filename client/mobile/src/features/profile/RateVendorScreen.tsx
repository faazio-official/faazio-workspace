import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { StarRatingInput } from '@/components/shared';
import { getVendorById } from '@data/index';
import { MAX_VENDOR_RATING_COMMENT } from '@/state/vendorRatingStore';
import { submitVendorRating } from '@/services/vendorRatings';
import { useCanRateVendor, useUserVendorRating } from '@/hooks/useVendorRating';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RateVendor'>;

const ROYAL_GREEN = '#16A34A';

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

/**
 * Verify-and-rate form for a vendor. Eligibility is re-checked here (single
 * owner: `services/vendorRatings`), so the screen is safe to deep-link into.
 * One live rating per (user, vendor) — resubmitting updates it. Nothing rating-
 * related is logged; public display uses full name only.
 */
export function RateVendorScreen({ navigation, route }: Props) {
  const { vendorId, vendorName } = route.params;
  const insets = useSafeAreaInsets();

  const vendor = getVendorById(vendorId);
  const displayName = vendorName ?? vendor?.name ?? 'This vendor';

  const canRate = useCanRateVendor(vendorId);
  const existing = useUserVendorRating(vendorId);

  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleSubmit = useCallback(async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    setError('');
    const result = await submitVendorRating(vendorId, rating, comment);
    setSubmitting(false);
    if (result.ok) {
      navigation.goBack();
      return;
    }
    setError(
      result.status === 'not-verified'
        ? "We couldn't confirm a purchase from this store. Your rating is saved on this device."
        : result.status === 'signed-out'
          ? 'Your session has expired. Please sign in again to sync your rating.'
          : 'Please choose a rating between 1 and 5.',
    );
  }, [rating, comment, vendorId, navigation, submitting]);

  const submitDisabled = rating < 1 || submitting;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Rate Vendor</AppText>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!canRate ? (
          <View style={styles.blockedCard}>
            <AppText style={styles.blockedTitle}>Verified buyers only</AppText>
            <AppText style={styles.blockedText}>
              You can rate {displayName} after an order from them that wasn't cancelled.
            </AppText>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <AppText style={styles.vendorName}>{displayName}</AppText>
              <View style={styles.verifiedRow}>
                <ShieldCheck size={ms(14)} color={ROYAL_GREEN} strokeWidth={2.3} />
                <AppText style={styles.verifiedText}>Verified purchase</AppText>
              </View>

              <View style={styles.starsWrap}>
                <StarRatingInput value={rating} onChange={setRating} />
              </View>
              <AppText style={styles.ratingLabel}>
                {rating > 0 ? RATING_LABELS[rating] : 'Tap a star to rate'}
              </AppText>
            </View>

            <View style={styles.card}>
              <AppText style={styles.inputLabel}>Add a comment (optional)</AppText>
              <TextInput
                style={styles.input}
                value={comment}
                onChangeText={(text) => setComment(text.slice(0, MAX_VENDOR_RATING_COMMENT))}
                placeholder="Share details of your experience…"
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
                maxLength={MAX_VENDOR_RATING_COMMENT}
                accessibilityLabel="Rating comment"
              />
              <AppText style={styles.counter}>
                {comment.length}/{MAX_VENDOR_RATING_COMMENT}
              </AppText>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <AppText style={styles.errorText}>{error}</AppText>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {canRate ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + vs(12) }]}>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.submitBtn, submitDisabled && styles.submitBtnDisabled]}
            disabled={submitDisabled}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={existing ? 'Update rating' : 'Submit rating'}
          >
            <AppText style={styles.submitText}>
              {submitting ? 'Saving…' : existing ? 'Update rating' : 'Submit rating'}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export default RateVendorScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: hs(8),
    padding: hs(2),
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '800',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: hs(16),
    marginBottom: SPACE.BLOCK,
  },
  vendorName: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#111827',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    marginTop: vs(4),
  },
  verifiedText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: ROYAL_GREEN,
  },
  starsWrap: {
    alignItems: 'center',
    marginTop: SPACE.SECTION,
  },
  ratingLabel: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: SPACE.BLOCK,
  },
  inputLabel: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#374151',
    marginBottom: SPACE.BLOCK,
  },
  input: {
    minHeight: vs(96),
    fontSize: ms(13),
    color: '#111827',
    lineHeight: ms(19),
    borderRadius: ms(10),
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: hs(12),
  },
  counter: {
    fontSize: ms(11),
    color: '#9CA3AF',
    alignSelf: 'flex-end',
    marginTop: vs(4),
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: hs(12),
  },
  errorText: {
    fontSize: ms(12.5),
    fontWeight: '600',
    color: '#B91C1C',
    lineHeight: ms(18),
  },
  blockedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: hs(20),
    alignItems: 'center',
  },
  blockedTitle: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#111827',
    marginBottom: vs(6),
  },
  blockedText: {
    fontSize: ms(13),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: ms(19),
  },
  footer: {
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitBtn: {
    paddingVertical: vs(14),
    borderRadius: ms(10),
    backgroundColor: ROYAL_GREEN,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitText: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
