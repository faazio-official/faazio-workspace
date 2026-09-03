import React, { useCallback, useState } from 'react';
import { View, StyleSheet, BackHandler, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useSharedValue } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import { useDiningFeed } from '../hooks/useDiningFeed';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { NearbyRestaurant, QuickCategory, FoodType } from '../mocks/homeFeed';
import type { DiningRestaurant } from '../mocks/types';
import { restaurantToProduct, nearbyToRestaurant } from '../mocks/types';
import FoodHeader from '../components/FoodHeader';
import HeroCardPair from '../components/HeroCardPair';
import FoodSectionHeader from '../components/FoodSectionHeader';
import CategoryRail from '../components/CategoryRail';
import PopularSpotRail from '../components/PopularSpotRail';
import TopFoodRail from '../components/TopFoodRail';
import NearbyRestaurantRow from '../components/NearbyRestaurantRow';
import FoodBottomNav, { type FoodTab } from '../components/FoodBottomNav';
import ExitConfirmModal from '../components/ExitConfirmModal';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FoodStatusBarStrip from '../components/FoodStatusBarStrip';

type Props = NativeStackScreenProps<FoodStackParamList, 'FoodHome'>;

/**
 * New Food sub-app home — the 7-section spec:
 * 1. Location header   2. Hero cards (Dining / Order Food)
 * 3. Quick categories  4. Popular dining spots  5. Top food to order
 * 6. Restaurants nearby (vertical)  7. Bottom nav.
 * The first five sections render as the vertical list header; nearby rows are
 * the list body — no nested virtualized lists.
 */
export function FoodHomeScreen({ navigation }: Props) {
  const feed = useDiningFeed();
  const [activeTab, setActiveTab] = useState<FoodTab>('Home');
  const [exitOpen, setExitOpen] = useState(false);
  const scrollY = useSharedValue(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const openDining = useCallback(() => navigation.navigate('DiningDetail'), [navigation]);
  const openDiningNearby = useCallback(
    () => navigation.navigate('DiningDetail', { scrollToGrid: true }),
    [navigation],
  );
  const openOrder = useCallback(() => navigation.navigate('OrderDetail'), [navigation]);

  const openNearbyProfile = useCallback(
    (restaurant: NearbyRestaurant) => {
      navigation.navigate('RestaurantProfile', { restaurant: nearbyToRestaurant(restaurant) });
    },
    [navigation],
  );

  const openProduct = useCallback(
    (product: any) => {
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('ProductDetail', { product });
    },
    [navigation],
  );

  const openSpotProduct = useCallback(
    (spot: DiningRestaurant) => openProduct(restaurantToProduct(spot)),
    [openProduct],
  );

  const openCategorySearch = useCallback(
    (category: QuickCategory) => navigation.navigate('Search', { initialQuery: category.searchQuery }),
    [navigation],
  );

  const openPopularSeeAll = useCallback(
    () => navigation.navigate('Search', { initialQuery: 'Popular Dining Spots' }),
    [navigation],
  );

  const openTopFoodSearch = useCallback(
    (food: FoodType) => navigation.navigate('Search', { initialQuery: food.name, initialMode: 'dishes' }),
    [navigation],
  );

  const openTopFoodSeeAll = useCallback(
    () => navigation.navigate('Search', { initialQuery: 'Top Food To Order', initialMode: 'dishes' }),
    [navigation],
  );

  const handleTabChange = useCallback(
    (tab: FoodTab) => {
      if (tab === 'Dining') {
        navigation.navigate('DiningDetail');
      } else if (tab === 'FoodOrder') {
        navigation.navigate('OrderDetail');
      } else if (tab === 'Search') {
        navigation.navigate('Search');
      } else {
        setActiveTab(tab);
      }
    },
    [navigation],
  );

  const openCart = useCallback(() => {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Cart');
  }, [navigation]);

  const requestExit = useCallback(() => setExitOpen(true), []);
  const cancelExit = useCallback(() => setExitOpen(false), []);
  const confirmExit = useCallback(() => {
    setExitOpen(false);
    navigation.goBack();
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (exitOpen) {
          setExitOpen(false);
          return true;
        }
        setExitOpen(true);
        return true;
      });
      return () => subscription.remove();
    }, [exitOpen]),
  );

  const renderNearby = useCallback(
    ({ item }: { item: NearbyRestaurant }) => (
      <NearbyRestaurantRow restaurant={item} onPress={openNearbyProfile} />
    ),
    [openNearbyProfile],
  );

  const listHeader = useCallback(() => {
    if (!feed) return null;
    return (
      <View>
        <FoodHeader onBack={requestExit} />
        <HeroCardPair onDiningPress={openDining} onOrderFoodPress={openOrder} />
        <CategoryRail categories={feed.categories} onPress={openCategorySearch} />
        <FoodSectionHeader title="Popular Dining Spots" onSeeAll={openPopularSeeAll} />
        <PopularSpotRail spots={feed.popularSpots} onPress={openSpotProduct} />
        <FoodSectionHeader title="Top Food To Order" onSeeAll={openTopFoodSeeAll} />
        <TopFoodRail foods={feed.topFoods} onPress={openTopFoodSearch} />
        <FoodSectionHeader title="Restaurants Nearby" onSeeAll={openDiningNearby} />
      </View>
    );
  }, [feed, openDining, openOrder, openCategorySearch, openPopularSeeAll, openTopFoodSearch, openTopFoodSeeAll, openDiningNearby, openSpotProduct, requestExit]);

  if (!feed) {
    return (
      <View style={styles.container}>
        <FoodHeader onBack={requestExit} />
        <LoadingSkeleton />
        <FoodBottomNav activeTab={activeTab} onChange={handleTabChange} onCartPress={openCart} />
        <ExitConfirmModal visible={exitOpen} onKeepExploring={cancelExit} onExit={confirmExit} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={feed.nearby}
        keyExtractor={(item) => item.id}
        renderItem={renderNearby}
        ListHeaderComponent={listHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
      />
      <FoodStatusBarStrip scrollY={scrollY} />
      <FoodBottomNav activeTab={activeTab} onChange={handleTabChange} onCartPress={openCart} />
      <ExitConfirmModal visible={exitOpen} onKeepExploring={cancelExit} onExit={confirmExit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: foodTheme.background,
  },
  listContent: {
    paddingBottom: vs(96),
  },
});
