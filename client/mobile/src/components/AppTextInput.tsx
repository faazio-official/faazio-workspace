import React from 'react';
import { TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import { resolveTextStyle } from '@/theme/fonts';

const AppTextInput = React.forwardRef<TextInput, TextInputProps>(function AppTextInput(
  { style, ...props },
  ref,
) {
  return <TextInput ref={ref} {...props} style={resolveTextStyle(style)} />;
});

AppTextInput.displayName = 'AppTextInput';

export default AppTextInput;
