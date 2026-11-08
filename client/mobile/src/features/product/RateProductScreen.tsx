import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getProductById } from '@data/index';
import ReviewForm from '@/components/shared/ReviewForm';
import { gateway } from '@/services/api/GatewayClient';
import {
  canReviewProduct,
  clampReviewComment,
  MAX_PRODUCT_REVIEW_COMMENT,
} from '@/services/productReviews';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RateProduct'>;

/**
 * Product review form. Reachable from a delivered order's product detail.
 * Eligibility is re-checked on the server (delivered purchase), so the screen
 * is safe to deep-link into. One live review per (user, product), latest wins.
 */
export function RateProductScreen({ navigation, route }: Props) {
  const { productId, productName } = route.params;

  const product = getProductById(productId);
  const displayName = productName ?? product?.name ?? 'This product';

  const [canReview] = useState(() => canReviewProduct(productId));
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    },
    [],
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleSubmit = useCallback(async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    setError('');
    const outcome = await gateway.submitProductReview(productId, rating, comment);
    setSubmitting(false);
    if (outcome === 'synced') {
      Vibration.vibrate(10);
      setToast('Review saved');
      successTimer.current = setTimeout(() => navigation.goBack(), 800);
      return;
    }
    if (outcome === 'offline') {
      setError('Reviews need an internet connection. Please try again when you are online.');
    } else if (outcome === 'signed-out') {
      setError('Your session has expired. Please sign in again to submit your review.');
    } else {
      setError('We could not confirm a delivered purchase of this product.');
    }
  }, [comment, navigation, productId, rating, submitting]);

  return (
    <ReviewForm
      title="Write a review"
      subjectName={displayName}
      badgeLabel="Verified purchase"
      canReview={canReview}
      blockedTitle="Verified buyers only"
      blockedText={`You can review ${displayName} after an order containing it has been delivered.`}
      rating={rating}
      onRatingChange={setRating}
      comment={comment}
      onCommentChange={(text) => setComment(clampReviewComment(text))}
      maxComment={MAX_PRODUCT_REVIEW_COMMENT}
      commentLabel="Add a comment (optional)"
      commentPlaceholder="Share details of your experience…"
      error={error}
      submitting={submitting}
      submitLabel="Submit review"
      successToast={toast}
      onSubmit={handleSubmit}
      onBack={handleBack}
    />
  );
}

export default RateProductScreen;
