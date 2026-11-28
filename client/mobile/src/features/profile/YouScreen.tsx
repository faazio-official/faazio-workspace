import React, { useCallback } from 'react';
import { StyleSheet, StatusBar, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { logoutUser } from '@/services/logout';
import { AccountView } from '@/features/profile/AccountView';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useNotificationsStore } from '@/state/notificationsStore';
import { useAuthStore } from '@/state/authStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'You'>;

/**
 * Pushed-mode wrapper for the shared "You" page. Rendered on the root stack
 * (same treatment as Cart) so the back arrow returns to whatever app pushed it.
 * This wrapper IS the root stack, so logout resets directly to guest browsing (`MainTabs`).
 */
export function YouScreen({ navigation }: Props) {
  const { palette } = useThemeMode();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshUnread = useNotificationsStore((s) => s.refreshUnread);

  useFocusEffect(
    useCallback(() => {
      // The hero band is burgundy, so the status bar icons must be light while
      // this screen is focused (Home uses the same push/pop pattern).
      const statusBar = StatusBar.pushStackEntry({ barStyle: 'light-content' });
      // `/notifications` is auth-scoped; a guest account page has no inbox to refresh.
      if (isAuthenticated) void refreshUnread().catch(() => {});
      return () => StatusBar.popStackEntry(statusBar);
    }, [isAuthenticated, refreshUnread]),
  );

  const handleSignIn = useCallback(() => {
    navigation.navigate('Login', { resume: true });
  }, [navigation]);

  const handleLogout = useCallback(() => {
    void logoutUser()
      .catch(() => {})
      .finally(() => {
        if (navigation.isFocused()) {
          // Sign-out returns to guest browsing, never a forced login wall.
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
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

  // The hero "Order now" CTA sends the customer back to the shopping home.
  const handleStartOrder = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Home' });
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
        onStartOrder={handleStartOrder}
        onOpenLanguage={handleOpenLanguage}
        onOpenSellWithUs={handleOpenSellWithUs}
        onOpenSellerRequests={handleOpenSellerRequests}
        onOpenFeeChangeRequests={handleOpenFeeChangeRequests}
        onOpenPlatformFeeRequest={handleOpenPlatformFeeRequest}
        onSignIn={handleSignIn}
        onLogout={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
