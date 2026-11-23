import React, { useCallback, useState } from 'react';
import { neutral } from '@/theme/brandTokens';
import { categorical } from '@/theme/categorical';
import { StyleSheet, View, TouchableOpacity, StatusBar, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { hs, vs, ms } from '@/utils/responsive';
import { MapPin, ChevronDown, Search, X } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FaazioLogo } from '@/components/FaazioLogo';
import type { StoreProfile } from '@data/types';
import ExploreSectorsSection from '@/features/home/sections/ExploreSectorsSection';
import HomeView from '@/features/home/HomeView';
import AppText from '@/components/AppText';
import { HubGradient } from '@/features/home/HubGradient';
import {
  HEADER_ROW_GAP,
  HEADER_BOTTOM_PAD,
  HEADER_SEARCH_H,
  HEADER_RAIL_H,
  headerTopInset,
  expandedHeaderH,
  collapsedVisibleHeaderH,
} from '@/features/home/hubHeader';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';
import type { SubAppId } from '@/state/uiStore';
import HeaderCategoryRail from '@/components/shared/HeaderCategoryRail';
import type { CategoryRailItem } from '@/services/categoryRail';
import { useLocationStore } from '@/state/locationStore';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

const launchSubApp = (navigation: Props['navigation'], id: SubAppId) => {
  if (id === 'FOOD') {
    navigation.navigate('FoodApp');
  } else {
    navigation.navigate('SubApp', { subAppId: id });
  }
};

