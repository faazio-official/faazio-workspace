import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ShieldAlert, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { deleteAccountEverywhere } from '@/services/accountDeletion';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;

const REASONS = [
  'I no longer use Faazio',
  'I have another account',
  'Privacy concerns',
  'Something else',
];

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
 * screen then clears the local session and every per-user store.
 */
export function DeleteAccountScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const runDelete = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteAccountEverywhere();
      // AppNavigator resets to Login when isAuthenticated flips to false.
    } catch {
      setSubmitting(false);
      setError('We could not delete your account. Check your connection and try again.');
    }
  }, []);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete your account?',
      'This permanently removes your profile, addresses, prescriptions, favourites, and coins. Order and tax records are kept as required by law. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete my account', style: 'destructive', onPress: () => void runDelete() },
      ],
    );
  }, [runDelete]);

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
              Deleting your account signs you out on this device and removes your personal data.
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
            under the periods above. See the Privacy Policy section “How long we keep your
            information” for details.
          </AppText>
        </View>

        <AppText style={styles.sectionTitle}>Why are you leaving? (optional)</AppText>
        <View style={styles.reasonWrap}>
          {REASONS.map((option) => {
            const selected = reason === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.reasonChip, selected && styles.reasonChipSelected]}
                activeOpacity={0.8}
                onPress={() => setReason(selected ? null : option)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <AppText style={[styles.reasonText, selected && styles.reasonTextSelected]}>
                  {option}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? <AppText style={styles.errorText}>{error}</AppText> : null}

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

        <AppText style={styles.footnote}>
          You can also request deletion by emailing fashoppingofficial@gmail.com with the subject
          “Delete my account”.
        </AppText>

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
    backgroundColor: '#1162D3',
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
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: hs(8), marginBottom: SPACE.SECTION },
  reasonChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(20),
    paddingHorizontal: hs(13),
    paddingVertical: vs(8),
  },
  reasonChipSelected: { borderColor: '#1162D3', backgroundColor: '#EFF6FF' },
  reasonText: { fontSize: ms(12), fontWeight: '600', color: '#475569' },
  reasonTextSelected: { color: '#1162D3' },
  errorText: { fontSize: ms(12), fontWeight: '600', color: '#B91C1C', marginBottom: vs(12) },
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
  footnote: {
    fontSize: ms(11),
    fontWeight: '500',
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: vs(14),
    lineHeight: ms(17),
  },
  bottomSpacer: { height: vs(40) },
});
