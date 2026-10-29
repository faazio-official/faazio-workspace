import React, { memo, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Star } from 'lucide-react-native';
import AppText from '@/components/AppText';
import InfoButton from './InfoButton';
import { getVendorById } from '@data/index';
import { hs, vs, ms } from '@/utils/responsive';
import { useCanRateVendor, useUserVendorRating } from '@/hooks/useVendorRating';

interface VendorRateButtonProps {
  vendorId?: string;
  vendorName?: string;
  onPress: (vendor: { id: string; name: string }) => void;
  variant?: 'full' | 'compact';
  accentColor?: string;
  /** Opt-in registry key that renders a small "i" guidance badge beside the button. */
  infoKey?: string;
}

/**
 * Eligibility-gated "Rate / Update your rating" CTA. Renders nothing unless the
 * signed-in user has a non-cancelled order resolving to this vendor. Reused by
 * My Orders, Order Details, and every vendor profile.
 */
const VendorRateButton = memo(function VendorRateButton({
  vendorId,
  vendorName,
  onPress,
  variant = 'full',
  accentColor = '#16A34A',
  infoKey,
}: VendorRateButtonProps) {
  const canRate = useCanRateVendor(vendorId);
  const myRating = useUserVendorRating(vendorId);

  const handlePress = useCallback(() => {
    if (!vendorId) return;
    onPress({ id: vendorId, name: vendorName ?? getVendorById(vendorId)?.name ?? 'Vendor' });
  }, [vendorId, vendorName, onPress]);

  if (!vendorId || !canRate) return null;

  const label = myRating ? 'Update your rating' : 'Rate this store';
  const compact = variant === 'compact';

  const button = (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.button,
        compact ? styles.buttonCompact : styles.buttonFull,
        { borderColor: accentColor },
      ]}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Star size={ms(compact ? 13 : 15)} color={accentColor} strokeWidth={2.2} />
      <AppText style={[styles.text, { color: accentColor }, compact && styles.textCompact]}>
        {label}
      </AppText>
    </TouchableOpacity>
  );

  if (!infoKey) return button;
  return (
    <View style={styles.withInfo}>
      {button}
      <InfoButton variant="badge" contentKey={infoKey} />
    </View>
  );
});

export default VendorRateButton;

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    borderRadius: ms(10),
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  buttonFull: {
    paddingVertical: vs(11),
    paddingHorizontal: hs(16),
    alignSelf: 'stretch',
  },
  buttonCompact: {
    paddingVertical: vs(6),
    paddingHorizontal: hs(12),
  },
  text: {
    fontSize: ms(13),
    fontWeight: '700',
  },
  textCompact: {
    fontSize: ms(12),
  },
  withInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
});
