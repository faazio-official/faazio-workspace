import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, ShieldCheck } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import InfoButton from '@/components/shared/InfoButton';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { deleteSelectedUserData } from '@/services/accountDeletion';
import type { DataDeletionCategory } from '@/services/api/GatewayClient';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestDataDeletion'>;

type CategoryKey = DataDeletionCategory | 'search-history';

const CATEGORIES: { key: CategoryKey; title: string; subtitle: string }[] = [
  {
    key: 'addresses',
    title: 'Saved addresses',
    subtitle: 'Remove every delivery address saved to your account.',
  },
  {
    key: 'favourites',
    title: 'Favourites',
    subtitle: 'Clear the products and vendors you have saved.',
  },
  {
    key: 'prescriptions',
    title: 'Prescription images',
    subtitle: 'Delete prescription uploads and their details.',
  },
  {
    key: 'search-history',
    title: 'Recent searches',
    subtitle: 'Clear the search terms stored on this device.',
  },
];

/**
 * Partial erasure: the account stays active while selected data categories are removed. Order,
 * payment, and tax records are deliberately excluded — they are retained for legal reasons.
 */
export function RequestDataDeletionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CategoryKey[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const toggle = useCallback((key: CategoryKey) => {
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }, []);

  const serverCategories = useMemo(
    () => selected.filter((key): key is DataDeletionCategory => key !== 'search-history'),
    [selected],
  );
  const includeSearchHistory = selected.includes('search-history');

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      await deleteSelectedUserData(serverCategories, includeSearchHistory);
      setSubmitting(false);
      Alert.alert(
        'Data deleted',
        'The selected data has been removed. Your account and order records are unchanged.',
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch {
      setSubmitting(false);
      Alert.alert(
        'Could not delete data',
        'Check your connection and try again. Nothing was removed.',
      );
    }
  }, [serverCategories, includeSearchHistory, navigation]);

  const handleSubmit = useCallback(() => {
    if (selected.length === 0) {
      Alert.alert('Select data to delete', 'Choose at least one category.');
      return;
    }
    Alert.alert(
      'Delete selected data?',
      'This permanently removes the selected data from your account. Your account stays active.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete data', style: 'destructive', onPress: () => void submit() },
      ],
    );
  }, [selected.length, submit]);

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: hs(8) }}>
              <AppText style={styles.headerTitle}>Request data deletion</AppText>
              <InfoButton contentKey="RequestDataDeletion" />
            </View>
            <AppText style={styles.headerSubtitle}>Delete some data and keep your account</AppText>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <ShieldCheck size={ms(22)} color="#1162D3" strokeWidth={2.2} />
          </View>
          <AppText style={styles.infoText}>
            Choose the data you want removed. Your account stays active, and order, payment, and tax
            records are kept as required by law.
          </AppText>
        </View>

        <View style={styles.card}>
          {CATEGORIES.map((category) => {
            const isSelected = selected.includes(category.key);
            return (
              <TouchableOpacity
                key={category.key}
                style={styles.row}
                activeOpacity={0.8}
                onPress={() => toggle(category.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected ? <Check size={ms(13)} color="#ffffff" strokeWidth={3} /> : null}
                </View>
                <View style={styles.rowText}>
                  <AppText style={styles.rowTitle}>{category.title}</AppText>
                  <AppText style={styles.rowSubtitle}>{category.subtitle}</AppText>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Delete selected data"
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <AppText style={styles.submitText}>Delete selected data</AppText>
          )}
        </TouchableOpacity>

        <AppText style={styles.footnote}>
          To delete your entire account instead, go to Privacy and security → Delete account.
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
  infoCard: {
    flexDirection: 'row',
    gap: hs(12),
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: ms(14),
    padding: hs(14),
    marginBottom: SPACE.SECTION,
  },
  infoIcon: { paddingTop: vs(1) },
  infoText: { flex: 1, fontSize: ms(12), fontWeight: '500', color: '#1E3A8A', lineHeight: ms(18) },
  card: { backgroundColor: '#FFFFFF', borderRadius: ms(14), marginBottom: SPACE.SECTION },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: hs(11),
    padding: hs(14),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  checkbox: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(6),
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(1),
  },
  checkboxSelected: { backgroundColor: '#1162D3', borderColor: '#1162D3' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: ms(13.5), fontWeight: '800', color: '#0f172a' },
  rowSubtitle: { fontSize: ms(11.5), fontWeight: '500', color: '#64748b', marginTop: vs(2), lineHeight: ms(17) },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: Math.max(50, vs(50)),
    borderRadius: ms(14),
    backgroundColor: '#1162D3',
    shadowColor: '#1162D3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitText: { fontSize: ms(14), fontWeight: '800', color: '#ffffff' },
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
