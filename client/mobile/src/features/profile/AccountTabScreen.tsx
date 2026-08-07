import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import AccountView from '@/features/profile/AccountView';
import { CompactHubHeader } from '@/features/home/CompactHubHeader';
import { useCartStore } from '@/state/cartStore';
import { NONHOME_H } from '@/features/home/hubHeader';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Account'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function AccountTabScreen({ navigation }: Props) {
  const clearCart = useCartStore((s) => s.clearCart);

  const handleReset = useCallback(() => {
    clearCart();
    (navigation.getParent() as NativeStackNavigationProp<RootStackParamList>)?.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [clearCart, navigation]);

  return (
    <View style={styles.container}>
      <CompactHubHeader onLocationPress={() => navigation.navigate('Location')} />
      <AccountView
        contentInset={NONHOME_H}
        handleReset={handleReset}
        setShowLocationRequestState={() => navigation.navigate('Location')}
        setIsLoggedIn={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
});
