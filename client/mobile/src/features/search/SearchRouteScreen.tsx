import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Product } from '@data/types';
import { dishToProduct } from '@data/food/specials';
import type { SpecialDish } from '@/features/food/types';
import type { RootStackParamList } from '@/navigation/types';
import SearchScreen from './SearchScreen';
import { createMartSearchConfig } from './configs/martSearchConfig';
import { createPharmaSearchConfig } from './configs/pharmaSearchConfig';
import { createFoodSearchConfig } from './configs/foodSearchConfig';
import { createHomeSearchConfig } from './configs/homeSearchConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

/**
 * Thin router for the first-class Search screen. Picks the right sub-app config
 * from the route param and renders the shared shell. The shell itself
 * auto-focuses the field after mount.
 */
export function SearchRouteScreen({ navigation, route }: Props) {
  const { subApp, initialQuery, initialMode } = route.params;

  const handleProductPress = useCallback(
    (product: Product) => navigation.navigate('ProductDetail', { product }),
    [navigation],
  );

  const handleDishPress = useCallback(
    (dish: SpecialDish) =>
      navigation.navigate('ProductDetail', { product: dishToProduct(dish) }),
    [navigation],
  );

  const config = useMemo(() => {
    switch (subApp) {
      case 'FA_MART':
        return createMartSearchConfig({ onProductPress: handleProductPress });
      case 'PHARMA':
        return createPharmaSearchConfig({ onProductPress: handleProductPress });
      case 'FOOD':
        return createFoodSearchConfig({ onDishPress: handleDishPress });
      default:
        return createHomeSearchConfig({ onProductPress: handleProductPress });
    }
  }, [subApp, handleProductPress, handleDishPress]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <View style={styles.container}>
      <SearchScreen
        config={config}
        onBack={handleBack}
        initialQuery={initialQuery}
        initialMode={initialMode}
      />
    </View>
  );
}

export default SearchRouteScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
});
