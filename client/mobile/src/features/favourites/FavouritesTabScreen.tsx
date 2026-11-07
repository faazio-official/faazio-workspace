import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import FavouritesPageView from '@/features/favourites/FavouritesPageView';
import type { CatalogEntry } from '@data/catalog/products';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Favourites'>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * The Favourites tab is the same store-backed page as the pushed Favourites
 * screen — one surface, one source (`useFavoriteStore`). The old fixture-backed
 * `FavouritesView` duplicate has been removed.
 */
export function FavouritesTabScreen({ navigation }: Props) {
  const handleProductPress = useCallback(
    (product: CatalogEntry) => navigation.navigate('ProductDetail', { product }),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <FavouritesPageView
        onBack={() => navigation.navigate('Home')}
        onProductPress={handleProductPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
});