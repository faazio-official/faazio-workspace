import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import FavouritesView from '@/features/favourites/FavouritesView';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Favourites'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function FavouritesTabScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <FavouritesView onBack={() => navigation.navigate('Home')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
});
