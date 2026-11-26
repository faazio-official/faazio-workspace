import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { DPUtilityBar } from '@/components/shared/dp';
import { gateway } from '@/services/api/GatewayClient';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { toggleDeliveryOnline } from '../availability';
import { deliveryNavigationRef } from '../navigationRef';

/**
 * The rider app's top bar — the same shift bar Home uses (Faazio mark · alerts · presence).
 * Every authenticated page renders it as the pinned `DPPage` header so presence and the alert
 * count are visible and controllable from anywhere.
 */
export function DeliveryHeader() {
  const rider = useDeliveryPartnerStore((s) => s.rider);
  const online = useDeliveryPartnerStore((s) => s.online);
  const unread = useDeliveryPartnerStore((s) => s.unread);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const setOnline = useDeliveryPartnerStore((s) => s.setOnline);
  const setUnread = useDeliveryPartnerStore((s) => s.setUnread);
  const [busy, setBusy] = useState(false);

  // Deep-link cold starts can open a pushed page before Home has loaded the rider.
  useEffect(() => {
    if (rider) return;
    let active = true;
    void gateway
      .getDeliveryPartnerMe()
      .then((me) => {
        if (!active) return;
        setRider(me);
        setOnline(me.isAvailable);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [rider, setOnline, setRider]);

  // Unread badge is the server count (incoming-call rows excluded) — never derived from the full list.
  useEffect(() => {
    void gateway
      .getUnreadNotificationCount()
      .then((n) => setUnread(n))
      .catch(() => undefined);
  }, [setUnread]);

  const onToggleOnline = useCallback(async () => {
    setBusy(true);
    try {
      await toggleDeliveryOnline(!online);
    } catch (err) {
      Alert.alert(
        'Could not change availability',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }, [online]);

  const onOpenAlerts = useCallback(() => {
    if (deliveryNavigationRef.isReady()) {
      deliveryNavigationRef.navigate('Main', { screen: 'Notifications' });
    }
  }, []);

  return (
    <DPUtilityBar
      online={online}
      onToggleOnline={() => void onToggleOnline()}
      onlineBusy={busy}
      unreadCount={unread}
      onOpenAlerts={onOpenAlerts}
    />
  );
}