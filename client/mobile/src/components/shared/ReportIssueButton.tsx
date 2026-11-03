import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Flag } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { reportIssue } from '@/services/errorReport';
import { ms, vs } from '@/utils/responsive';
import { parentRamp } from '@/theme/brandTokens';

/**
 * "Report issue" action for an honest error/empty state. Posts a PII-free diagnostic to the gateway
 * (POST /errors → ops.error_events) so a failed load is never silently dropped — the shopper can
 * flag it and it lands in the same sink as app crashes. `context` names the screen/action.
 */
export function ReportIssueButton({ context }: { context: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await reportIssue('Item could not be loaded', context);
    setBusy(false);
    setDone(true);
    setTimeout(() => setDone(false), 4000);
    Alert.alert(
      ok ? 'Logged. Thank you.' : 'Could not send the report right now.',
      ok
        ? 'The team can now see exactly what failed on this screen.'
        : 'Please check your connection and try again.',
    );
  };

  if (done) {
    return (
      <View style={styles.row}>
        <AppText style={[styles.text, styles.doneText]}>Logged. Thank you.</AppText>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Report this issue"
    >
      <Flag size={ms(13)} color={parentRamp.base} strokeWidth={2.2} />
      <AppText style={styles.text}>{busy ? 'Logging…' : 'Report issue'}</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    alignSelf: 'center',
    marginTop: vs(10),
    paddingHorizontal: ms(14),
    paddingVertical: vs(7),
    borderRadius: ms(18),
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  text: { fontSize: ms(12), fontWeight: '800', color: parentRamp.base },
  doneText: { color: '#15803D' },
});