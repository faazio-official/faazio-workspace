import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoryDrillInPanel from './components/CategoryDrillInPanel';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryDrillIn'>;

/**
 * Category drill-in screen (opened from the Home/Mart header rail). Renders one
 * main category's subgroups as a plain-text rail with per-sub-category vendor
 * lists, plus an inline searchbar that filters the page. Tapping a vendor opens
 * its details page with that sub-category's search pre-applied.
 */
export function CategoryDrillInScreen({ navigation, route }: Props) {
  const { tabId, title, app } = route.params;

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleVendorPress = useCallback(
    (storeId: string, initialQuery: string) => {
      navigation.navigate('VendorDetails', { storeId, app, initialQuery });
    },
    [navigation, app],
  );

  const handleDeepSearch = useCallback(
    (query: string) => {
      navigation.navigate('Search', { subApp: app, initialQuery: query });
    },
    [navigation, app],
  );

  return (
    <View style={styles.container}>
      <CategoryDrillInPanel
        tabId={tabId}
        title={title}
        app={app}
        onBack={handleBack}
        onVendorPress={handleVendorPress}
        onDeepSearch={handleDeepSearch}
      />
    </View>
  );
}

export default CategoryDrillInScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
});
