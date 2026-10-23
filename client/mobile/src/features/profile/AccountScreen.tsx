import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { logoutUser } from '@/services/logout';
import { AccountView } from '@/features/profile/AccountView';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'You'>,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * Tab-mode wrapper for the shared "You" page. No back arrow — the tab bar is
 * the entry point, so `onBack` is omitted. Renders the presentational
 * AccountView and wires navigation callbacks that bubble to the root stack.
 */
export function AccountScreen({ navigation }: Props) {
  const handleLogout = useCallback(() => {
    logoutUser();
    (navigation.getParent() as NativeStackNavigationProp<RootStackParamList>)?.reset({
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

  const handleOpenSellerRequests = useCallback(() => {
    navigation.navigate('SellerRequests');
  }, [navigation]);

  const handleOpenFeeChangeRequests = useCallback(() => {
    navigation.navigate('FeeChangeRequests');
  }, [navigation]);

  const handleOpenPlatformFeeRequest = useCallback(() => {
    navigation.navigate('SellerPlatformFeeRequest', {});
  }, [navigation]);

  return (
    <View style={styles.container}>
      <AccountView
        onOpenDetails={handleOpenDetails}
        onOpenAddresses={handleOpenAddresses}
        onOpenOrders={handleOpenOrders}
        onOpenFavourites={handleOpenFavourites}
        onOpenRewards={handleOpenRewards}
        onOpenSellWithUs={handleOpenSellWithUs}
        onOpenSellerRequests={handleOpenSellerRequests}
        onOpenFeeChangeRequests={handleOpenFeeChangeRequests}
        onOpenPlatformFeeRequest={handleOpenPlatformFeeRequest}
        onLogout={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
});
