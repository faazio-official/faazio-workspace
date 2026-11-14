import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell } from 'lucide-react-native';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPSectionCard,
  DPToneDot,
  DPEmptyState,
  DPErrorState,
  DPSkeleton,
  DPButton,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type NotificationRecord } from '@/services/api/GatewayClient';
import { hs, ms, vs } from '@/utils/responsive';

const formatWhen = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/**
 * Durable in-app inbox backed by the shared `notifications.outbox` (the same
 * `getNotifications` seam the customer app uses). Push delivers the alert; this
 * screen is the record that keeps working when FCM is unavailable.
 */
export function NotificationsScreen() {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await gateway.getNotifications());
      setError(null);
    } catch {
      setError('Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const unreadCount = items.filter((item) => !item.readAt).length;

  const markRead = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item)),
      );
      void gateway.markNotificationRead(id).catch(() => void load());
    },
    [load],
  );

  const markAllRead = useCallback(() => {
    if (markingAll) return;
    setMarkingAll(true);
    const stamped = new Date().toISOString();
    setItems((prev) => prev.map((item) => (item.readAt ? item : { ...item, readAt: stamped })));
    void gateway
      .markAllNotificationsRead()
      .catch(() => void load())
      .finally(() => setMarkingAll(false));
  }, [load, markingAll]);

  return (
    <DPPage
      refreshControl={<RefreshControl refreshing={loading && items.length > 0} onRefresh={() => void load()} />}
    >
      <DPPageHeader
        kicker="Inbox"
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
        actions={
          unreadCount > 0 ? (
            <DPButton
              label="Mark all read"
              size="sm"
              variant="outline"
              fullWidth={false}
              loading={markingAll}
              onPress={markAllRead}
            />
          ) : undefined
        }
      />

      {loading && items.length === 0 ? (
        <DPSkeleton lines={4} />
      ) : error && items.length === 0 ? (
        <DPErrorState title="Notifications unavailable" description={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <DPEmptyState
          icon={<Bell size={ms(26)} color={DELIVERY.brand} strokeWidth={1.9} />}
          title="No notifications yet"
          description="Order and payout updates will appear here."
        />
      ) : (
        items.map((item) => {
          const unread = !item.readAt;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => markRead(item.id)}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={`${unread ? 'Unread' : 'Read'} notification: ${item.title}`}
            >
              <DPSectionCard style={[styles.card, unread && styles.cardUnread]}>
                <View style={styles.cardHead}>
                  {unread ? (
                    <View style={styles.unreadDot}>
                      <DPToneDot tone="brand" size={8} />
                    </View>
                  ) : null}
                  <AppText style={[styles.title, unread && styles.titleUnread]}>{item.title}</AppText>
                </View>
                <AppText style={styles.body}>{item.body}</AppText>
                <AppText style={styles.when}>{formatWhen(item.createdAt)}</AppText>
              </DPSectionCard>
            </TouchableOpacity>
          );
        })
      )}
    </DPPage>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: vs(10) },
  cardUnread: { borderColor: DELIVERY.brand, backgroundColor: DELIVERY.brandTint },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(8) },
  unreadDot: { marginTop: vs(5) },
  title: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '500', flex: 1 },
  titleUnread: { fontWeight: '700' },
  body: { ...DP_TYPE.body, color: DELIVERY.inkMuted, marginTop: vs(6) },
  when: { ...DP_TYPE.caption, color: DELIVERY.inkSubtle, marginTop: vs(10) },
});