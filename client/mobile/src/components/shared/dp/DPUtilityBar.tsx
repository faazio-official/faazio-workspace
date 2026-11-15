import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Bell, Power } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';
import { DPAvatar } from './DPData';

interface DPUtilityBarProps {
  online: boolean;
  onToggleOnline: () => void;
  onlineBusy?: boolean;
  unreadCount?: number;
  onOpenInbox?: () => void;
  /** Full name used to derive the avatar initials. */
  profileName?: string;
  onOpenProfile?: () => void;
}

/**
 * Shift bar: the rider's presence switch, inbox and profile in one quiet row
 * (the reference's `UtilityPanel`). Tabs stay for navigation; this is state plus
 * the two things a rider may need mid-shift — the inbox and their profile.
 */
export function DPUtilityBar({
  online,
  onToggleOnline,
  onlineBusy,
  unreadCount = 0,
  onOpenInbox,
  profileName,
  onOpenProfile,
}: DPUtilityBarProps) {
  return (
    <View style={styles.bar}>
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
        <Power size={ms(14)} color={online ? DELIVERY.onBrand : DELIVERY.inkMuted} strokeWidth={2} />
        <AppText style={[styles.presenceText, online ? styles.presenceTextOn : styles.presenceTextOff]}>
          {online ? 'Online' : 'Offline'}
        </AppText>
        <View style={[styles.presenceDot, { backgroundColor: online ? DELIVERY.onBrand : DELIVERY.inkSubtle }]} />
      </Pressable>

      <View style={styles.actions}>
        {onOpenInbox ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Inbox, ${unreadCount} unread` : 'Inbox'}
            onPress={onOpenInbox}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Bell size={ms(16)} color={DELIVERY.inkMuted} strokeWidth={2} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <AppText style={styles.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</AppText>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {onOpenProfile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile and services"
            onPress={onOpenProfile}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <DPAvatar name={profileName ?? 'Faazio'} size={32} />
          </Pressable>
        ) : null}
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
    paddingVertical: vs(10),
    backgroundColor: DELIVERY.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DELIVERY.border,
  },
  presence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    minHeight: vs(34),
    borderRadius: DELIVERY.radius.pill,
    paddingHorizontal: hs(12),
  },
  presenceOn: { backgroundColor: DELIVERY.success },
  presenceOff: { backgroundColor: DELIVERY.surfaceAlt },
  presenceText: { ...DP_TYPE.caption, fontWeight: '600' },
  presenceTextOn: { color: DELIVERY.onBrand },
  presenceTextOff: { color: DELIVERY.inkMuted },
  presenceDot: { width: ms(6), height: ms(6), borderRadius: ms(3), marginLeft: hs(2) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: hs(6) },
  iconButton: {
    width: ms(34),
    height: ms(34),
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
    minWidth: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    paddingHorizontal: ms(3),
    backgroundColor: DELIVERY.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: ms(9), fontWeight: '600', color: DELIVERY.onBrand },
  pressed: { opacity: 0.85 },
});