export function HomeTabScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const savedAddress = useLocationStore((s) => s.activeLocation?.address ?? '');
  const locationStatus = useLocationStore((s) => s.status);
  const locationSource = useLocationStore((s) => s.activeLocation?.source ?? null);
  const permissionGranted = useLocationStore((s) => s.permissionGranted);
  const addressLabel = savedAddress || 'Set your location';
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // A GPS origin is missing while the user may still want nearby sorting. A chosen origin (saved
  // address / pin) is a deliberate choice and never gets nagged; `idle` is handled upstream.
  const showLocationNudge =
    !nudgeDismissed &&
    locationSource === 'gps' &&
    (locationStatus === 'denied' ||
      locationStatus === 'blocked' ||
      (!permissionGranted && locationStatus !== 'ready'));

  // The Home header sits on the blue gradient, so the status-bar icons must be
  // light while this tab is focused. Restore dark icons when it blurs.
  useFocusEffect(
    useCallback(() => {
      const entry = StatusBar.pushStackEntry({ barStyle: 'light-content' });
      return () => StatusBar.popStackEntry(entry);
    }, []),
  );

  const handleLaunchSubApp = useCallback(
    (id: SubAppId) => launchSubApp(navigation, id),
    [navigation],
  );
  const handleProductClick = useCallback(
    (product: any) => navigation.navigate('ProductDetail', { product }),
    [navigation],
  );

  /** Paid HOME_HERO store target → the vendor page, or the medical-shop page for Pharma. */
  const handleStoreClick = useCallback(
    (store: StoreProfile) => {
      if (store.app === 'PHARMA') navigation.navigate('MedicalShopDetails', { storeId: store.id });
      else navigation.navigate('VendorDetails', { storeId: store.id, app: 'FA_MART' });
    },
    [navigation],
  );

  const handleOpenDeals = useCallback(
    (params: { mode: 'campaign' | 'discounts'; campaignId?: string; storeId?: string }) => {
      navigation.navigate('DealsLanding', params);
    },
    [navigation],
  );

  const handleRailCategoryPress = useCallback(
    (item: CategoryRailItem) => {
      navigation.navigate('CategoryDrillIn', {
        tabId: item.id,
        title: item.name,
        app: item.app,
        treeApp: item.treeApp,
      });
    },
    [navigation],
  );

  const scrollY = useSharedValue(0);
  const clamp = useSharedValue(0);
  const collapseCap = useSharedValue(0);
  const [stackH, setStackH] = useState(expandedHeaderH(insets.top));
  const viewportH = useSharedValue(0);

  const headerSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(clamp.value, collapseCap.value) }],
  }));

  // 0 at full expand → 1 at full collapse (guarded against a zero measured cap).
  const clampProgress = useDerivedValue(() => {
    const cap = collapseCap.value;
    if (cap <= 0) return 0;
    return Math.max(0, Math.min(1, clamp.value / cap));
  });

  // Logo/location + sectors block dissolves by half-collapse (also hides the
  // clipped sectors-row remnant that would otherwise poke under the status bar).
  const fadeTopBlockStyle = useAnimatedStyle(() => ({
    opacity:
      1 - interpolate(clampProgress.value, [0, 0.5], [0, 1], Extrapolation.CLAMP),
  }));

  const onStackLayout = useCallback(
    (e: any) => {
      const h = e.nativeEvent.layout.height;
      setStackH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
      collapseCap.value = Math.max(0, h - collapsedVisibleHeaderH(insets.top));
    },
    [collapseCap, insets.top],
  );

  return (
    <View style={styles.container} onLayout={(e) => { viewportH.value = e.nativeEvent.layout.height; }}>
      <Animated.View style={[styles.headerOuter, { height: stackH }]} collapsable={false} pointerEvents="box-none">
        <Animated.View style={[styles.headerSlid, { height: stackH }, headerSlideStyle]} collapsable={false}>
          <HubGradient height={stackH} />
          <View style={[styles.headerStack, { paddingTop: headerTopInset(insets.top) }]} onLayout={onStackLayout}>
            <Animated.View style={[styles.fadeBlock, fadeTopBlockStyle]} renderToHardwareTextureAndroid>
              <View>
                <View style={styles.headerTopRow}>
                  <FaazioLogo size={ms(28)} variant="wordmark" />

                  <View style={styles.headerCenter}>
                    <TouchableOpacity
                      style={styles.locationRow}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('Location')}
                      accessibilityRole="button"
                      accessibilityLabel={`Change delivery location. Current: ${addressLabel}`}
                    >
                      <MapPin size={ms(12)} color={categorical.green} />
                      <AppText style={styles.locationText} numberOfLines={1}>
                        {addressLabel}
                      </AppText>
                      <ChevronDown size={ms(12)} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.sectorsRow}>
                  <ExploreSectorsSection
                    onLaunchSubApp={handleLaunchSubApp}
                  />
                </View>
              </View>
            </Animated.View>

            {showLocationNudge ? (
              <View
                style={styles.locationNudge}
                accessibilityRole="alert"
              >
                <View style={styles.nudgeCopy}>
                  <AppText style={styles.nudgeTitle}>Location following is off</AppText>
                  <AppText style={styles.nudgeBody} numberOfLines={2}>
                    {locationStatus === 'blocked'
                      ? 'Nearby stores may be wrong. Enable location in Settings or set an address.'
                      : 'Nearby stores may be wrong. Allow location or set an address.'}
                  </AppText>
                  <View style={styles.nudgeActions}>
                    <TouchableOpacity
                      onPress={() => void Linking.openSettings()}
                      style={styles.nudgeAction}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Open device settings"
                    >
                      <AppText style={styles.nudgeActionText}>Open Settings</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Location')}
                      style={styles.nudgeAction}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Enter an address"
                    >
                      <AppText style={styles.nudgeActionText}>Enter address</AppText>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setNudgeDismissed(true)}
                  style={styles.nudgeDismiss}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss location notice"
                >
                  <X size={ms(13)} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.searchBar}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Search', { subApp: 'HOME' })}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <Search size={ms(16)} color={neutral.inkSubtle} strokeWidth={2.2} />
              <AppText style={styles.searchText} numberOfLines={1}>
                Search for food, groceries or more...
              </AppText>
            </TouchableOpacity>

            <View style={styles.fadeBlock}>
              <HeaderCategoryRail
                onCategoryPress={handleRailCategoryPress}
              />
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      <View style={styles.viewport}>
        <HomeView
          onLaunchSubApp={handleLaunchSubApp}
          onProductClick={handleProductClick}
          onStoreClick={handleStoreClick}
          onOpenDeals={handleOpenDeals}
          scrollY={scrollY}
          clamp={clamp}
          collapseCap={collapseCap}
          viewportH={viewportH}
          contentPaddingTop={stackH}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neutral.card },
  viewport: { flex: 1 },
  headerOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    overflow: 'hidden',
  },
  headerSlid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerStack: {
    paddingHorizontal: hs(16),
    paddingBottom: HEADER_BOTTOM_PAD,
    gap: HEADER_ROW_GAP,
  },
  fadeBlock: {
    width: '100%',
  },
  sectorsRow: {
    width: '100%',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: vs(6) },
  headerCenter: { flex: 1, alignItems: 'center' },
  locationRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    maxWidth: hs(210),
  },
  locationText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    maxWidth: hs(160),
  },
  locationNudge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: hs(8),
    borderRadius: ms(12),
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: hs(12),
    paddingVertical: vs(10),
  },
  nudgeCopy: { flex: 1 },
nudgeTitle: {
      fontSize: ms(11),
      fontWeight: '600',
      color: neutral.ink,
    },
nudgeBody: {
      fontSize: ms(10),
      lineHeight: ms(14),
      color: neutral.inkSubtle,
      marginTop: vs(2),
    },
  nudgeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(16),
    marginTop: vs(6),
  },
  nudgeAction: { minHeight: 32, justifyContent: 'center' },
  nudgeActionText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: neutral.card,
    textDecorationLine: 'underline',
  },
  nudgeDismiss: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    height: HEADER_SEARCH_H,
    borderRadius: ms(22),
    backgroundColor: neutral.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    paddingHorizontal: hs(16),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  searchText: {
    flex: 1,
    fontSize: ms(12),
    fontWeight: '600',
    color: neutral.inkSubtle,
  },
});
