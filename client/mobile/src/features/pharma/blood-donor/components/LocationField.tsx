import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MapPin, LocateFixed } from 'lucide-react-native';
import { getCurrentAddress } from '@/services/location';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RED, BLOOD_RADII } from '../tokens';

interface LocationFieldProps {
  label: string;
  required?: boolean;
  value: string | null;
  onChange: (value: string) => void;
}

/** Formats a raw location string into a `City PINCODE` display (falls back gracefully). */
function formatPlace(city?: string | null, district?: string | null, region?: string | null, postalCode?: string | null): string {
  const place = city ?? district ?? region;
  const parts = [place, postalCode].filter((p): p is string => Boolean(p));
  return parts.join(' ');
}

export function LocationField({ label, required = false, value, onChange }: LocationFieldProps) {
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    if (locating) return;

    Alert.alert(
      'Location access',
      'Faazio needs your location to suggest your city for blood donation. You can also type your city or pincode below.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Allow', onPress: () => void locateAndFill() },
      ],
    );
  };

  const locateAndFill = async () => {
    setLocating(true);
    try {
      const resolved = await getCurrentAddress();
      if (!resolved) {
        Alert.alert('Location unavailable', 'Type your city or pincode instead.');
        return;
      }

      const { coordinates, place } = resolved;
      const formatted = place
        ? formatPlace(place.city, place.district, place.region, place.postalCode)
        : '';
      onChange(
        formatted ||
          `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`,
      );
    } catch {
      Alert.alert('Location unavailable', 'Could not access your location. Type your city or pincode instead.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.block}>
      <AppText style={styles.label}>
        {label} {required ? <AppText style={styles.req}>*</AppText> : null}
      </AppText>

      <View style={styles.field}>
        <MapPin size={ms(18)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
        <AppTextInput
          style={styles.input}
          value={value ?? ''}
          onChangeText={onChange}
          placeholder="Enter your city or pincode"
          placeholderTextColor={BLOOD_TEXT_MUTED}
          autoCapitalize="words"
        />
        <TouchableOpacity
          onPress={handleLocate}
          disabled={locating}
          style={styles.locateBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
        >
          {locating ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <LocateFixed size={ms(18)} color="#ffffff" strokeWidth={2.4} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: vs(8),
  },
  label: {
    fontSize: ms(14),
    fontWeight: '700',
    color: BLOOD_TEXT,
  },
  req: {
    color: '#EF4444',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    height: ms(52),
    borderRadius: BLOOD_RADII.chip,
    borderWidth: 1.5,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    paddingHorizontal: hs(16),
  },
  input: {
    flex: 1,
    fontSize: ms(14),
    fontWeight: '600',
    color: BLOOD_TEXT,
    paddingVertical: 0,
  },
  locateBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: BLOOD_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
