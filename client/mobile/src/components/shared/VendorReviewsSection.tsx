import React, { memo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Star, BadgeCheck } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { useVendorReviews } from '@/hooks/useVendorRating';
import VendorRatingSummaryBar from './VendorRatingSummaryBar';
import VendorRateButton from './VendorRateButton';

interface VendorReviewsSectionProps {
  vendorId: string;
  title?: string;
  /** When provided, renders an eligibility-gated rate/update CTA. */
  onRatePress?: (vendor: { id: string; name: string }) => void;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Reusable vendor reviews block: aggregate summary + optional rate CTA + the
 * public review list. Shared by Mart/Pharma/Food vendor surfaces. Public rows
 * show the reviewer's full name only — never an id, phone, order id, or avatar.
 */
const VendorReviewsSection = memo(function VendorReviewsSection({
  vendorId,
  title = 'Ratings & Reviews',
  onRatePress,
  accentColor = '#16A34A',
  style,
}: VendorReviewsSectionProps) {
  const { reviews, summary } = useVendorReviews(vendorId);

  if (reviews.length === 0 && !onRatePress) return null;

  return (
    <View style={[styles.container, style]}>
      <AppText style={styles.title}>{title}</AppText>

      {summary.count > 0 ? (
        <VendorRatingSummaryBar
          average={summary.average}
          count={summary.count}
          distribution={summary.distribution}
          activeColor={accentColor}
        />
      ) : null}

      {onRatePress ? (
        <View style={styles.cta}>
          <VendorRateButton
            vendorId={vendorId}
            onPress={onRatePress}
            accentColor={accentColor}
          />
        </View>
      ) : null}

      {reviews.length > 0 ? (
        <View style={styles.list}>
          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewRow}>
              <View style={styles.reviewHeader}>
                <AppText style={styles.reviewer} numberOfLines={1}>
                  {review.userName}
                </AppText>
                {review.isMine ? (
                  <View style={styles.verified}>
                    <BadgeCheck size={ms(12)} color={accentColor} strokeWidth={2.4} />
                    <AppText style={[styles.verifiedText, { color: accentColor }]}>
                      Verified purchase
                    </AppText>
                  </View>
                ) : null}
                <AppText style={styles.reviewDate}>{review.date}</AppText>
              </View>
              <View style={styles.reviewStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={ms(12)}
                    color={star <= review.rating ? '#F59E0B' : '#D1D5DB'}
                    fill={star <= review.rating ? '#F59E0B' : 'transparent'}
                    strokeWidth={2}
                  />
                ))}
              </View>
              {review.comment ? (
                <AppText style={styles.reviewComment}>{review.comment}</AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <AppText style={styles.empty}>No reviews yet.</AppText>
      )}
    </View>
  );
});

export default VendorReviewsSection;

const styles = StyleSheet.create({
  container: {},
  title: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#111827',
    marginBottom: SPACE.BLOCK,
  },
  cta: {
    marginTop: SPACE.BLOCK,
  },
  list: {
    marginTop: SPACE.SECTION,
    gap: SPACE.SECTION,
  },
  reviewRow: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: SPACE.BLOCK,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  reviewer: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(3),
  },
  verifiedText: {
    fontSize: ms(10),
    fontWeight: '700',
  },
  reviewDate: {
    fontSize: ms(11),
    color: '#9CA3AF',
    marginLeft: 'auto',
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(2),
    marginTop: vs(4),
  },
  reviewComment: {
    fontSize: ms(13),
    color: '#374151',
    lineHeight: ms(19),
    marginTop: vs(6),
  },
  empty: {
    fontSize: ms(13),
    color: '#9CA3AF',
    marginTop: SPACE.BLOCK,
  },
});
