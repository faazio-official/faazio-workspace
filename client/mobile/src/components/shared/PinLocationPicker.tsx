import React, { useEffect, useMemo, useState } from 'react';
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
import { neutral, semantic, semanticTint } from '@/theme/brandTokens';

interface Props {
  visible: boolean;
  /** Existing point (a saved address, or the current origin) — the marker starts here. */
  initial: Coordinates | null;
  title?: string;
  onCancel: () => void;
  onPick: (selection: { coordinates: Coordinates; address: string }) => void;
}

// Map centre when neither a saved point nor a live fix exists. Karaikal town — the service area's
// home. Viewport default only: never submitted as a delivery point.
const FALLBACK = { latitude: 10.9254, longitude: 79.838 };

/**
 * Customer map pin drop. Used when the user is near no saved address and needs the pin exactly on
 * their gate/building rather than the street centroid a reverse geocode returns.
 *
 * The map is native (`react-native-maps`). Confirming only requires a tapped/dragged point, so a
 * missing Maps key never blocks the flow — the address preview just falls back to coordinates.
 */
export default function PinLocationPicker({
  visible,
  initial,
  title = 'Set your delivery point',
  onCancel,
  onPick,
}: Props) {
  const insets = useSafeAreaInsets();
  // Select the store object itself (stable identity between store updates) and derive the point
  // with useMemo — a selector returning a fresh object per call breaks useSyncExternalStore's
  // snapshot cache and re-renders forever ("Maximum update depth exceeded").
  const activeLocation = useLocationStore((s) => s.activeLocation);
  const stored = useMemo(
    () =>
      activeLocation &&
      typeof activeLocation.latitude === 'number' &&
      typeof activeLocation.longitude === 'number' &&
      !(activeLocation.latitude === 0 && activeLocation.longitude === 0)
        ? { latitude: activeLocation.latitude, longitude: activeLocation.longitude }
        : null,
    [activeLocation],
  );
  const [pin, setPin] = useState<Coordinates>(initial ?? stored ?? FALLBACK);
  const [address, setAddress] = useState('');
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  // A pin only counts once it is real — an existing point, or a deliberate tap/drag. The fallback
  // is a viewport centre for orientation and must never be confirmed as the delivery point.
  const [picked, setPicked] = useState(initial != null || stored != null);

  useEffect(() => {
    if (!visible) return;
    const real = initial ?? stored;
    const start = real ?? FALLBACK;
    setPin(start);
    setPicked(real != null);
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
          <AppText style={styles.title}>{title}</AppText>
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
            title="Delivery point"
          />
        </MapView>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + vs(14) }]}>
          <View style={styles.pinRow}>
            <MapPin size={ms(18)} color={semantic.success} />
            <View style={{ flex: 1 }}>
              <AppText style={styles.pinLabel}>Selected point</AppText>
              <AppText style={styles.pinValue} numberOfLines={2}>
                {!picked
                  ? 'Tap the map or drag the pin to your exact door'
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
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
            >
              {locating ? (
                <ActivityIndicator size="small" color={semantic.success} />
              ) : (
                <LocateFixed size={ms(15)} color={semantic.success} />
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
              accessibilityRole="button"
              accessibilityState={{ disabled: resolving || !picked }}
              accessibilityLabel="Confirm delivery point"
            >
              <AppText style={styles.confirmText}>Confirm point</AppText>
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
  title: { fontSize: ms(15), fontWeight: '600', color: neutral.ink },
  map: { flex: 1 },
  sheet: {
    paddingHorizontal: hs(16),
    paddingTop: vs(14),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: neutral.border,
    backgroundColor: neutral.card,
  },
  pinRow: { flexDirection: 'row', gap: hs(10), alignItems: 'flex-start' },
  pinLabel: { fontSize: ms(11), fontWeight: '600', color: neutral.inkMuted },
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
    backgroundColor: semanticTint.success,
  },
  locateText: { fontSize: ms(12), fontWeight: '600', color: semantic.success },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(11),
    borderRadius: ms(10),
    backgroundColor: semantic.success,
  },
  confirmText: { fontSize: ms(12), fontWeight: '600', color: neutral.card },
  confirmBtnDisabled: { opacity: 0.4 },
});
