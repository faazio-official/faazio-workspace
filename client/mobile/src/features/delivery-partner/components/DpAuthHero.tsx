import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { SCREEN_W, hs, ms, vs } from '@/utils/responsive';

/**
 * Optical height of the wordmark's visible mark. Clamped so the same lockup
 * reads on a 320-wide phone and a 430-wide one; matches the customer welcome
 * screen's optical scale (`variant="welcome"`).
 */
const LOGO_HEIGHT = Math.round(Math.min(Math.max(SCREEN_W * 0.11, 32), 44));

interface DpAuthHeroProps {
  headline: string;
  description?: string;
  /** The Pickup → Drop route motif — the delivery signature, on the entry step only. */
  showRoute?: boolean;
}

/**
 * Delivery auth hero. Renders the Faazio wordmark exactly as the customer
 * welcome screen does (`FaazioLogo` `variant="welcome"`) over the neutral
 * surface, with a sentence-case headline and one supporting line. The route
 * motif is the one accent: it states the delivery model, not decoration.
 */
export function DpAuthHero({ headline, description, showRoute = false }: DpAuthHeroProps) {
  return (
    <View style={styles.hero}>
      <View accessible accessibilityRole="image" accessibilityLabel="Faazio">
        <FaazioLogo size={LOGO_HEIGHT} variant="welcome" />
      </View>

      <AppText style={styles.headline}>{headline}</AppText>
      {description ? <AppText style={styles.description}>{description}</AppText> : null}

      {showRoute ? (
        <View
          style={styles.route}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Pickup from a store, drop at the door, paid per delivery"
        >
          <View style={styles.routeRow}>
            <View style={styles.ring} />
            <AppText style={styles.stopLabel}>Pickup</AppText>
            <View style={styles.track} />
            <AppText style={styles.stopLabel}>Drop</AppText>
            <View style={styles.pin} />
          </View>
          <AppText style={styles.routeCaption}>Paid per delivery</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: vs(20) },
  headline: { ...DP_TYPE.display, color: DELIVERY.ink, marginTop: vs(20) },
  description: { ...DP_TYPE.body, color: DELIVERY.inkMuted, marginTop: vs(8) },
  route: { marginTop: vs(20) },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: hs(8) },
  ring: { width: ms(10), height: ms(10), borderRadius: ms(5), borderWidth: 2, borderColor: DELIVERY.brand },
  pin: { width: ms(10), height: ms(10), borderRadius: ms(5), backgroundColor: DELIVERY.brand },
  track: { flex: 1, height: ms(2), borderRadius: ms(1), backgroundColor: DELIVERY.border },
  stopLabel: { ...DP_TYPE.caption, color: DELIVERY.inkMuted },
  routeCaption: { ...DP_TYPE.caption, color: DELIVERY.inkSubtle, fontWeight: '400', marginTop: vs(8) },
});
