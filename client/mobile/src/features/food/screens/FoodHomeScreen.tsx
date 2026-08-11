import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, BackHandler } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import { useDiningFeed } from '../hooks/useDiningFeed';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { NearbyRestaurant } from '../mocks/homeFeed';
import FoodHeader from '../components/FoodHeader';
import HeroCardPair from '../components/HeroCardPair';
import FoodSectionHeader from '../components/FoodSectionHeader';
import CategoryRail from '../components/CategoryRail';
import PopularSpotRail from '../components/PopularSpotRail';
import TopFoodRail from '../components/TopFoodRail';
import NearbyRestaurantRow from '../components/NearbyRestaurantRow';
import FoodBottomNav, { type FoodTab } from '../components/FoodBottomNav';
import ExitConfirmModal from '../components/ExitConfirmModal';

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

  const openDining = useCallback(() => navigation.navigate('DiningDetail'), [navigation]);
  const openOrder = useCallback(() => navigation.navigate('OrderDetail'), [navigation]);

  const handleTabChange = useCallback(
    (tab: FoodTab) => {
      if (tab === 'Dining') {
        navigation.navigate('DiningDetail');
      } else if (tab === 'FoodOrder') {
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Cart');
      } else if (tab === 'Search') {
        navigation.navigate('Search');
      } else {
        setActiveTab(tab);
      }
    },
    [navigation],
  );

  const requestExit = useCallback(() => setExitOpen(true), []);
  const cancelExit = useCallback(() => setExitOpen(false), []);
  const confirmExit = useCallback(() => {
    setExitOpen(false);
    navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitOpen) {
        setExitOpen(false);
        return true;
      }
      setExitOpen(true);
      return true;
    });
    return () => subscription.remove();
  }, [exitOpen]);

  const renderNearby = useCallback(
    ({ item }: { item: NearbyRestaurant }) => (
      <NearbyRestaurantRow restaurant={item} onPress={openDining} />
    ),
    [openDining],
  );

  const listHeader = useCallback(() => {
    if (!feed) return null;
    return (
      <View>
        <FoodHeader onBack={requestExit} />
        <HeroCardPair onDiningPress={openDining} onOrderFoodPress={openOrder} />
        <CategoryRail categories={feed.categories} />
        <FoodSectionHeader title="Popular Dining Spots" onSeeAll={openDining} />
        <PopularSpotRail spots={feed.popularSpots} onPress={openDining} />
        <FoodSectionHeader title="Top Food To Order" onSeeAll={openOrder} />
        <TopFoodRail foods={feed.topFoods} onPress={openOrder} />
        <FoodSectionHeader title="Restaurants Nearby" onSeeAll={openDining} />
      </View>
    );
  }, [feed, openDining, openOrder, requestExit]);

  if (!feed) {
    return (
      <View style={styles.container}>
        <FoodHeader onBack={requestExit} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={foodTheme.primary} />
        </View>
        <FoodBottomNav activeTab={activeTab} onChange={handleTabChange} />
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
        bounces={false}
      />
      <FoodBottomNav activeTab={activeTab} onChange={handleTabChange} />
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
