import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CategoriesDualPanel from '@/components/shared/CategoriesDualPanel';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Categories'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function CategoriesTabScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <CategoriesDualPanel
        initialChip="ALL"
        onBack={() => navigation.navigate('Home')}
        onSearchPress={() => navigation.navigate('Search', { subApp: 'HOME' })}
        onProductPress={(item, app) =>
          navigation.navigate('Search', { subApp: app, initialQuery: item.searchQuery })
        }
        onTitlePress={(title, app) =>
          navigation.navigate('Search', { subApp: app, initialQuery: title })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
});
