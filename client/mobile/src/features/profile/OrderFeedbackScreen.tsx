import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ReviewForm from '@/components/shared/ReviewForm';
import { gateway } from '@/services/api/GatewayClient';
import { useOrdersStore } from '@/state/ordersStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderFeedback'>;

const MAX_COMMENT = 280;

/**
 * Post-delivery order feedback form. Only a delivered order is eligible; the
 * server re-checks the gate on write. One feedback row per order, latest wins,
 * pre-filled from `GET /orders/{id}/feedback`.
 */
export function OrderFeedbackScreen({ navigation, route }: Props) {
  const { orderId } = route.params;

  const [order] = useState(() => useOrdersStore.getState().getOrderById(orderId));
  const [delivered] = useState(() => (order ? order.status === 'Delivered' : true));
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gateway.remoteEnabled) return;
    let active = true;
    gateway
      .getOrderFeedback(orderId)
      .then((fb) => {
        if (!active || !fb || fb.rating < 1) return;
        setRating(fb.rating);
        setComment(fb.comment ?? '');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [orderId]);

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
    const outcome = await gateway.submitOrderFeedback(orderId, rating, comment);
    setSubmitting(false);
    if (outcome === 'synced') {
      Vibration.vibrate(10);
      setToast('Feedback saved');
      successTimer.current = setTimeout(() => navigation.goBack(), 800);
      return;
    }
    if (outcome === 'offline') {
      setError('Feedback needs an internet connection. Please try again when you are online.');
    } else if (outcome === 'signed-out') {
      setError('Your session has expired. Please sign in again to submit your feedback.');
    } else {
      setError('Feedback is only available after your order has been delivered.');
    }
  }, [comment, navigation, orderId, rating, submitting]);

  const subject = order?.vendorName
    ? `Order from ${order.vendorName}`
    : orderId;

  return (
    <ReviewForm
      title="Rate your order"
      subjectName={subject}
      badgeLabel="Delivered order"
      canReview={delivered}
      blockedTitle="Delivered orders only"
      blockedText="You can share feedback once this order has been delivered."
      rating={rating}
      onRatingChange={setRating}
      comment={comment}
      onCommentChange={(text) => setComment(text.slice(0, MAX_COMMENT))}
      maxComment={MAX_COMMENT}
      commentLabel="How was your delivery experience? (optional)"
      commentPlaceholder="Packing, delivery time, overall experience…"
      error={error}
      submitting={submitting}
      submitLabel={rating > 0 ? 'Update feedback' : 'Submit feedback'}
      successToast={toast}
      onSubmit={handleSubmit}
      onBack={handleBack}
    />
  );
}

export default OrderFeedbackScreen;
