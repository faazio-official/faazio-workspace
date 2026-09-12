import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MapPin, LocateFixed } from 'lucide-react-native';
import * as Location from 'expo-location';
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

  const handleLocate = async () => {
    if (locating) return;

    try {
      const { status: existing } = await Location.getForegroundPermissionsAsync();
      if (existing !== 'granted') {
        Alert.alert(
          'Location access',
          'Faazio needs your location to suggest your city for blood donation. You can also type your city or pincode below.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Allow',
              onPress: async () => {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Location unavailable', 'Type your city or pincode instead.');
                  return;
                }
                await locateAndFill();
              },
            },
          ],
        );
        return;
      }
      await locateAndFill();
    } catch {
      Alert.alert('Location unavailable', 'Could not access your location. Type your city or pincode instead.');
    }
  };

  const locateAndFill = async () => {
    setLocating(true);
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const geocode = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const place = geocode[0];
      if (!place) {
        Alert.alert('Location unavailable', 'Could not determine your city. Type it instead.');
        return;
      }
      const formatted = formatPlace(place.city, place.district, place.region, place.postalCode);
      if (formatted) {
        onChange(formatted);
      } else {
        Alert.alert('Location unavailable', 'Could not determine your city. Type it instead.');
      }
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
