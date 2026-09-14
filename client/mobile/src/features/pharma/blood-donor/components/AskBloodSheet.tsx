import React, { memo, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { X, Minus, Plus, Droplet, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_GROUPS, ASK_BLOOD_URGENCY_OPTIONS, ASK_BLOOD_COPY, ASK_BLOOD_UNITS } from '@data/index';
import type { BloodGroup, UserBloodRequest } from '@data/index';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { useBloodDonorStore } from '@/state/bloodDonorStore';
import { useAuthStore } from '@/state/authStore';
import { OptionChipGrid } from './OptionChipGrid';
import {
  BLOOD_RED,
  BLOOD_RED_DARK,
  BLOOD_RED_SOFT,
  BLOOD_TEXT,
  BLOOD_TEXT_MUTED,
  BLOOD_BORDER,
  BLOOD_RADII,
} from '../tokens';

interface AskBloodSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * "Ask Blood" form rendered in the shared `SlideUpSheet`. Collects the basic
 * details for a user blood request (blood group, units, hospital, city, contact,
 * deadline, optional note) and posts it via `bloodDonorStore.postAskRequest`.
 * After submit the sheet swaps to a success state with honest intent-framed copy
 * (registered donors are alerted — client-side simulation until the backend).
 */
const AskBloodSheet = memo(function AskBloodSheet({ visible, onClose }: AskBloodSheetProps) {
  const insets = useSafeAreaInsets();
  const postAskRequest = useBloodDonorStore((s) => s.postAskRequest);
  const accountPhone = useAuthStore((s) => s.user?.phone);

  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [units, setUnits] = useState(1);
  const [hospital, setHospital] = useState('');
  const [city, setCity] = useState('');
  const [contact, setContact] = useState(accountPhone ?? '');
  const [urgencyId, setUrgencyId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      setBloodGroup(null);
      setUnits(1);
      setHospital('');
      setCity('');
      setContact(accountPhone ?? '');
      setUrgencyId(null);
      setNote('');
      setSubmitted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const canAsk =
    bloodGroup !== null &&
    units >= ASK_BLOOD_UNITS.min &&
    units <= ASK_BLOOD_UNITS.max &&
    hospital.trim().length > 0 &&
    city.trim().length > 0 &&
    contact.trim().length > 0 &&
    urgencyId !== null;

  const selectedUrgency = ASK_BLOOD_URGENCY_OPTIONS.find((o) => o.id === urgencyId);

  const handleAsk = () => {
    if (!canAsk || !selectedUrgency || !bloodGroup) return;
    const input: Omit<UserBloodRequest, 'id' | 'postedAt'> = {
      bloodGroup,
      unitsRequired: units,
      hospital: hospital.trim(),
      city: city.trim(),
      contact: contact.trim(),
      neededWithin: selectedUrgency.neededWithin,
      urgency: selectedUrgency.urgency,
      note: note.trim() ? note.trim() : null,
    };
    postAskRequest(input);
    setSubmitted(true);
  };

  const handleClose = () => {
    if (submitted) return;
    onClose();
  };

  return (
    <SlideUpSheet visible={visible} onRequestClose={handleClose}>
      {submitted ? (
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <CheckCircle2 size={ms(40)} color={BLOOD_RED} strokeWidth={2.2} />
          </View>
          <AppText style={styles.successTitle}>{ASK_BLOOD_COPY.successTitle}</AppText>
          <AppText style={styles.successMessage}>{ASK_BLOOD_COPY.successMessage}</AppText>
          <TouchableOpacity
            onPress={onClose}
            style={styles.doneBtn}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <AppText style={styles.doneText}>{ASK_BLOOD_COPY.doneLabel}</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
        >
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <AppText style={styles.title}>{ASK_BLOOD_COPY.sheetTitle}</AppText>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={ms(20)} color="#6B7280" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
          <AppText style={styles.subtitle}>{ASK_BLOOD_COPY.sheetSubtitle}</AppText>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.block}>
              <AppText style={styles.label}>
                Blood Group <AppText style={styles.req}>*</AppText>
              </AppText>
              <OptionChipGrid<BloodGroup>
                options={BLOOD_GROUPS}
                selected={bloodGroup}
                onSelect={setBloodGroup}
              />
            </View>

            <View style={styles.block}>
              <AppText style={styles.label}>
                Units Required <AppText style={styles.req}>*</AppText>
              </AppText>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  onPress={() => setUnits((u) => Math.max(ASK_BLOOD_UNITS.min, u - 1))}
                  style={[styles.stepBtn, units <= ASK_BLOOD_UNITS.min && styles.stepBtnDisabled]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease units"
                >
                  <Minus size={ms(18)} color="#ffffff" strokeWidth={2.6} />
                </TouchableOpacity>
                <View style={styles.unitsValue}>
                  <AppText style={styles.unitsValueText}>{units}</AppText>
                  <AppText style={styles.unitsValueHint}>Unit{units > 1 ? 's' : ''}</AppText>
                </View>
                <TouchableOpacity
                  onPress={() => setUnits((u) => Math.min(ASK_BLOOD_UNITS.max, u + 1))}
                  style={[styles.stepBtn, units >= ASK_BLOOD_UNITS.max && styles.stepBtnDisabled]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Increase units"
                >
                  <Plus size={ms(18)} color="#ffffff" strokeWidth={2.6} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.block}>
              <AppText style={styles.label}>
                Hospital Name <AppText style={styles.req}>*</AppText>
              </AppText>
              <View style={styles.field}>
                <AppTextInput
                  style={styles.input}
                  value={hospital}
                  onChangeText={setHospital}
                  placeholder="e.g. City General Hospital"
                  placeholderTextColor={BLOOD_TEXT_MUTED}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.block}>
              <AppText style={styles.label}>
                City <AppText style={styles.req}>*</AppText>
              </AppText>
              <View style={styles.field}>
                <AppTextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Chennai"
                  placeholderTextColor={BLOOD_TEXT_MUTED}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.block}>
              <AppText style={styles.label}>
                Contact Number <AppText style={styles.req}>*</AppText>
              </AppText>
              <View style={styles.field}>
                <AppTextInput
                  style={styles.input}
                  value={contact}
                  onChangeText={setContact}
                  placeholder="Phone number"
                  placeholderTextColor={BLOOD_TEXT_MUTED}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.block}>
              <AppText style={styles.label}>
                Needed Within <AppText style={styles.req}>*</AppText>
              </AppText>
              <View style={styles.deadlineRow}>
                {ASK_BLOOD_URGENCY_OPTIONS.map((opt) => {
                  const active = urgencyId === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setUrgencyId(opt.id)}
                      style={[styles.deadlineChip, active && styles.deadlineChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <AppText
                        style={[styles.deadlineChipText, active && styles.deadlineChipTextActive]}
                      >
                        {opt.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.block}>
              <AppText style={styles.label}>Note (optional)</AppText>
              <View style={styles.field}>
                <AppTextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder="For: patient context"
                  placeholderTextColor={BLOOD_TEXT_MUTED}
                  autoCapitalize="sentences"
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleAsk}
              disabled={!canAsk}
              style={[styles.askBtn, !canAsk && styles.askBtnDisabled]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAsk }}
            >
              <Droplet size={ms(18)} color="#ffffff" fill="#ffffff" strokeWidth={2.2} />
              <AppText style={styles.askText}>{ASK_BLOOD_COPY.submitLabel}</AppText>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SlideUpSheet>
  );
});

export default AskBloodSheet;

const styles = StyleSheet.create({
  kav: {
    alignSelf: 'stretch',
    maxHeight: vs(520),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: vs(6),
    marginBottom: vs(4),
  },
  headerSpacer: {
    width: ms(36),
  },
  title: {
    flex: 1,
    fontSize: ms(17),
    fontWeight: '900',
    color: BLOOD_TEXT,
    textAlign: 'center',
    paddingHorizontal: hs(8),
  },
  closeBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: ms(12),
    color: BLOOD_TEXT_MUTED,
    textAlign: 'center',
    marginBottom: vs(12),
    paddingHorizontal: hs(12),
  },
  scroll: {
    alignSelf: 'stretch',
    flexGrow: 0,
  },
  scrollContent: {
    gap: vs(16),
    paddingBottom: vs(8),
  },
  block: {
    gap: vs(8),
  },
  label: {
    fontSize: ms(13),
    fontWeight: '700',
    color: BLOOD_TEXT,
  },
  req: {
    color: '#EF4444',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
  },
  stepBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(14),
    backgroundColor: BLOOD_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    backgroundColor: BLOOD_RED_DARK,
    opacity: 0.4,
  },
  unitsValue: {
    flex: 1,
    alignItems: 'center',
  },
  unitsValueText: {
    fontSize: ms(26),
    fontWeight: '900',
    color: BLOOD_TEXT,
  },
  unitsValueHint: {
    fontSize: ms(11),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '600',
  },
  field: {
    height: ms(48),
    borderRadius: BLOOD_RADII.chip,
    borderWidth: 1.5,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    paddingHorizontal: hs(14),
    justifyContent: 'center',
  },
  input: {
    fontSize: ms(14),
    fontWeight: '600',
    color: BLOOD_TEXT,
    paddingVertical: 0,
  },
  deadlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(8),
  },
  deadlineChip: {
    borderRadius: BLOOD_RADII.pill,
    borderWidth: 1.5,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    paddingHorizontal: hs(14),
    paddingVertical: vs(8),
  },
  deadlineChipActive: {
    borderColor: BLOOD_RED,
    backgroundColor: BLOOD_RED_SOFT,
  },
  deadlineChipText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: BLOOD_TEXT_MUTED,
  },
  deadlineChipTextActive: {
    color: BLOOD_RED,
    fontWeight: '900',
  },
  footer: {
    alignSelf: 'stretch',
    paddingTop: vs(12),
    marginTop: vs(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BLOOD_BORDER,
  },
  askBtn: {
    height: ms(52),
    borderRadius: BLOOD_RADII.pill,
    backgroundColor: BLOOD_RED,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: hs(8),
  },
  askBtnDisabled: {
    backgroundColor: BLOOD_RED_DARK,
    opacity: 0.45,
  },
  askText: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#ffffff',
  },
  successWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: vs(28),
    paddingHorizontal: hs(8),
    gap: vs(10),
  },
  successIcon: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    backgroundColor: BLOOD_RED_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(4),
  },
  successTitle: {
    fontSize: ms(18),
    fontWeight: '900',
    color: BLOOD_TEXT,
  },
  successMessage: {
    fontSize: ms(13),
    color: BLOOD_TEXT_MUTED,
    textAlign: 'center',
    lineHeight: vs(19),
  },
  doneBtn: {
    marginTop: vs(14),
    alignSelf: 'stretch',
    height: ms(52),
    borderRadius: BLOOD_RADII.pill,
    backgroundColor: BLOOD_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#ffffff',
  },
});
