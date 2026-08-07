import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { foodTheme } from '../constants/theme';
import type { FoodStackParamList } from '@/navigation/types';
import DiningScreen from './DiningScreen';
import FoodBottomNav, { type FoodTab } from '../components/FoodBottomNav';

type Props = NativeStackScreenProps<FoodStackParamList, 'DiningDetail'>;

/**
 * Dedicated Dining view wrapper — renders the Dining content and owns the fixed
 * 4-tab bottom nav (Dining active). Home / Search / FoodOrder navigate to their
 * screens within the Food stack.
 */
export function DiningDetailScreen({ navigation }: Props) {
  const handleTabChange = useCallback(
    (tab: FoodTab) => {
      if (tab === 'Home') {
        navigation.popToTop();
      } else if (tab === 'FoodOrder') {
        navigation.navigate('OrderDetail');
      } else if (tab === 'Search') {
        navigation.navigate('Search');
      }
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <DiningScreen onBack={() => navigation.goBack()} />
      <FoodBottomNav activeTab="Dining" onChange={handleTabChange} />
    </View>
  );
}

export default DiningDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: foodTheme.background,
  },
});
