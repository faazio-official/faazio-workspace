import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Mail, ShieldAlert, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { deleteAccountEverywhere } from '@/services/accountDeletion';
import { firebaseAuthConfigured } from '@/services/firebaseAuth';
import { useAuthStore } from '@/state/authStore';
import { openTrustedUrl } from '@/lib/externalLinks';
import { ACCOUNT_DELETION_MAILTO, PRIVACY_URL } from '@/lib/site';
import type { RootStackParamList } from '@/navigation/types';
import { parentRamp } from '@/theme/brandTokens';

type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;

const DELETED = [
  'Profile details (name, email, phone)',
  'Saved delivery addresses',
  'Favourites and recent searches',
  'Prescription images you uploaded',
  'Saved card tokens stored on this device',
  'FaazioCoins and streak progress',
  'Blood donation records and push tokens',
];

const KEPT = [
  'Order, payment, and tax records — kept as required by tax, accounting, and consumer-protection law, and no longer linked to your name, email, or phone.',
  'Security and audit logs — kept for about 7 days and then deleted.',
  'Hashed usage events — kept for about 90 days and then deleted.',
];

/**
 * In-app account deletion. The server erases PII and anonymises the retained financial rows; the
 * screen then deletes the Firebase identity and clears the local session. Deleting the account is
 * gated by a fresh phone OTP re-auth — both a security control and a prerequisite for Firebase's
 * user.delete() (which requires recent login).
 */
