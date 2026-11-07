import React from 'react';
import { Text } from 'react-native';
import type { TextProps, TextStyle } from 'react-native';
import { resolveTextStyle } from '@/theme/fonts';
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
  { style, variant, tone, weight, ...props },
  ref,
) {
  const variantStyle = variant ? TYPE[variant] : undefined;
  const toneStyle = tone ? { color: TEXT[tone] } : undefined;
  const weightStyle = weight ? { fontWeight: WEIGHT[weight] } : undefined;

  return (
    <Text
      ref={ref}
      {...props}
      style={resolveTextStyle([variantStyle, toneStyle, weightStyle, style])}
    />
  );
});

AppText.displayName = 'AppText';

export default AppText;