import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocateFixed, MapPin, X } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { ms, vs, hs } from '@/utils/responsive';
import { reverseGeocode, type Coordinates } from '@/services/location';
import { refreshLiveLocation } from '@/hooks/useLiveLocation';
import { useLocationStore } from '@/state/locationStore';

interface Props {
  visible: boolean;
  initial: Coordinates | null;
  onCancel: () => void;
  onPick: (selection: { coordinates: Coordinates; address: string }) => void;
}

const FALLBACK = { latitude: 17.44, longitude: 78.38 };

/**
 * Foreground shop-pin picker for seller onboarding. The map is native
 * (`react-native-maps`); the confirm button only needs a tapped/dragged point,
 * so a missing Maps key never blocks submission — the address preview just
 * falls back to coordinates.
 */
export default function SellerLocationPicker({
  visible,
  initial,
  onCancel,
  onPick,
}: Props) {
  const insets = useSafeAreaInsets();
  const stored = useLocationStore((s) => ({
    latitude: s.latitude,
    longitude: s.longitude,
  }));
  const [pin, setPin] = useState<Coordinates>(
    initial ?? (stored.latitude ? stored : FALLBACK),
  );
  const [address, setAddress] = useState('');
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const start = initial ?? (stored.latitude ? stored : FALLBACK);
    setPin(start);
    setAddress('');
    void resolve(start);
    // Only re-run when the modal opens; dragging updates the pin deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const resolve = async (point: Coordinates) => {
    setResolving(true);
    const place = await reverseGeocode(point.latitude, point.longitude);
    const formatted =
      [place?.name, place?.street, place?.district, place?.city, place?.region]
        .filter(Boolean)
        .join(', ') || `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
    setAddress(formatted);
    setResolving(false);
  };

  const moveTo = (point: Coordinates) => {
    setPin(point);
    void resolve(point);
  };

  const useMyLocation = async () => {
    setLocating(true);
    const ok = await refreshLiveLocation(true);
    setLocating(false);
    if (!ok) return;
    const state = useLocationStore.getState();
    moveTo({ latitude: state.latitude, longitude: state.longitude });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + vs(8) }]}>
          <Pressable onPress={onCancel} style={styles.iconBtn} accessibilityLabel="Close map">
            <X size={ms(20)} color="#0f172a" />
          </Pressable>
          <AppText style={styles.title}>Pin your shop</AppText>
          <View style={styles.iconBtn} />
        </View>

        <MapView
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: pin.latitude,
            longitude: pin.longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          }}
          onPress={(event) => moveTo(event.nativeEvent.coordinate)}
        >
          <Marker
            coordinate={pin}
            draggable
            onDragEnd={(event) => moveTo(event.nativeEvent.coordinate)}
            title="Shop location"
          />
        </MapView>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + vs(14) }]}>
          <View style={styles.pinRow}>
            <MapPin size={ms(18)} color="#1162D3" />
            <View style={{ flex: 1 }}>
              <AppText style={styles.pinLabel}>Selected point</AppText>
              <AppText style={styles.pinValue} numberOfLines={2}>
                {resolving ? 'Resolving address…' : address}
              </AppText>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.locateBtn, pressed && { opacity: 0.7 }]}
              onPress={() => void useMyLocation()}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color="#1162D3" />
              ) : (
                <LocateFixed size={ms(15)} color="#1162D3" />
              )}
              <AppText style={styles.locateText}>Use my location</AppText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.9 }]}
              onPress={() => onPick({ coordinates: pin, address })}
              disabled={resolving}
            >
              <AppText style={styles.confirmText}>Confirm pin</AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: vs(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  iconBtn: { width: ms(36), height: ms(36), alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: ms(15), fontWeight: '800', color: '#0f172a' },
  map: { flex: 1 },
  sheet: {
    paddingHorizontal: hs(16),
    paddingTop: vs(14),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  pinRow: { flexDirection: 'row', gap: hs(10), alignItems: 'flex-start' },
  pinLabel: { fontSize: ms(10), fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  pinValue: { fontSize: ms(12), fontWeight: '600', color: '#0f172a', marginTop: vs(2) },
  actions: { flexDirection: 'row', gap: hs(10), marginTop: vs(14) },
  locateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    paddingVertical: vs(11),
    borderRadius: ms(10),
    backgroundColor: '#EAF2FE',
  },
  locateText: { fontSize: ms(11), fontWeight: '800', color: '#1162D3' },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(11),
    borderRadius: ms(10),
    backgroundColor: '#1162D3',
  },
  confirmText: { fontSize: ms(11), fontWeight: '800', color: '#ffffff' },
});
