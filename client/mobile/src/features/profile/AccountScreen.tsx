import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { logoutUser } from '@/services/logout';
import { AccountView } from '@/features/profile/AccountView';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useNotificationsStore } from '@/state/notificationsStore';
import { useAuthStore } from '@/state/authStore';
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
  const { palette } = useThemeMode();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshUnread = useNotificationsStore((s) => s.refreshUnread);

  useFocusEffect(
    useCallback(() => {
      // `/notifications` is auth-scoped; a guest account page has no inbox to refresh.
      if (isAuthenticated) void refreshUnread().catch(() => {});
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
          (navigation.getParent() as NativeStackNavigationProp<RootStackParamList>)?.reset({
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
        onSignIn={handleSignIn}
        onLogout={handleLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
