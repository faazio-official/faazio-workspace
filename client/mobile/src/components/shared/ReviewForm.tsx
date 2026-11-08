import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import StarRatingInput from '@/components/shared/StarRatingInput';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { neutral, semantic, semanticTint } from '@/theme/brandTokens';

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

export interface ReviewFormProps {
  /** Header title, e.g. "Write a review". */
  title: string;
  /** What is being reviewed (product / order). */
  subjectName: string;
  /** Badge label, e.g. "Verified purchase". */
  badgeLabel: string;
  canReview: boolean;
  blockedTitle: string;
  blockedText: string;
  rating: number;
  onRatingChange: (rating: number) => void;
  comment: string;
  onCommentChange: (comment: string) => void;
  maxComment: number;
  commentLabel: string;
  commentPlaceholder: string;
  error: string;
  submitting: boolean;
  submitLabel: string;
  successToast: string | null;
  onSubmit: () => void;
  onBack: () => void;
}

/**
 * Shared presentation for the product-review and order-feedback forms. State,
 * eligibility and the network call live in each screen; this widget only draws
 * the verified-purchase card, the star input, the bounded comment and the CTA.
 */
export default function ReviewForm({
  title,
  subjectName,
  badgeLabel,
  canReview,
  blockedTitle,
  blockedText,
  rating,
  onRatingChange,
  comment,
  onCommentChange,
  maxComment,
  commentLabel,
  commentPlaceholder,
  error,
  submitting,
  submitLabel,
  successToast,
  onSubmit,
  onBack,
}: ReviewFormProps) {
  const insets = useSafeAreaInsets();
  const submitDisabled = rating < 1 || submitting;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(26)} color={neutral.ink} strokeWidth={1.75} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>{title}</AppText>
        <TouchableOpacity
          onPress={onBack}
          style={styles.cancelBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <AppText style={styles.cancelText}>Cancel</AppText>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!canReview ? (
          <View style={styles.blockedCard}>
            <AppText style={styles.blockedTitle}>{blockedTitle}</AppText>
            <AppText style={styles.blockedText}>{blockedText}</AppText>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <AppText style={styles.subjectName}>{subjectName}</AppText>
              <View style={styles.verifiedRow}>
                <ShieldCheck size={ms(14)} color={semantic.success} strokeWidth={1.75} />
                <AppText style={styles.verifiedText}>{badgeLabel}</AppText>
              </View>

              <View style={styles.starsWrap}>
                <StarRatingInput value={rating} onChange={onRatingChange} />
              </View>
              <AppText style={styles.ratingLabel}>
                {rating > 0 ? RATING_LABELS[rating] : 'Tap a star to rate'}
              </AppText>
            </View>

            <View style={styles.card}>
              <AppText style={styles.inputLabel}>{commentLabel}</AppText>
              <AppTextInput
                style={styles.input}
                value={comment}
                onChangeText={onCommentChange}
                placeholder={commentPlaceholder}
                placeholderTextColor={neutral.inkSubtle}
                multiline
                textAlignVertical="top"
                maxLength={maxComment}
                accessibilityLabel={commentPlaceholder}
              />
              <AppText style={styles.counter}>
                {comment.length}/{maxComment}
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

      {canReview ? (
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={onSubmit}
            style={[styles.submitBtn, submitDisabled && styles.submitBtnDisabled]}
            disabled={submitDisabled}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
          >
            <AppText style={styles.submitText}>
              {submitting ? 'Saving…' : submitLabel}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : null}

      {successToast ? (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <AppText style={styles.toastText}>{successToast}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neutral.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
    backgroundColor: neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: neutral.border,
  },
  backButton: {
    marginRight: hs(8),
    padding: hs(2),
  },
  headerTitle: {
    flex: 1,
    fontSize: ms(18),
    fontWeight: '600',
    color: neutral.ink,
  },
  cancelBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: hs(4),
  },
  cancelText: {
    fontSize: ms(14),
    fontWeight: '500',
    color: neutral.inkMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  card: {
    backgroundColor: neutral.card,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    padding: hs(16),
    marginBottom: SPACE.BLOCK,
  },
  subjectName: {
    fontSize: ms(16),
    fontWeight: '600',
    color: neutral.ink,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    marginTop: vs(4),
  },
  verifiedText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: semantic.success,
  },
  starsWrap: {
    alignItems: 'center',
    marginTop: SPACE.SECTION,
  },
  ratingLabel: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.inkMuted,
    textAlign: 'center',
    marginTop: SPACE.BLOCK,
  },
  inputLabel: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.inkMuted,
    marginBottom: SPACE.BLOCK,
  },
  input: {
    minHeight: vs(96),
    fontSize: ms(13),
    color: neutral.ink,
    lineHeight: ms(19),
    borderRadius: ms(10),
    backgroundColor: neutral.surface,
    borderWidth: 1,
    borderColor: neutral.border,
    padding: hs(12),
  },
  counter: {
    fontSize: ms(11),
    color: neutral.inkSubtle,
    alignSelf: 'flex-end',
    marginTop: vs(4),
  },
  errorCard: {
    backgroundColor: semanticTint.danger,
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: hs(12),
  },
  errorText: {
    fontSize: ms(12.5),
    fontWeight: '600',
    color: semantic.danger,
    lineHeight: ms(18),
  },
  blockedCard: {
    backgroundColor: neutral.card,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    padding: hs(20),
    alignItems: 'center',
  },
  blockedTitle: {
    fontSize: ms(15),
    fontWeight: '600',
    color: neutral.ink,
    marginBottom: vs(6),
  },
  blockedText: {
    fontSize: ms(13),
    color: neutral.inkMuted,
    textAlign: 'center',
    lineHeight: ms(19),
  },
  footer: {
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    paddingBottom: vs(12),
    backgroundColor: neutral.card,
    borderTopWidth: 1,
    borderTopColor: neutral.border,
  },
  submitBtn: {
    minHeight: 48,
    paddingVertical: vs(14),
    borderRadius: ms(10),
    backgroundColor: semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: neutral.inkSubtle,
  },
  submitText: {
    fontSize: ms(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toast: {
    position: 'absolute',
    left: hs(16),
    right: hs(16),
    bottom: vs(24),
    paddingVertical: vs(12),
    paddingHorizontal: hs(16),
    borderRadius: ms(12),
    backgroundColor: neutral.ink,
    alignItems: 'center',
  },
  toastText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
