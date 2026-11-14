import React, { useCallback } from 'react';
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPSectionCard,
  DPListRow,
  DPButton,
  DPSeparator,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { SUPPORT_EMAIL, TERMS_URL, PRIVACY_URL } from '@/lib/site';
import { openTrustedUrl } from '@/lib/externalLinks';
import { vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'Support'>;

const FAQ: { q: string; a: string }[] = [
  { q: 'When do I get paid?', a: 'Payouts are settled by Faazio admin per order; your Earnings tab shows pending and paid amounts.' },
  { q: 'A document was rejected', a: 'Contact support and the admin team will request a replacement for that specific document.' },
  { q: 'I cannot go online', a: 'Check that location permission is granted and that your account status is Active.' },
];

export function SupportScreen({ navigation }: Props) {
  const emailSupport = useCallback((subject: string) => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    void Linking.openURL(url).catch(() => undefined);
  }, []);

  return (
    <DPPage>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button">
        <AppText style={styles.backText}>← Back</AppText>
      </TouchableOpacity>
      <DPPageHeader
        kicker="Help"
        title="Partner support"
        description="Reach the Faazio delivery partner team. For an immediate emergency call 112."
      />

      <DPSectionCard style={styles.card} title="Contact us">
        <DPListRow
          title="Email support"
          subtitle={SUPPORT_EMAIL}
          onPress={() => emailSupport('Delivery partner support')}
        />
        <DPListRow
          title="Report an order or payment issue"
          subtitle="Include the order number in your message"
          onPress={() => emailSupport('Order issue — delivery partner')}
          style={styles.lastRow}
        />
      </DPSectionCard>

      <DPSectionCard style={styles.card} title="Frequently asked">
        {FAQ.map((item, index) => (
          <View key={item.q}>
            <View style={styles.faq}>
              <AppText style={styles.faqQ}>{item.q}</AppText>
              <AppText style={styles.faqA}>{item.a}</AppText>
            </View>
            {index < FAQ.length - 1 ? <DPSeparator /> : null}
          </View>
        ))}
      </DPSectionCard>

      <DPSectionCard style={styles.card} title="Legal">
        <DPListRow title="Terms of service" onPress={() => void openTrustedUrl(TERMS_URL)} />
        <DPListRow
          title="Privacy policy"
          onPress={() => void openTrustedUrl(PRIVACY_URL)}
          style={styles.lastRow}
        />
      </DPSectionCard>

      <DPButton label="Email support" onPress={() => emailSupport('Delivery partner support')} style={styles.action} />
    </DPPage>
  );
}

const styles = StyleSheet.create({
  back: { paddingTop: vs(8), paddingBottom: vs(4) },
  backText: { ...DP_TYPE.label, color: DELIVERY.brand, fontWeight: '600' },
  card: { marginBottom: vs(12) },
  lastRow: { borderBottomWidth: 0 },
  faq: { paddingVertical: vs(4) },
  faqQ: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
  faqA: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(4) },
  action: { marginTop: vs(4) },
});