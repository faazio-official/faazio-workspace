import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoryDrillInPanel from './components/CategoryDrillInPanel';
import type { Product } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryDrillIn'>;

/**
 * Category drill-in screen (opened from the Home/Mart header rail). Renders every
 * sub-category title as a flat text rail, then a store-grouped body of product
 * rails + contextual 16:9 store ads for the selected title, with an inline
 * searchbar that filters the store list. Tapping a store opens its details page
 * with that title's search pre-applied; tapping a product opens product detail.
 */
export function CategoryDrillInScreen({ navigation, route }: Props) {
  const { tabId, title, app } = route.params;

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleVendorPress = useCallback(
    (storeId: string, initialQuery: string) => {
      // Pharma stores have one canonical profile (STORE_TOP + reviews + Rx FAB). Routing a Pharma
      // tap through the generic Mart vendor page would split the paid STORE_TOP funnel and drop the
      // prescription CTA, so Pharma drill-in resolves to `MedicalShopDetails`.
      if (app === 'PHARMA') {
        navigation.navigate('MedicalShopDetails', { storeId });
        return;
      }
      navigation.navigate('VendorDetails', { storeId, app, initialQuery });
    },
    [navigation, app],
  );

  const handleProductPress = useCallback(
    (product: Product) => {
      navigation.navigate('ProductDetail', { product });
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      <CategoryDrillInPanel
        tabId={tabId}
        title={title}
        app={app}
        onBack={handleBack}
        onVendorPress={handleVendorPress}
        onProductPress={handleProductPress}
      />
    </View>
  );
}

export default CategoryDrillInScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
});
