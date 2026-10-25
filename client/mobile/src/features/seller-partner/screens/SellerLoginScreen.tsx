import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import { Card, ErrorText, Field, PrimaryButton, Screen, SP } from '../components';
import { GatewayHttpError, gateway } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { hs, ms, vs } from '@/utils/responsive';
import type { SellerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<SellerStackParamList, 'Login'>;

/** Seller/admin sign-in using the same email + password as the web partner portal. */
export function SellerLoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    if (hydrated && isAuthenticated) navigation.replace('Dashboard');
  }, [hydrated, isAuthenticated, navigation]);

  const onSubmit = useCallback(async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your portal email and password.');
      return;
    }
    setBusy(true);
    try {
      const out = await gateway.portalLogin(email, password);
      if (out.user.mustChange) {
        setError('Change your password on the web portal before using the seller app.');
        return;
      }
      const role = out.user.role;
      if (role === 'SELLER' && !out.user.sellerId) {
        setError('This seller account is not linked to a store. Contact a super admin.');
        return;
      }
      if (role !== 'SELLER' && role !== 'DISTRICT_ADMIN' && role !== 'SUPER_ADMIN') {
        setError('Only seller and admin portal accounts can use this app.');
        return;
      }
      await login({
        user: {
          id: out.user.id,
          name: out.user.name,
          email: out.user.email,
          role: out.user.role,
          sellerId: out.user.sellerId,
          stateCode: out.user.stateCode,
          districtCode: out.user.districtCode,
        },
        accessToken: out.accessToken,
        refreshToken: out.refreshToken,
      });
      navigation.replace('Dashboard');
    } catch (err) {
      if (err instanceof GatewayHttpError && err.status === 401) {
        setError('Invalid email or password.');
      } else if (err instanceof GatewayHttpError && err.status === 429) {
        setError('Too many attempts. Try again shortly.');
      } else {
        setError('Could not sign in. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [email, login, navigation, password]);

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <FaazioLogo size={30} />
            </View>
            <AppText style={styles.kicker}>Faazio</AppText>
            <AppText style={styles.title}>Seller Partner</AppText>
            <AppText style={styles.subtitle}>
              Sign in with the same credentials you use on the web partner portal.
            </AppText>
          </View>

          <Card>
            <Field
              label="Portal email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="you@business.com"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              placeholder="Password"
              onSubmitEditing={() => void onSubmit()}
            />
            <ErrorText>{error}</ErrorText>
            <PrimaryButton label="Sign in" onPress={() => void onSubmit()} loading={busy} />
          </Card>

          <AppText style={styles.terms}>
            Restaurant, mart and pharma sellers all use this app. Ask a super admin to reset a
            forgotten portal password.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: hs(20), paddingBottom: vs(32) },
  brand: { marginTop: vs(28), marginBottom: vs(24) },
  logo: { marginBottom: vs(16) },
  kicker: { fontSize: ms(12), fontWeight: '900', color: SP.brand, textTransform: 'uppercase', letterSpacing: 1.4 },
  title: { fontSize: ms(30), fontWeight: '900', color: SP.ink, marginTop: vs(4) },
  subtitle: { fontSize: ms(14), lineHeight: ms(21), color: SP.muted, marginTop: vs(8) },
  terms: { fontSize: ms(11), lineHeight: ms(16), color: SP.muted, marginTop: vs(16) },
});
