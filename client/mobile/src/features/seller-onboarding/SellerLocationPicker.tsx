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
import { parentRamp, neutral, semanticTint } from '@/theme/brandTokens';

interface Props {
  visible: boolean;
  initial: Coordinates | null;
  onCancel: () => void;
  onPick: (selection: { coordinates: Coordinates; address: string }) => void;
}

// Map centre when neither a saved pin nor a live fix exists. Karaikal town — the service area's
// home, and the same centre the landing-page lead picker uses, so both intake paths open on the
// right place. This is a viewport default only: it is never submitted as a shop pin.
const FALLBACK = { latitude: 10.9254, longitude: 79.838 };

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
  const stored = useLocationStore((s) =>
    typeof s.activeLocation?.latitude === 'number' &&
    typeof s.activeLocation?.longitude === 'number' &&
    !(s.activeLocation.latitude === 0 && s.activeLocation.longitude === 0)
      ? { latitude: s.activeLocation.latitude, longitude: s.activeLocation.longitude }
      : null,
  );
  const [pin, setPin] = useState<Coordinates>(
    initial ?? stored ?? FALLBACK,
  );
  const [address, setAddress] = useState('');
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  // A pin only counts once it is real: a saved shop pin, a live device fix, or a deliberate
  // tap/drag on the map. The fallback is a viewport centre for orientation, never a selection —
  // confirming it would invent a shop location, which every downstream distance/fee calculation
  // would then trust.
  const [picked, setPicked] = useState(initial != null || stored != null);

  useEffect(() => {
    if (!visible) return;
    const real = initial != null || stored != null;
    const start = initial ?? stored ?? FALLBACK;
    setPin(start);
    setPicked(real);
    setAddress('');
    if (real) void resolve(start);
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
    setPicked(true);
    void resolve(point);
  };

  const useMyLocation = async () => {
    setLocating(true);
    const ok = await refreshLiveLocation(true);
    setLocating(false);
    if (!ok) return;
    const fix = useLocationStore.getState().deviceFix;
    if (!fix) return;
    moveTo({ latitude: fix.latitude, longitude: fix.longitude });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + vs(8) }]}>
          <Pressable onPress={onCancel} style={styles.iconBtn} accessibilityLabel="Close map">
            <X size={ms(20)} color={neutral.ink} />
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
            <MapPin size={ms(18)} color={parentRamp.base} />
            <View style={{ flex: 1 }}>
              <AppText style={styles.pinLabel}>Selected point</AppText>
              <AppText style={styles.pinValue} numberOfLines={2}>
                {!picked
                  ? 'Tap the map to drop your shop pin'
                  : resolving
                    ? 'Resolving address…'
                    : address}
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
                <ActivityIndicator size="small" color={parentRamp.base} />
              ) : (
                <LocateFixed size={ms(15)} color={parentRamp.base} />
              )}
              <AppText style={styles.locateText}>Use my location</AppText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && { opacity: 0.9 },
                !picked && styles.confirmBtnDisabled,
              ]}
              onPress={() => onPick({ coordinates: pin, address })}
              disabled={resolving || !picked}
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
  container: { flex: 1, backgroundColor: neutral.card },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: vs(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: neutral.border,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: ms(15), fontWeight: '800', color: neutral.ink },
  map: { flex: 1 },
  sheet: {
    paddingHorizontal: hs(16),
    paddingTop: vs(14),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: neutral.border,
    backgroundColor: neutral.card,
  },
  pinRow: { flexDirection: 'row', gap: hs(10), alignItems: 'flex-start' },
  pinLabel: { fontSize: ms(10), fontWeight: '700', color: neutral.inkMuted, textTransform: 'uppercase' },
  pinValue: { fontSize: ms(12), fontWeight: '600', color: neutral.ink, marginTop: vs(2) },
  actions: { flexDirection: 'row', gap: hs(10), marginTop: vs(14) },
  locateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    paddingVertical: vs(11),
    borderRadius: ms(10),
    backgroundColor: parentRamp.tint,
  },
  locateText: { fontSize: ms(11), fontWeight: '800', color: parentRamp.base },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(11),
    borderRadius: ms(10),
    backgroundColor: parentRamp.base,
  },
  confirmText: { fontSize: ms(11), fontWeight: '800', color: neutral.card },
  confirmBtnDisabled: { opacity: 0.4 },
});
