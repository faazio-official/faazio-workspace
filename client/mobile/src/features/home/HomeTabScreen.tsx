import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { MapPin, ChevronDown } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FaazioLogo } from '@/components/FaazioLogo';
import ExploreSectorsSection from '@/features/home/sections/ExploreSectorsSection';
import HomeView from '@/features/home/HomeView';
import AppTextInput from '@/components/AppTextInput';
import AppText from '@/components/AppText';
import { useCartStore } from '@/state/cartStore';
import { HubGradient } from '@/features/home/HubGradient';
import {
  HEADER_TOPINSET,
  HEADER_ROW_GAP,
  HEADER_BOTTOM_PAD,
  HEADER_SEARCH_H,
  EXPANDED_H,
  SHRINK_H,
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

  const scrollY = useSharedValue(0);
  const clamp = useSharedValue(0);
  const blockH = useSharedValue(0);
  const collapseHV = useSharedValue(HEADER_TOPINSET);

  const collapsingBlockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -clamp.value }],
  }));

  const headerSlidStyle = useAnimatedStyle(() => {
    const maxC = Math.max(1, collapseHV.value);
    const progress = Math.min(1, Math.max(0, clamp.value / maxC));
    return { transform: [{ translateY: -progress * SHRINK_H }] };
  });

  return (
    <View style={styles.container}>
      <View style={[styles.headerOuter, { height: EXPANDED_H }]} collapsable={false} pointerEvents="box-none">
        <Animated.View style={[styles.headerSlid, { height: EXPANDED_H }, headerSlidStyle]} collapsable={false}>
          <HubGradient />
          <View style={styles.headerContent}>
            <Animated.View
              style={[styles.collapsingBlock, collapsingBlockStyle]}
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                blockH.value = h;
                collapseHV.value = h + HEADER_TOPINSET;
              }}
            >
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
                  onLaunchSubApp={(id) => launchSubApp(navigation, id)}
                />
              </View>
            </Animated.View>
          </View>

          <View style={styles.searchBar}>
            <AppTextInput
              style={styles.searchInput}
              placeholder="Search for food, groceries or more..."
              placeholderTextColor="#94a3b8"
              textAlign="center"
            />
          </View>
        </Animated.View>
      </View>

      <View style={styles.viewport}>
        <HomeView
          onLaunchSubApp={(id) => launchSubApp(navigation, id)}
          addToCart={addToCart}
          onProductClick={(product) => navigation.navigate('ProductDetail', { product })}
          scrollY={scrollY}
          clamp={clamp}
          collapseH={collapseHV}
          expandedH={EXPANDED_H}
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
  collapsingBlock: {
    overflow: 'hidden',
    gap: HEADER_ROW_GAP,
  },
  sectorsRow: {
    width: '100%',
  },
  headerContent: { paddingTop: HEADER_TOPINSET, paddingHorizontal: hs(16) },
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
    position: 'absolute',
    bottom: HEADER_BOTTOM_PAD,
    left: hs(16),
    right: hs(16),
    height: HEADER_SEARCH_H,
    borderRadius: ms(22),
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#0f172a',
    paddingHorizontal: hs(20),
  },
});
