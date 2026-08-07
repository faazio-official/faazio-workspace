import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import FavouritesView from '@/features/favourites/FavouritesView';
import { CompactHubHeader } from '@/features/home/CompactHubHeader';
import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { NONHOME_H } from '@/features/home/hubHeader';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Favourites'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function FavouritesTabScreen({ navigation }: Props) {
  const addToCart = useCartStore((s) => s.addToCart);
  const favorites = useFavoriteStore((s) => s.favorites);
  const toggleFavorite = useFavoriteStore((s) => s.toggleFavorite);

  return (
    <View style={styles.container}>
      <CompactHubHeader onLocationPress={() => navigation.navigate('Location')} />
      <FavouritesView
        contentInset={NONHOME_H}
        addToCart={addToCart}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        onProductClick={(product) => navigation.navigate('ProductDetail', { product })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
});