export function DeleteAccountScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const sendReauthOtp = useAuthStore((s) => s.sendReauthOtp);
  const verifyReauthOtp = useAuthStore((s) => s.verifyReauthOtp);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const phone = user?.phone ?? '';

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  const handleEmailDelete = useCallback(() => {
    void Linking.openURL(ACCOUNT_DELETION_MAILTO);
  }, []);
  const handleOpenPrivacy = useCallback(() => {
    void openTrustedUrl(PRIVACY_URL);
  }, []);

  const runDelete = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteAccountEverywhere();
      if (navigation.isFocused()) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    } catch {
      setSubmitting(false);
      setError(
        'We could not delete your account. Check your connection and try again, or use the email option below.',
      );
    }
  }, [navigation]);

  const startReauth = useCallback(async () => {
    if (sendingOtp) return;
    setOtpCode('');
    setOtpError(null);
    setError(null);
    setSendingOtp(true);
    try {
      await sendReauthOtp(phone);
      setReauth(true);
    } catch {
      setError(
        'We could not send a verification code to your number. Try again, or use the email option below.',
      );
    } finally {
      setSendingOtp(false);
    }
  }, [phone, sendReauthOtp, sendingOtp]);

  const verifyAndDelete = useCallback(async () => {
    if (otpCode.length !== 6 || submitting) return;
    setOtpError(null);
    setSubmitting(true);
    try {
      // Re-auth refreshes the Firebase session (satisfies user.delete()'s recent-login) and the
      // persisted bearer, then the combined delete erases server PII + the Firebase identity.
      await verifyReauthOtp(phone, otpCode);
      await deleteAccountEverywhere();
      if (navigation.isFocused()) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    } catch {
      setSubmitting(false);
      setOtpError(
        'We could not delete your account. Check the code and your connection, then try again, or use the email option below.',
      );
    }
  }, [deleteAccountEverywhere, navigation, otpCode, phone, submitting, verifyReauthOtp]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete your account?',
      'This permanently removes your profile, addresses, prescriptions, favourites, coins, and your phone identity. Order and tax records are kept as required by law. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: () => {
            if (firebaseAuthConfigured() && phone) {
              void startReauth();
            } else {
              void runDelete();
            }
          },
        },
      ],
    );
  }, [phone, runDelete, startReauth]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + vs(12) }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <AppText style={styles.headerTitle}>Delete account</AppText>
            <AppText style={styles.headerSubtitle}>This permanently closes your Faazio account</AppText>
          </View>
        </View>

        <View style={styles.warningCard}>
          <View style={styles.warningIcon}>
            <ShieldAlert size={ms(22)} color="#B91C1C" strokeWidth={2.2} />
          </View>
          <View style={styles.warningText}>
            <AppText style={styles.warningTitle}>This cannot be undone</AppText>
            <AppText style={styles.warningBody}>
              Deleting your account removes your personal data and closes your phone identity across
              Faazio. It cannot be undone.
            </AppText>
          </View>
        </View>

        <AppText style={styles.sectionTitle}>What we delete</AppText>
        <View style={styles.card}>
          {DELETED.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <AppText style={styles.bulletText}>{item}</AppText>
            </View>
          ))}
        </View>

        <AppText style={styles.sectionTitle}>What we keep</AppText>
        <View style={styles.card}>
          {KEPT.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={[styles.bullet, styles.bulletKept]} />
              <AppText style={styles.bulletText}>{item}</AppText>
            </View>
          ))}
          <AppText style={styles.retentionNote}>
            We complete deletion within 30 days of your request, except for records we must retain
            under the periods above. See the{' '}
            <AppText style={styles.link} onPress={handleOpenPrivacy}>
              Privacy Policy
            </AppText>{' '}
            section “How long we keep your information” for details.
          </AppText>
        </View>

        {error ? <AppText style={styles.errorText}>{error}</AppText> : null}

        {reauth ? (
          <View style={styles.card}>
            <AppText style={styles.otpTitle}>Verify it&apos;s you</AppText>
            <AppText style={styles.otpBody}>
              Enter the 6-digit code sent to your registered number to confirm account deletion. Your
              phone identity will also be removed.
            </AppText>
            <TextInput
              style={styles.otpInput}
              value={otpCode}
              onChangeText={(v) => setOtpCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              placeholder="••••••"
              maxLength={6}
              editable={!submitting}
            />
            {otpError ? <AppText style={styles.errorText}>{otpError}</AppText> : null}
            <TouchableOpacity
              style={[styles.deleteButton, (otpCode.length !== 6 || submitting) && styles.deleteButtonDisabled]}
              activeOpacity={0.85}
              onPress={verifyAndDelete}
              disabled={otpCode.length !== 6 || submitting}
              accessibilityRole="button"
              accessibilityLabel="Verify code and delete my account"
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Trash2 size={ms(18)} color="#ffffff" strokeWidth={2.2} />
                  <AppText style={styles.deleteButtonText}>Verify & delete</AppText>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emailButton}
              activeOpacity={0.8}
              onPress={() => setReauth(false)}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel account deletion"
            >
              <AppText style={styles.emailButtonText}>Cancel</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.deleteButton, submitting && styles.deleteButtonDisabled]}
              activeOpacity={0.85}
              onPress={handleDelete}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Delete my account"
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Trash2 size={ms(18)} color="#ffffff" strokeWidth={2.2} />
                  <AppText style={styles.deleteButtonText}>Delete my account</AppText>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emailButton}
              activeOpacity={0.8}
              onPress={handleEmailDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete my account by email"
            >
              <Mail size={ms(16)} color={parentRamp.base} strokeWidth={2.2} />
              <AppText style={styles.emailButtonText}>Delete by email instead</AppText>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: hs(16), paddingBottom: SPACE.LIST_BOTTOM },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACE.BLOCK },
  backButton: { marginRight: hs(8), paddingVertical: vs(2) },
  headerText: { flex: 1 },
  headerTitle: { fontSize: ms(22), fontWeight: '900', color: '#0f172a' },
  headerSubtitle: { fontSize: ms(12), fontWeight: '500', color: '#94a3b8', marginTop: vs(2) },
  warningCard: {
    flexDirection: 'row',
    gap: hs(12),
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: ms(14),
    padding: hs(14),
    marginBottom: SPACE.SECTION,
  },
  warningIcon: { paddingTop: vs(1) },
  warningText: { flex: 1 },
  warningTitle: { fontSize: ms(14), fontWeight: '800', color: '#991B1B' },
  warningBody: { fontSize: ms(12), fontWeight: '500', color: '#B91C1C', marginTop: vs(3), lineHeight: ms(18) },
  sectionTitle: { fontSize: ms(13), fontWeight: '800', color: '#64748b', marginBottom: vs(8) },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(14),
    padding: hs(14),
    marginBottom: SPACE.SECTION,
    gap: vs(10),
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(9) },
  bullet: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: parentRamp.base,
    marginTop: vs(6),
  },
  bulletKept: { backgroundColor: '#94a3b8' },
  bulletText: { flex: 1, fontSize: ms(12.5), fontWeight: '500', color: '#475569', lineHeight: ms(19) },
  retentionNote: {
    fontSize: ms(11.5),
    fontWeight: '500',
    color: '#64748b',
    lineHeight: ms(18),
    marginTop: vs(2),
  },
  link: { color: parentRamp.base, fontWeight: '700' },
  errorText: { fontSize: ms(12), fontWeight: '600', color: '#B91C1C', marginBottom: vs(12) },
  otpTitle: { fontSize: ms(15), fontWeight: '800', color: '#0f172a' },
  otpBody: {
    fontSize: ms(12),
    fontWeight: '500',
    color: '#64748b',
    lineHeight: ms(18),
    marginBottom: vs(12),
  },
  otpInput: {
    height: Math.max(52, vs(52)),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    fontSize: ms(24),
    letterSpacing: 8,
    textAlign: 'center',
    color: '#0f172a',
    marginBottom: vs(12),
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    height: Math.max(50, vs(50)),
    borderRadius: ms(14),
    backgroundColor: '#e11d48',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  deleteButtonDisabled: { opacity: 0.65 },
  deleteButtonText: { fontSize: ms(14), fontWeight: '800', color: '#ffffff' },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    marginTop: vs(14),
    paddingVertical: vs(12),
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  emailButtonText: { fontSize: ms(13), fontWeight: '700', color: parentRamp.base },
  bottomSpacer: { height: vs(40) },
});
