import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { logoutUser } from '@/services/logout';
import { AccountView } from '@/features/profile/AccountView';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useNotificationsStore } from '@/state/notificationsStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'You'>;

/**
 * Pushed-mode wrapper for the shared "You" page. Rendered on the root stack
 * (same treatment as Cart) so the back arrow returns to whatever app pushed it.
 * This wrapper IS the root stack, so logout resets directly to Login.
 */
export function YouScreen({ navigation }: Props) {
  const { palette } = useThemeMode();
  const refreshUnread = useNotificationsStore((s) => s.refreshUnread);

  useFocusEffect(
    useCallback(() => {
      void refreshUnread();
    }, [refreshUnread]),
  );

  const handleLogout = useCallback(() => {
    void logoutUser()
      .catch(() => {})
      .finally(() => {
        if (navigation.isFocused()) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
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

  const handleOpenNotifications = useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);

  const handleOpenDeleteAccount = useCallback(() => {
    navigation.navigate('DeleteAccount');
  }, [navigation]);

  const handleOpenRequestDataDeletion = useCallback(() => {
    navigation.navigate('RequestDataDeletion');
  }, [navigation]);

  const handleOpenFavourites = useCallback(() => {
    navigation.navigate('Favourites');
  }, [navigation]);

  const handleOpenRewards = useCallback(() => {
    navigation.navigate('FaazioRewards');
  }, [navigation]);

  const handleOpenLanguage = useCallback(() => {
    navigation.navigate('Language');
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
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <AccountView
        onBack={() => navigation.goBack()}
        onOpenDetails={handleOpenDetails}
        onOpenAddresses={handleOpenAddresses}
        onOpenDeleteAccount={handleOpenDeleteAccount}
        onOpenRequestDataDeletion={handleOpenRequestDataDeletion}
        onOpenOrders={handleOpenOrders}
        onOpenNotifications={handleOpenNotifications}
        onOpenFavourites={handleOpenFavourites}
        onOpenRewards={handleOpenRewards}
        onOpenLanguage={handleOpenLanguage}
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
  container: { flex: 1 },
});
