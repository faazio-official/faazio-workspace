import React from 'react';
import { TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import { containsTamil, resolveTextStyle } from '@/theme/fonts';
import { useLanguageStore } from '@/state/languageStore';

const AppTextInput = React.forwardRef<TextInput, TextInputProps>(function AppTextInput(
  { style, value, placeholder, ...props },
  ref,
) {
  const language = useLanguageStore((s) => s.language);
  const useTamil =
    language === 'ta' ||
    (typeof value === 'string' && containsTamil(value)) ||
    (typeof placeholder === 'string' && containsTamil(placeholder));

  return (
    <TextInput
      ref={ref}
      {...props}
      value={value}
      placeholder={placeholder}
      style={resolveTextStyle(style, useTamil)}
    />
  );
});

AppTextInput.displayName = 'AppTextInput';

export default AppTextInput;
