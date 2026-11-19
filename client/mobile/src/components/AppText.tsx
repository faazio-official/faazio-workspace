import React from 'react';
import { Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';
import { childrenContainTamil, resolveTextStyle } from '@/theme/fonts';
import { useLanguageStore } from '@/state/languageStore';
import { TEXT, TYPE, type TextTone, type TextVariant } from '@/theme/tokens';

export type AppTextWeight = 'regular' | 'medium' | 'semibold';

const WEIGHT: Record<AppTextWeight, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
};

export interface AppTextProps extends TextProps {
  /** Type scale role. Ignored when not provided, so existing styles keep working. */
  variant?: TextVariant;
  /** One of the three text roles, plus inverse for coloured surfaces. */
  tone?: TextTone;
  weight?: AppTextWeight;
}

const AppText = React.forwardRef<Text, AppTextProps>(function AppText(
  { style, variant, tone, weight, children, ...props },
  ref,
) {
  const language = useLanguageStore((s) => s.language);
  const variantStyle = variant ? TYPE[variant] : undefined;
  const toneStyle = tone ? { color: TEXT[tone] } : undefined;
  const weightStyle = weight ? { fontWeight: WEIGHT[weight] } : undefined;
  // Tamil selection switches every label to the Tamil face; children carrying Tamil code points
  // (a translated product or category name) get it even while the app runs in English.
  const useTamil = language === 'ta' || childrenContainTamil(children);

  return (
    <Text
      ref={ref}
      {...props}
      style={resolveTextStyle([variantStyle, toneStyle, weightStyle, style], useTamil)}
    >
      {children}
    </Text>
  );
});

AppText.displayName = 'AppText';

export default AppText;
