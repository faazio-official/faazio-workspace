import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Hospital, Droplets, Siren, Bell } from 'lucide-react-native';
import { ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { NOTIFICATION_SOURCES, NOTIFICATIONS_BANNER } from '@data/index';
import type { BloodDonorDraft, NotificationSourceId } from '@data/index';
import { LabeledSwitchRow } from './LabeledSwitchRow';
import { InfoBanner } from './InfoBanner';
import { BLOOD_RED } from '../tokens';

interface NotificationsStepProps {
  draft: BloodDonorDraft;
  onUpdate: (patch: Partial<BloodDonorDraft>) => void;
}

const ICONS: Record<NotificationSourceId, React.ReactNode> = {
  hospitals: <Hospital size={ms(20)} color={BLOOD_RED} strokeWidth={2.2} />,
  bloodBanks: <Droplets size={ms(20)} color={BLOOD_RED} strokeWidth={2.2} />,
  emergencyAlerts: <Siren size={ms(20)} color={BLOOD_RED} strokeWidth={2.2} />,
};

export function NotificationsStep({ draft, onUpdate }: NotificationsStepProps) {
  const toggle = (id: NotificationSourceId, next: boolean) => {
    onUpdate({
      notificationPrefs: { ...draft.notificationPrefs, [id]: next },
    });
  };

  return (
    <View style={styles.section}>
      <View style={styles.rows}>
        {NOTIFICATION_SOURCES.map((source) => (
          <LabeledSwitchRow
            key={source.id}
            icon={ICONS[source.id]}
            label={source.label}
            value={draft.notificationPrefs[source.id]}
            onValueChange={(next) => toggle(source.id, next)}
          />
        ))}
      </View>

      <InfoBanner
        icon={
          <View style={styles.bannerIconBox}>
            <Bell size={ms(20)} color="#ffffff" strokeWidth={2.2} />
          </View>
        }
        message={NOTIFICATIONS_BANNER.message}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: SPACE.SECTION,
  },
  rows: {
    gap: SPACE.ITEM,
  },
  bannerIconBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: BLOOD_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
