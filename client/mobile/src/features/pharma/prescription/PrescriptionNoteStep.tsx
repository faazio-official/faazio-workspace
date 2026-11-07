import React, { memo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChevronLeft, FileText } from 'lucide-react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, ms, vs } from '@/utils/responsive';
import { brandRamp, neutral } from '@/theme/brandTokens';

interface PrescriptionNoteStepProps {
  initialNote: string;
  photos: string[];
  onBack: () => void;
  onNext: (note: string) => void;
}

const PLACEHOLDER =
  'Add details for the pharmacist — doctor name, dosage instructions, allergies, generic preference…';

const PrescriptionNoteStep = memo(function PrescriptionNoteStep({
  initialNote,
  photos,
  onBack,
  onNext,
}: PrescriptionNoteStepProps) {
  const [note, setNote] = useState(initialNote);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(20)} color={neutral.ink} strokeWidth={1.75} />
        </TouchableOpacity>
        <AppText style={styles.topTitle}>Add a note</AppText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Thumbnail recap */}
        <View style={styles.recapRow}>
          {photos.map((uri, idx) => (
            <Image key={`${uri}-${idx}`} source={{ uri }} style={styles.recapThumb} />
          ))}
          <View style={styles.recapCount}>
            <AppText style={styles.recapCountText}>{photos.length} pages</AppText>
          </View>
        </View>

        {/* Note input */}
        <View style={styles.noteCard}>
          <View style={styles.noteHeader}>
            <FileText size={ms(16)} color={brandRamp.PHARMA.deep} strokeWidth={1.75} />
            <AppText style={styles.noteTitle}>Add details for the pharmacist</AppText>
          </View>
          <AppTextInput
            style={styles.noteInput}
            placeholder={PLACEHOLDER}
            placeholderTextColor="#94A3B8"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            accessibilityLabel="Note for the pharmacist"
          />
          <AppText style={styles.noteHint}>Optional — skip if the prescription says it all.</AppText>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={() => onNext(note)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Continue to choose a pharmacy"
        >
          <AppText style={styles.continueText}>Continue</AppText>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
});

export default PrescriptionNoteStep;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: neutral.card,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    borderBottomWidth: 1,
    borderBottomColor: neutral.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: neutral.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: ms(15),
    fontWeight: '600',
    color: neutral.ink,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: hs(16),
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginBottom: vs(16),
  },
  recapThumb: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(8),
    backgroundColor: neutral.surfaceAlt,
  },
  recapCount: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
    backgroundColor: brandRamp.PHARMA.tint,
    borderRadius: ms(8),
  },
  recapCountText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: brandRamp.PHARMA.deep,
  },
  noteCard: {
    backgroundColor: neutral.surface,
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: neutral.border,
    padding: hs(16),
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginBottom: vs(12),
  },
  noteTitle: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.ink,
  },
  noteInput: {
    minHeight: vs(120),
    backgroundColor: neutral.card,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    padding: hs(12),
    fontSize: ms(13),
    lineHeight: vs(20),
    color: neutral.ink,
  },
  noteHint: {
    fontSize: ms(10),
    fontWeight: '600',
    color: neutral.inkMuted,
    marginTop: vs(8),
  },
  footer: {
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    borderTopWidth: 1,
    borderTopColor: neutral.border,
  },
  continueBtn: {
    height: vs(50),
    borderRadius: ms(12),
    backgroundColor: brandRamp.PHARMA.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
