import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocateFixed, MapPin, Navigation, Search, X } from 'lucide-react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { ms, vs, hs } from '@/utils/responsive';
import {
  getHighAccuracyPosition,
  isLocationServicesEnabled,
  requestEnableLocation,
  requestLocationAccess,
  reverseGeocode,
  type Coordinates,
} from '@/services/location';
import {
  resolvePlaceLocation,
  usePlaceAutocomplete,
} from '@/hooks/usePlaceAutocomplete';
import { useLocationStore } from '@/state/locationStore';
import { parentRamp, neutral, semantic } from '@/theme/brandTokens';

interface Props {
  visible: boolean;
  initial: Coordinates | null;
  onCancel: () => void;
  onPick: (selection: { coordinates: Coordinates; address: string }) => void;
}

function coordsLabel(point: Coordinates): string {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

// Viewport centre when there is no existing pin and no live fix. Karaikal town — the service area's
// home. This is only the map's initial camera position, never a submitted shop location.
const MAP_FALLBACK = { latitude: 10.9254, longitude: 79.838 };
const MAP_DELTA = 0.008;

/**
 * Foreground shop-pin picker for seller onboarding.
 *
 * The primary control is a native map with a draggable marker (matching the landing page's
 * sell-with-us form), so a seller can place the pin on the shop door itself. Search and "use my
 * current location" stay as the reliable alternatives: on a build whose Android Maps key is missing
 * or mismatched the tiles can render blank, but a search result or a live fix still drops a real
 * pin. A pin only counts once it is real (a tap/drag on the map, a search result, or a live fix).
 */
export default function SellerLocationPicker({
  visible,
  initial,
  onCancel,
  onPick,
}: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [pin, setPin] = useState<Coordinates | null>(null);
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);

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

  // The marker is only drawn for a real point (existing pin, parent-supplied pin, or live fix); the
  // fallback merely centres the camera so a seller who has never pinned still sees their area.
  const realPoint = pin ?? initial ?? stored;
  const centre = realPoint ?? MAP_FALLBACK;

  const focusMap = (point: Coordinates) => {
    mapRef.current?.animateToRegion(
      {
        latitude: point.latitude,
        longitude: point.longitude,
        latitudeDelta: MAP_DELTA,
        longitudeDelta: MAP_DELTA,
      },
      300,
    );
  };

  const { suggestions, loading: suggestionsLoading, enabled: placesEnabled } =
    usePlaceAutocomplete(query, pin ?? initial ?? stored);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setError('');
    setAddress('');
    if (initial) {
      setPin(initial);
      focusMap(initial);
      void resolveAddress(initial);
    } else {
      setPin(null);
    }
    // Reset only when the modal opens; picking updates deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const resolveAddress = async (point: Coordinates) => {
    setResolving(true);
    const place = await reverseGeocode(point.latitude, point.longitude);
    const formatted =
      [place?.name, place?.street, place?.district, place?.city, place?.region]
        .filter(Boolean)
        .join(', ') || coordsLabel(point);
    setAddress(formatted);
    setResolving(false);
  };

  const selectPoint = (point: Coordinates, formatted?: string) => {
    setPin(point);
    focusMap(point);
    setError('');
    setQuery('');
    if (formatted) {
      setAddress(formatted);
    } else {
      setAddress('');
      void resolveAddress(point);
    }
  };

  const pickSuggestion = async (placeId: string) => {
    setResolving(true);
    const resolved = await resolvePlaceLocation(placeId);
    setResolving(false);
    if (!resolved) {
      setError('Could not find that place. Try another search or use your current location.');
      return;
    }
    selectPoint(resolved.coordinates, resolved.address);
  };

  const useMyLocation = async () => {
    setError('');
    setLocating(true);
    try {
      // iOS's global Location Services switch has no in-app prompt — explain and point to Settings.
      if (Platform.OS === 'ios' && !(await isLocationServicesEnabled())) {
        setError(
          'Turn on Location Services in Settings → Privacy & Security → Location Services, then try again.',
        );
        return;
      }
      const access = await requestLocationAccess();
      if (access !== 'granted') {
        if (access === 'blocked') {
          setError(
            'Location access is off for Faazio. Enable it in Settings → Location, then tap “Use my location” again.',
          );
          void Linking.openSettings();
        } else {
          setError(
            'Location permission is required to pin your shop. You can still search for its address.',
          );
        }
        return;
      }
      if (!(await isLocationServicesEnabled())) {
        const enabled = await requestEnableLocation();
        if (enabled !== 'enabled') {
          setError('Turn on device location (GPS) to use your current location.');
          return;
        }
      }
      const fix = await getHighAccuracyPosition();
      selectPoint({ latitude: fix.latitude, longitude: fix.longitude });
    } catch {
      setError(
        'We could not get your location right now. Try again, or search for the shop address.',
      );
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    if (!pin) return;
    onPick({ coordinates: pin, address: address || coordsLabel(pin) });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.container, { paddingTop: insets.top + vs(8) }]}>
        <View style={styles.header}>
          <Pressable
            onPress={onCancel}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={ms(20)} color={neutral.ink} />
          </Pressable>
          <AppText style={styles.title}>Pin your shop</AppText>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.mapCard}>
          {visible ? (
            <MapView
              ref={mapRef}
              style={styles.flex}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={{
                latitude: centre.latitude,
                longitude: centre.longitude,
                latitudeDelta: MAP_DELTA,
                longitudeDelta: MAP_DELTA,
              }}
              onPress={(event) => selectPoint(event.nativeEvent.coordinate)}
              accessibilityLabel="Shop location map"
              accessibilityHint="Tap the map or drag the pin onto your shop"
            >
              {realPoint ? (
                <Marker
                  coordinate={pin ?? realPoint}
                  draggable
                  onDragEnd={(event) => selectPoint(event.nativeEvent.coordinate)}
                  title="Shop location"
                />
              ) : null}
            </MapView>
          ) : null}
          <View style={styles.mapHint} pointerEvents="none">
            <MapPin size={ms(13)} color={neutral.card} />
            <AppText style={styles.mapHintText}>Tap or drag the pin onto your shop</AppText>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AppText style={styles.helper}>
              Tap the map or drag the pin onto your shop, search its address, or use your current
              location. This pin sets your state, district and where customers see the shop.
            </AppText>

            <View style={styles.searchRow}>
              <Search size={ms(17)} color={neutral.inkSubtle} />
              <AppTextInput
                style={styles.searchInput}
                placeholder="Search shop address or area"
                placeholderTextColor={neutral.inkSubtle}
                value={query}
                onChangeText={(value) => {
                  setError('');
                  setQuery(value);
                }}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery('')}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <X size={ms(13)} color={neutral.inkMuted} />
                </Pressable>
              ) : null}
            </View>

            {query.trim().length >= 3 ? (
              <View style={styles.suggestions}>
                {suggestionsLoading || resolving ? (
                  <ActivityIndicator color={parentRamp.base} style={styles.inlineLoader} />
                ) : suggestions.length > 0 ? (
                  suggestions.map((item) => (
                    <Pressable
                      key={item.placeId}
                      style={({ pressed }) => [
                        styles.suggestionRow,
                        pressed && { backgroundColor: neutral.surfaceAlt },
                      ]}
                      onPress={() => void pickSuggestion(item.placeId)}
                      accessibilityRole="button"
                    >
                      <Navigation
                        size={ms(14)}
                        color={neutral.inkSubtle}
                        style={{ transform: [{ rotate: '135deg' }] }}
                      />
                      <View style={styles.flex}>
                        <AppText style={styles.suggestionTitle}>{item.title}</AppText>
                        {item.subtitle ? (
                          <AppText style={styles.suggestionSubtitle}>{item.subtitle}</AppText>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <AppText style={styles.emptyText}>
                    {placesEnabled
                      ? 'No matching places. Try a different area or use your current location.'
                      : 'Address search is unavailable right now. Use your current location.'}
                  </AppText>
                )}
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.locateBtn, pressed && { opacity: 0.75 }]}
              onPress={() => void useMyLocation()}
              disabled={locating}
              accessibilityRole="button"
              accessibilityLabel="Use my current location"
              accessibilityState={{ busy: locating }}
            >
              {locating ? (
                <ActivityIndicator size="small" color={parentRamp.base} />
              ) : (
                <LocateFixed size={ms(16)} color={parentRamp.base} />
              )}
              <AppText style={styles.locateText}>Use my current location</AppText>
            </Pressable>

            {error ? (
              <View style={styles.errorBlock}>
                <AppText style={styles.errorText}>{error}</AppText>
                <Pressable
                  onPress={() => void Linking.openSettings()}
                  accessibilityRole="button"
                  accessibilityLabel="Open device settings"
                  style={styles.settingsLink}
                >
                  <AppText style={styles.settingsLinkText}>Open settings</AppText>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.pinRow}>
              <MapPin size={ms(18)} color={parentRamp.base} />
              <View style={styles.flex}>
                <AppText style={styles.pinLabel}>Selected shop point</AppText>
                <AppText style={styles.pinValue} numberOfLines={3}>
                  {!pin
                    ? 'Search or use your current location to drop the shop pin'
                    : resolving
                      ? 'Resolving address…'
                      : address}
                </AppText>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + vs(14) }]}>
          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              pressed && { opacity: 0.9 },
              (!pin || resolving) && styles.confirmBtnDisabled,
            ]}
            onPress={confirm}
            disabled={!pin || resolving}
            accessibilityRole="button"
            accessibilityLabel="Confirm shop pin"
            accessibilityState={{ disabled: !pin || resolving }}
          >
            <AppText style={styles.confirmText}>Confirm pin</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neutral.card },
  flex: { flex: 1 },
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
  mapCard: {
    height: vs(220),
    marginHorizontal: hs(16),
    marginTop: vs(12),
    borderRadius: ms(14),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: neutral.border,
    backgroundColor: neutral.surface,
  },
  mapHint: {
    position: 'absolute',
    left: hs(10),
    bottom: vs(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    paddingHorizontal: hs(10),
    paddingVertical: vs(5),
    borderRadius: ms(8),
    backgroundColor: 'rgba(15,23,42,0.62)',
  },
  mapHintText: { fontSize: ms(10.5), fontWeight: '700', color: neutral.card },
  content: { paddingHorizontal: hs(16), paddingTop: vs(14), paddingBottom: vs(24) },
  helper: { fontSize: ms(11.5), color: neutral.inkMuted, lineHeight: ms(17), marginBottom: vs(14) },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    height: Math.max(44, vs(44)),
    paddingHorizontal: hs(14),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    backgroundColor: neutral.surface,
  },
  searchInput: { flex: 1, fontSize: ms(12.5), fontWeight: '600', color: neutral.ink },
  suggestions: { marginTop: vs(8) },
  inlineLoader: { alignSelf: 'center', marginVertical: vs(12) },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: hs(10),
    paddingVertical: vs(10),
    paddingHorizontal: hs(8),
    borderRadius: ms(10),
  },
  suggestionTitle: { fontSize: ms(12.5), fontWeight: '600', color: neutral.ink },
  suggestionSubtitle: { fontSize: ms(11), color: neutral.inkSubtle, marginTop: vs(2) },
  emptyText: { fontSize: ms(11.5), color: neutral.inkSubtle, paddingVertical: vs(8) },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    minHeight: 44,
    paddingVertical: vs(11),
    borderRadius: ms(10),
    backgroundColor: parentRamp.tint,
    marginTop: vs(12),
  },
  locateText: { fontSize: ms(12), fontWeight: '800', color: parentRamp.base },
  errorBlock: { marginTop: vs(10) },
  errorText: { fontSize: ms(11.5), color: semantic.danger, fontWeight: '600', lineHeight: ms(16) },
  settingsLink: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  settingsLinkText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: parentRamp.base,
    textDecorationLine: 'underline',
  },
  pinRow: {
    flexDirection: 'row',
    gap: hs(10),
    alignItems: 'flex-start',
    marginTop: vs(16),
    padding: hs(12),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    backgroundColor: neutral.surface,
  },
  pinLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    color: neutral.inkMuted,
    textTransform: 'uppercase',
  },
  pinValue: { fontSize: ms(12), fontWeight: '600', color: neutral.ink, marginTop: vs(2) },
  footer: {
    paddingHorizontal: hs(16),
    paddingTop: vs(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: neutral.border,
    backgroundColor: neutral.card,
  },
  confirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: vs(12),
    borderRadius: ms(10),
    backgroundColor: parentRamp.base,
  },
  confirmText: { fontSize: ms(12.5), fontWeight: '800', color: neutral.card },
  confirmBtnDisabled: { opacity: 0.4 },
});
