import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import FavouritesPageView from '@/features/favourites/FavouritesPageView';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Favourites'>;

/**
 * Pushed root-stack wrapper for the search-results-style Favourites page opened
 * from My Account. Back returns to the account page; tapping a product opens the
 * shared ProductDetail route.
 */
export function FavouritesScreen({ navigation }: Props) {
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleProductPress = useCallback(
    (product: any) => navigation.navigate('ProductDetail', { product }),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <FavouritesPageView onBack={handleBack} onProductPress={handleProductPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
});
