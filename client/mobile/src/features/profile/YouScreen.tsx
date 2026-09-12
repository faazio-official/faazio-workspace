import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { logoutUser } from '@/services/logout';
import { AccountView } from '@/features/profile/AccountView';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'You'>;

/**
 * Pushed-mode wrapper for the shared "You" page. Rendered on the root stack
 * (same treatment as Cart) so the back arrow returns to whatever app pushed it.
 * This wrapper IS the root stack, so logout resets directly to Login.
 */
export function YouScreen({ navigation }: Props) {
  const handleLogout = useCallback(() => {
    logoutUser();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [navigation]);

  const handleOpenDetails = useCallback(() => {
    navigation.navigate('UserDetails');
  }, [navigation]);

  const handleOpenAddresses = useCallback(() => {
    navigation.navigate('SavedAddresses');
  }, [navigation]);

  const handleOpenOrders = useCallback(() => {
    navigation.navigate('MyOrders');
  }, [navigation]);

  const handleOpenFavourites = useCallback(() => {
    navigation.navigate('Favourites');
  }, [navigation]);

  const handleOpenRewards = useCallback(() => {
    navigation.navigate('FaazioRewards');
  }, [navigation]);

  const handleOpenSellWithUs = useCallback(() => {
    navigation.navigate('SellWithUs');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <AccountView
        onBack={() => navigation.goBack()}
        onOpenDetails={handleOpenDetails}
        onOpenAddresses={handleOpenAddresses}
        onOpenOrders={handleOpenOrders}
        onOpenFavourites={handleOpenFavourites}
        onOpenRewards={handleOpenRewards}
        onOpenSellWithUs={handleOpenSellWithUs}
        onLogout={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
});
