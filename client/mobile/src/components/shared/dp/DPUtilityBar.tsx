import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Bell, Power } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

interface DPUtilityBarProps {
  /** Rider name shown at the start of the shift bar. */
  riderName?: string;
  online: boolean;
  onToggleOnline: () => void;
  onlineBusy?: boolean;
  unreadCount?: number;
  onOpenAlerts?: () => void;
}

/**
 * The Home shift bar: one pinned row holding the rider's name, alerts and the
 * presence switch. It is the single availability signal on Home — status is not
 * repeated in a header, and profile lives in the bottom nav.
 */
export function DPUtilityBar({
  riderName,
  online,
  onToggleOnline,
  onlineBusy,
  unreadCount = 0,
  onOpenAlerts,
}: DPUtilityBarProps) {
  return (
    <View style={styles.bar}>
      <AppText numberOfLines={1} style={styles.name}>
        {riderName ?? 'Rider'}
      </AppText>

      <View style={styles.actions}>
        {onOpenAlerts ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Alerts, ${unreadCount} unread` : 'Alerts'}
            onPress={onOpenAlerts}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Bell size={ms(18)} color={DELIVERY.inkMuted} strokeWidth={1.5} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <AppText style={styles.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</AppText>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: online, disabled: Boolean(onlineBusy) }}
          accessibilityLabel={online ? 'Online. Tap to go offline' : 'Offline. Tap to go online'}
          onPress={onToggleOnline}
          disabled={onlineBusy}
          style={({ pressed }) => [
            styles.presence,
            online ? styles.presenceOn : styles.presenceOff,
            pressed && styles.pressed,
          ]}
        >
          <Power size={ms(16)} color={online ? DELIVERY.onBrand : DELIVERY.inkMuted} strokeWidth={1.5} />
          <AppText style={[styles.presenceText, online ? styles.presenceTextOn : styles.presenceTextOff]}>
            {online ? 'Online' : 'Offline'}
          </AppText>
          <View style={[styles.presenceDot, { backgroundColor: online ? DELIVERY.onBrand : DELIVERY.inkSubtle }]} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(8),
    paddingHorizontal: hs(16),
    paddingVertical: vs(8),
    backgroundColor: DELIVERY.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DELIVERY.border,
  },
  name: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '500', flexShrink: 1 },
  presence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    minHeight: vs(36),
    borderRadius: DELIVERY.radius.pill,
    paddingHorizontal: hs(12),
  },
  presenceOn: { backgroundColor: DELIVERY.success },
  presenceOff: { backgroundColor: DELIVERY.surfaceAlt },
  presenceText: { ...DP_TYPE.caption, fontWeight: '500' },
  presenceTextOn: { color: DELIVERY.onBrand },
  presenceTextOff: { color: DELIVERY.inkMuted },
  presenceDot: { width: ms(6), height: ms(6), borderRadius: ms(3), marginLeft: hs(2) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: hs(8) },
  iconButton: {
    width: ms(36),
    height: ms(36),
    borderRadius: DELIVERY.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DELIVERY.border,
    backgroundColor: DELIVERY.card,
  },
  badge: {
    position: 'absolute',
    top: -ms(2),
    right: -ms(2),
    minWidth: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    paddingHorizontal: ms(4),
    backgroundColor: DELIVERY.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: ms(11), fontWeight: '500', color: DELIVERY.onBrand },
  pressed: { opacity: 0.85 },
});