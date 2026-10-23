import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CreditCard, Lock } from 'lucide-react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { addCard } from './cardStorage';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Secure "Add New Card" form. The raw PAN/CVV live only in local form state and
 * are discarded — a payment token + last4 + expiry + network are stored in the
 * device Keychain (`FaazioCardToken`). On success the screen pops back and the
 * payment screen's Cards section refreshes from the Keychain.
 */
export default function AddCardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCardNumber = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 16);
    setCardNumber(digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim());
  };

  const handleExpiry = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const result = await addCard({
        cardNumber,
        expiry,
        cvv,
        name,
      });
      if (result.error || !result.card) {
        setError(result.error ?? 'Could not save this card. Please try again.');
        return;
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + vs(8) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={ms(20)} color="#1E2022" strokeWidth={2.4} />
        </TouchableOpacity>
        <AppText style={styles.title}>Add New Card</AppText>
        <View style={{ width: ms(38) }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.cardIconWrap}>
            <CreditCard size={ms(18)} color="#0F4C81" strokeWidth={2.2} />
          </View>
          <View style={styles.field}>
            <AppText style={styles.label}>Card number</AppText>
            <AppTextInput
              style={styles.input}
              value={cardNumber}
              onChangeText={handleCardNumber}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={19}
            />
          </View>
          <View style={styles.rowFields}>
            <View style={[styles.field, styles.halfField]}>
              <AppText style={styles.label}>Expiry</AppText>
              <AppTextInput
                style={styles.input}
                value={expiry}
                onChangeText={handleExpiry}
                placeholder="MM/YY"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
            <View style={[styles.field, styles.halfField]}>
              <AppText style={styles.label}>CVV</AppText>
              <AppTextInput
                style={styles.input}
                value={cvv}
                onChangeText={(t) => setCvv(t.replace(/\D/g, '').slice(0, 3))}
                placeholder="•••"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={3}
              />
            </View>
          </View>
          <View style={styles.field}>
            <AppText style={styles.label}>Name on card</AppText>
            <AppTextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Cardholder name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />
          </View>
        </View>

        {error ? <AppText style={styles.errorText}>{error}</AppText> : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <AppText style={styles.saveText}>Add Card</AppText>
          )}
        </TouchableOpacity>

        <View style={styles.secureNoteWrap}>
          <Lock size={ms(12)} color="#6B7280" strokeWidth={2.2} />
          <AppText style={styles.secureNote}>
            Card details are encrypted in your device keychain. Faazio never sees or stores your
            full card number or CVV.
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: vs(12),
  },
  backBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(12),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(14),
  },
  title: {
    flex: 1,
    fontSize: ms(15),
    fontWeight: '800',
    color: '#1E2022',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    padding: hs(16),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardIconWrap: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(12),
  },
  rowFields: {
    flexDirection: 'row',
    gap: hs(12),
  },
  halfField: {
    flex: 1,
  },
  field: {
    marginBottom: vs(14),
  },
  label: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: vs(5),
  },
  input: {
    height: Math.max(46, vs(46)),
    borderWidth: 1.4,
    borderColor: '#C4C9CF',
    borderRadius: ms(10),
    paddingHorizontal: hs(12),
    fontSize: ms(14),
    fontWeight: '600',
    color: '#111827',
  },
  errorText: {
    fontSize: ms(11),
    color: '#DC2626',
    fontWeight: '700',
    marginTop: vs(10),
    textAlign: 'center',
  },
  saveBtn: {
    height: Math.max(52, vs(52)),
    borderRadius: ms(14),
    backgroundColor: '#0F4C81',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(16),
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#ffffff',
  },
  secureNoteWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: hs(6),
    marginTop: vs(12),
    paddingHorizontal: hs(4),
  },
  secureNote: {
    flex: 1,
    fontSize: ms(10.5),
    color: '#6B7280',
    lineHeight: ms(15),
  },
});