import React, { memo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { ChevronLeft, FileText } from 'lucide-react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import InfoButton from '@/components/shared/InfoButton';
import { hs, ms, vs } from '@/utils/responsive';
import { PHARMA_TEAL, PHARMA_INK } from '../mocks/pharmaHomeFeed';

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
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <ChevronLeft size={ms(20)} color={PHARMA_INK} strokeWidth={2.6} />
        </TouchableOpacity>
        <AppText style={styles.topTitle}>Add a Note</AppText>
        <InfoButton contentKey="PrescriptionFlow" />
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
            <FileText size={ms(16)} color={PHARMA_TEAL} strokeWidth={2} />
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
          />
          <AppText style={styles.noteHint}>Optional — skip if the prescription says it all.</AppText>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={() => onNext(note)}
          activeOpacity={0.9}
        >
          <AppText style={styles.continueText}>Continue</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default PrescriptionNoteStep;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: ms(15),
    fontWeight: '800',
    color: PHARMA_INK,
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
    backgroundColor: '#F1F5F9',
  },
  recapCount: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
    backgroundColor: '#E0F2F1',
    borderRadius: ms(8),
  },
  recapCountText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: PHARMA_TEAL,
  },
  noteCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
    fontWeight: '800',
    color: PHARMA_INK,
  },
  noteInput: {
    minHeight: vs(120),
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: hs(12),
    fontSize: ms(13),
    lineHeight: vs(20),
    color: PHARMA_INK,
  },
  noteHint: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: vs(8),
  },
  footer: {
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  continueBtn: {
    height: vs(50),
    borderRadius: ms(12),
    backgroundColor: PHARMA_TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
