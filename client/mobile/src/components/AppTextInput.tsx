import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { resolveTextStyle } from '@/theme/fonts';
import InfoButton from '@/components/shared/InfoButton';
import { hs } from '@/utils/responsive';

type AppTextInputProps = TextInputProps & {
  /** Opt-in registry key that renders a small "i" guidance badge beside the input. */
  infoKey?: string;
};

const AppTextInput = React.forwardRef<TextInput, AppTextInputProps>(function AppTextInput(
  { style, infoKey, ...props },
  ref,
) {
  const input = <TextInput ref={ref} {...props} style={resolveTextStyle(style)} />;
  if (!infoKey) return input;
  return (
    <View style={styles.row}>
      {input}
      <InfoButton variant="badge" contentKey={infoKey} />
    </View>
  );
});

AppTextInput.displayName = 'AppTextInput';

export default AppTextInput;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
});