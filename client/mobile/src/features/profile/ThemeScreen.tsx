import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Moon, Smartphone, Sun } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { useThemeMode } from '@/hooks/useThemeMode';
import type { ThemeMode } from '@/theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Theme'>;

interface Option {
  key: ThemeMode;
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const OPTIONS: Option[] = [
  { key: 'light', title: 'Light', subtitle: 'Always use the light appearance', Icon: Sun },
  { key: 'dark', title: 'Dark', subtitle: 'Always use the dark appearance', Icon: Moon },
  { key: 'auto', title: 'Auto', subtitle: 'Follow your device appearance', Icon: Smartphone },
];

/**
 * Appearance setting for the customer app. Device-local only (AsyncStorage);
 * nothing is sent to the gateway. Default is Light; Auto follows the OS live.
 */
export default function ThemeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { themeMode, effectiveMode, palette, setThemeMode } = useThemeMode();

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + vs(12), backgroundColor: palette.card },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(26)} color={palette.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <AppText style={[styles.headerTitle, { color: palette.text }]}>Appearance</AppText>
      </View>

      <View style={styles.content}>
        <AppText style={[styles.sectionTitle, { color: palette.textMuted }]}>Theme</AppText>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {OPTIONS.map((option, index) => {
            const selected = themeMode === option.key;
            const isLast = index === OPTIONS.length - 1;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.row,
                  !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
                  selected && { backgroundColor: palette.accentSoft },
                  index === 0 && styles.rowFirst,
                  isLast && styles.rowLast,
                ]}
                activeOpacity={0.7}
                onPress={() => setThemeMode(option.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.title}. ${option.subtitle}`}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: selected ? palette.card : palette.accentSoft },
                  ]}
                >
                  <option.Icon size={ms(18)} color={palette.accent} strokeWidth={2.2} />
                </View>
                <View style={styles.text}>
                  <AppText style={[styles.title, { color: palette.text }]}>{option.title}</AppText>
                  <AppText style={[styles.subtitle, { color: palette.textMuted }]}>
                    {option.subtitle}
                  </AppText>
                </View>
                {selected ? (
                  <Check size={ms(20)} color={palette.accent} strokeWidth={2.6} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <AppText style={[styles.footnote, { color: palette.textSubtle }]}>
          {themeMode === 'auto'
            ? `Following your device — currently ${effectiveMode}.`
            : 'Auto follows your device setting. Your choice is saved on this device.'}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.BLOCK,
  },
  backButton: {
    marginRight: hs(8),
    paddingVertical: vs(2),
  },
  headerTitle: {
    fontSize: ms(22),
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: hs(16),
    paddingTop: SPACE.SECTION,
  },
  sectionTitle: {
    fontSize: ms(12),
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginLeft: hs(4),
    marginBottom: SPACE.BLOCK,
  },
  card: {
    borderRadius: ms(16),
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(14),
    paddingHorizontal: hs(12),
  },
  rowFirst: {
    borderTopLeftRadius: ms(16),
    borderTopRightRadius: ms(16),
  },
  rowLast: {
    borderBottomLeftRadius: ms(16),
    borderBottomRightRadius: ms(16),
  },
  iconBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    marginLeft: hs(12),
    marginRight: hs(8),
  },
  title: {
    fontSize: ms(14),
    fontWeight: '600',
  },
  subtitle: {
    fontSize: ms(11.5),
    fontWeight: '400',
    marginTop: vs(2),
  },
  footnote: {
    fontSize: ms(12),
    lineHeight: ms(17),
    marginTop: SPACE.SECTION,
    marginHorizontal: hs(4),
  },
});
