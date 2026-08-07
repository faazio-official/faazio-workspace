import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FoodStackParamList } from '@/navigation/types';
import { vs } from '@/utils/responsive';
import FoodMenuView from '../FoodMenuView';
import FoodDetailTopBar from '../components/FoodDetailTopBar';
import FoodBottomNav, { type FoodTab } from '../components/FoodBottomNav';

type Props = NativeStackScreenProps<FoodStackParamList, 'OrderDetail'>;

/**
 * Order Food detail page — wraps the existing food menu so the hero card and
 * FoodOrder tab wiring is live, with the fixed bottom nav (FoodOrder active).
 */
export function OrderDetailScreen({ navigation }: Props) {
  const handleTabChange = useCallback(
    (tab: FoodTab) => {
      if (tab === 'Home') {
        navigation.popToTop();
      } else if (tab === 'Dining') {
        navigation.navigate('DiningDetail');
      } else if (tab === 'Search') {
        navigation.navigate('Search');
      }
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <FoodDetailTopBar title="Order Food" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <FoodMenuView />
      </View>
      <FoodBottomNav activeTab="FoodOrder" onChange={handleTabChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  body: {
    flex: 1,
    paddingBottom: vs(96),
  },
});