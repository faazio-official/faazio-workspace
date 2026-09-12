import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Droplet } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_DONOR_BANNER, NOTIFICATIONS_BANNER } from '@data/index';
import { BLOOD_RED, BLOOD_RED_SOFT, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_RADII } from '../tokens';

interface InfoBannerProps {
  /** Optional leading icon; defaults to the droplet (step 1). */
  icon?: ReactNode;
  /** Optional single-line message; when provided the banner shows message only (no title). */
  message?: string;
}

export function InfoBanner({ icon, message }: InfoBannerProps) {
  const showTitle = !message;
  return (
    <View style={styles.banner}>
      <View style={styles.iconBox}>
        {icon ?? <Droplet size={ms(20)} color={BLOOD_RED} fill={BLOOD_RED} />}
      </View>
      <View style={styles.copy}>
        {showTitle ? (
          <>
            <AppText style={styles.title}>{BLOOD_DONOR_BANNER.title}</AppText>
            <AppText style={styles.subtitle}>{BLOOD_DONOR_BANNER.subtitle}</AppText>
          </>
        ) : (
          <AppText style={styles.message}>{message ?? NOTIFICATIONS_BANNER.message}</AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BLOOD_RED_SOFT,
    borderRadius: BLOOD_RADII.chip,
    paddingHorizontal: hs(14),
    paddingVertical: vs(12),
    gap: hs(12),
  },
  iconBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: ms(13),
    fontWeight: '800',
    color: BLOOD_TEXT,
  },
  subtitle: {
    fontSize: ms(11),
    color: BLOOD_TEXT_MUTED,
    marginTop: vs(2),
    lineHeight: vs(15),
  },
  message: {
    fontSize: ms(12),
    color: BLOOD_TEXT_MUTED,
    lineHeight: vs(17),
  },
});
