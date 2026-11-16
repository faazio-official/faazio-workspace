import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { SCREEN_W, vs } from '@/utils/responsive';

/**
 * Optical height of the wordmark's visible mark. Clamped so the same lockup
 * reads on a 320-wide phone and a 430-wide one; matches the customer welcome
 * screen's optical scale (`variant="welcome"`).
 */
const LOGO_HEIGHT = Math.round(Math.min(Math.max(SCREEN_W * 0.1, 32), 40));

interface DpAuthHeroProps {
  headline: string;
  description?: string;
}

/**
 * Delivery auth hero. Renders the Faazio wordmark exactly as the customer
 * welcome screen and the website do (`FaazioLogo` `variant="welcome"`) over the
 * neutral surface, with a sentence-case headline and one optional supporting line.
 */
export function DpAuthHero({ headline, description }: DpAuthHeroProps) {
  return (
    <View style={styles.hero}>
      <View accessible accessibilityRole="image" accessibilityLabel="Faazio">
        <FaazioLogo size={LOGO_HEIGHT} variant="welcome" />
      </View>

      <AppText style={styles.headline}>{headline}</AppText>
      {description ? <AppText style={styles.description}>{description}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: vs(20) },
  headline: { ...DP_TYPE.display, color: DELIVERY.ink, marginTop: vs(16) },
  description: { ...DP_TYPE.body, color: DELIVERY.inkMuted, marginTop: vs(8) },
});
