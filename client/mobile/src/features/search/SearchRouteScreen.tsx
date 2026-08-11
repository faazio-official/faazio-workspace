import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Product } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';
import SearchScreen from './SearchScreen';
import { createMartSearchConfig } from './configs/martSearchConfig';
import { createGrocerySearchConfig } from './configs/grocerySearchConfig';
import { createPharmaSearchConfig } from './configs/pharmaSearchConfig';
import { createHomeSearchConfig } from './configs/homeSearchConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

/**
 * Thin router for the first-class Search screen. Picks the right sub-app config
 * from the route param, renders the shared shell, and auto-focuses the field
 * after mount to read as a transition.
 */
export function SearchRouteScreen({ navigation, route }: Props) {
  const { subApp, initialQuery } = route.params;
  const inputRef = useRef<TextInput | null>(null);

  const handleProductPress = useCallback(
    (product: Product) => navigation.navigate('ProductDetail', { product }),
    [navigation],
  );

  const config = useMemo(() => {
    switch (subApp) {
      case 'FA_MART':
        return createMartSearchConfig({ onProductPress: handleProductPress });
      case 'GROCERY':
        return createGrocerySearchConfig({ onProductPress: handleProductPress });
      case 'PHARMA':
        return createPharmaSearchConfig({ onProductPress: handleProductPress });
      default:
        return createHomeSearchConfig({ onProductPress: handleProductPress });
    }
  }, [subApp, handleProductPress]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <View style={styles.container}>
      <SearchScreen config={config} onBack={handleBack} inputRef={inputRef} initialQuery={initialQuery} />
    </View>
  );
}

export default SearchRouteScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
});
