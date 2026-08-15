import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoriesDualPanel, { type CategoryRailId } from '@/components/shared/CategoriesDualPanel';
import type { RootStackParamList } from '@/navigation/types';
import type { SubAppId } from '@/state/uiStore';

type Props = NativeStackScreenProps<RootStackParamList, 'MasterCategories'>;

/**
 * Standalone universal "Master Categories" screen.
 *
 * Wraps the shared dual-panel (which owns its own [back] All Categories header)
 * with the All/Mart/Grocery/Pharma rail. The rail switches the sidebar +
 * content in place. Product taps and subgroup-title taps route straight into
 * that sub-app's Search screen (never a Catalog page). Accepts an optional
 * `initialChip` so sub-apps can open pre-scoped to their own category tree.
 */
export function MasterCategoriesScreen({ navigation, route }: Props) {
  const activeChip = useRef<CategoryRailId>(route.params?.initialChip ?? 'ALL');

  const handleChipChange = useCallback((chip: CategoryRailId) => {
    activeChip.current = chip;
  }, []);

  const handleProductPress = useCallback(
    (item: { searchQuery: string }, app: SubAppId) => {
      navigation.navigate('Search', { subApp: app, initialQuery: item.searchQuery });
    },
    [navigation],
  );

  const handleTitlePress = useCallback(
    (title: string, app: SubAppId) => {
      navigation.navigate('Search', { subApp: app, initialQuery: title });
    },
    [navigation],
  );

  const handleSearchPress = useCallback(() => {
    const chip = activeChip.current;
    const subApp: 'HOME' | SubAppId = chip === 'ALL' ? 'HOME' : chip;
    navigation.navigate('Search', { subApp });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <CategoriesDualPanel
        initialChip={route.params?.initialChip ?? 'ALL'}
        initialTabId={route.params?.initialTabId}
        onBack={() => navigation.goBack()}
        onSearchPress={handleSearchPress}
        onChipChange={handleChipChange}
        onProductPress={handleProductPress}
        onTitlePress={handleTitlePress}
      />
    </View>
  );
}

export default MasterCategoriesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
});
