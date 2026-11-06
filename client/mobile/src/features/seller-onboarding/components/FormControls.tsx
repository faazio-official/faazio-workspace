import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Camera, BadgeCheck } from 'lucide-react-native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, ms, vs } from '@/utils/responsive';
import { neutral, parentRamp } from '@/theme/brandTokens';

export interface TextInputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText?: (value: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'email-address';
  maxLength?: number;
  editable?: boolean;
}

export function TextInputField({
  label,
  placeholder,
  value,
  onChangeText,
  autoCapitalize,
  keyboardType,
  maxLength,
  editable = true,
}: TextInputFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <AppText style={styles.inputLabel}>{label}</AppText>
      <AppTextInput
        style={[styles.input, !editable && styles.inputReadOnly]}
        placeholder={placeholder}
        placeholderTextColor={neutral.inkSubtle}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={editable}
      />
    </View>
  );
}

export function DocumentRow({
  label,
  uri,
  optional = false,
  onCapture,
  onRemove,
}: {
  label: string;
  uri: string | null;
  optional?: boolean;
  onCapture: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.docRow}>
      <View style={[styles.docIcon, uri && styles.docIconDone]}>
        {uri ? (
          <BadgeCheck size={ms(18)} color={neutral.ink} strokeWidth={2.2} />
        ) : (
          <Camera size={ms(18)} color={parentRamp.base} strokeWidth={2.2} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={styles.docLabel}>{label}</AppText>
        <AppText style={styles.docStatus}>{uri ? 'Captured' : optional ? 'Optional' : 'Required'}</AppText>
      </View>
      <TouchableOpacity style={styles.docButton} onPress={uri ? onRemove : onCapture} activeOpacity={0.8}>
        <AppText style={styles.docButtonText}>{uri ? 'Retake' : 'Capture'}</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { marginTop: vs(12) },
  inputLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    color: neutral.inkSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: vs(6),
  },
  input: {
    height: Math.max(46, vs(46)),
    backgroundColor: neutral.surface,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    paddingHorizontal: hs(12),
    fontSize: ms(14),
    fontWeight: '600',
    color: neutral.ink,
  },
  inputReadOnly: { backgroundColor: '#EEF2F7', color: neutral.inkMuted },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingVertical: vs(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEF1F5',
  },
  docIcon: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(11),
    backgroundColor: parentRamp.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconDone: { backgroundColor: '#DCFCE7' },
  docLabel: { fontSize: ms(13), fontWeight: '800', color: neutral.ink },
  docStatus: { fontSize: ms(10.5), color: neutral.inkSubtle, marginTop: vs(2) },
  docButton: {
    paddingHorizontal: hs(12),
    paddingVertical: vs(8),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: neutral.border,
    backgroundColor: parentRamp.tint,
  },
  docButtonText: { fontSize: ms(11), fontWeight: '800', color: parentRamp.base },
});
