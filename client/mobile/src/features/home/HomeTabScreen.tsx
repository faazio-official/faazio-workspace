import React, { useCallback, useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { MapPin, ChevronDown, Search } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FaazioLogo } from '@/components/FaazioLogo';
import ExploreSectorsSection from '@/features/home/sections/ExploreSectorsSection';
import HomeView from '@/features/home/HomeView';
import AppText from '@/components/AppText';
import { useCartStore } from '@/state/cartStore';
import { HubGradient } from '@/features/home/HubGradient';
import {
  HEADER_TOPINSET,
  HEADER_ROW_GAP,
  HEADER_BOTTOM_PAD,
  HEADER_SEARCH_H,
  EXPANDED_H,
} from '@/features/home/hubHeader';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';
import type { SubAppId } from '@/state/uiStore';

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
  const addToCart = useCartStore((s) => s.addToCart);

  const handleLaunchSubApp = useCallback(
    (id: SubAppId) => launchSubApp(navigation, id),
    [navigation],
  );
  const handleProductClick = useCallback(
    (product: any) => navigation.navigate('ProductDetail', { product }),
    [navigation],
  );

  const scrollY = useSharedValue(0);
  const clamp = useSharedValue(0);
  const blockTravel = useSharedValue(0);
  const searchTravel = useSharedValue(0);
  const totalCap = useSharedValue(0);
  const [blockH, setBlockH] = useState(0);

  const blockSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(clamp.value, blockTravel.value) }],
  }));

  const searchSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(clamp.value, searchTravel.value) }],
  }));

  const onBlockLayout = useCallback(
    (e: any) => {
      const h = e.nativeEvent.layout.height;
      setBlockH(h);
      blockTravel.value = HEADER_TOPINSET + h + vs(8);
      totalCap.value = Math.max(blockTravel.value, searchTravel.value);
    },
    [blockTravel, searchTravel],
  );

  const onSearchWrapLayout = useCallback(
    (e: any) => {
      const y = e.nativeEvent.layout.y;
      searchTravel.value = Math.max(0, y - HEADER_TOPINSET);
      totalCap.value = Math.max(blockTravel.value, searchTravel.value);
    },
    [searchTravel, blockTravel],
  );

  const headerHeight = Math.max(EXPANDED_H, HEADER_TOPINSET + blockH + HEADER_ROW_GAP + HEADER_SEARCH_H + HEADER_BOTTOM_PAD);

  return (
    <View style={styles.container}>
      <View style={[styles.headerOuter, { height: headerHeight }]} collapsable={false} pointerEvents="box-none">
        <HubGradient />
        <Animated.View style={[styles.block, blockSlideStyle]} collapsable={false}>
          <View style={styles.blockInner} onLayout={onBlockLayout}>
            <View style={styles.headerTopRow}>
              <FaazioLogo size={ms(28)} />

              <View style={styles.headerCenter}>
                <TouchableOpacity
                  style={styles.locationRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Location')}
                >
                  <MapPin size={ms(11)} color="#7CE045" />
                  <AppText style={styles.locationText} numberOfLines={1}>
                    Sunnambukkara Street, Karaikal
                  </AppText>
                  <ChevronDown size={ms(11)} color="rgba(255,255,255,0.6)" />
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

        <Animated.View
          style={[styles.searchWrap, searchSlideStyle]}
          collapsable={false}
          onLayout={onSearchWrapLayout}
        >
          <TouchableOpacity
            style={styles.searchBar}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Search', { subApp: 'HOME' })}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Search size={ms(13)} color="#94a3b8" strokeWidth={2.2} />
            <AppText style={styles.searchText} numberOfLines={1}>
              Search for food, groceries or more...
            </AppText>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={styles.viewport}>
        <HomeView
          onLaunchSubApp={handleLaunchSubApp}
          addToCart={addToCart}
          onProductClick={handleProductClick}
          scrollY={scrollY}
          clamp={clamp}
          collapseCap={totalCap}
          expandedH={headerHeight}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  viewport: { flex: 1 },
  headerOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    overflow: 'hidden',
    shadowColor: 'rgba(109,40,217,0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerSlid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  block: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  blockInner: {
    paddingTop: HEADER_TOPINSET,
    paddingHorizontal: hs(16),
    paddingBottom: HEADER_ROW_GAP,
    gap: HEADER_ROW_GAP,
  },
  searchWrap: {
    position: 'absolute',
    left: hs(16),
    right: hs(16),
    bottom: HEADER_BOTTOM_PAD,
    height: HEADER_SEARCH_H,
  },
  sectorsRow: {
    width: '100%',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    maxWidth: hs(200),
  },
  locationText: {
    fontSize: ms(10),
    fontWeight: '900',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    maxWidth: hs(160),
  },
  searchBar: {
    flex: 1,
    borderRadius: ms(22),
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    paddingHorizontal: hs(16),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchText: {
    flex: 1,
    fontSize: ms(12),
    fontWeight: '600',
    color: '#94a3b8',
  },
});
