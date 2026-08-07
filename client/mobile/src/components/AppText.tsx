import React from 'react';
import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import { resolveTextStyle } from '@/theme/fonts';

const AppText = React.forwardRef<Text, TextProps>(function AppText({ style, ...props }, ref) {
  return <Text ref={ref} {...props} style={resolveTextStyle(style)} />;
});

AppText.displayName = 'AppText';

export default AppText;
