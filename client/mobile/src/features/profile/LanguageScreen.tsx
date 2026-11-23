import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useLanguageStore } from '@/state/languageStore';
import { DEFAULT_LANGUAGE, LANGUAGES } from '@/lib/languages';

type Props = NativeStackScreenProps<RootStackParamList, 'Language'>;

/**
 * Language setting for the customer app. Device-local only (AsyncStorage via `languageStore`);
 * nothing is sent to the gateway. Switching takes effect immediately — `AppText`/`AppTextInput`
 * re-resolve the font family and every localized copy helper re-reads the store, so catalog copy
 * and Food/directory names switch language without a restart.
 *
 * The language is display-only: cart lines and order copy keep the canonical English name.
 */
export default function LanguageScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { palette } = useThemeMode();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const select = (id: string) => {
    if (id === language) return;
    setLanguage(id);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <View
        style={[styles.header, { paddingTop: insets.top + vs(12), backgroundColor: palette.card }]}
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
        <AppText style={[styles.headerTitle, { color: palette.text }]}>Language</AppText>
      </View>

      <View style={styles.content}>
        <AppText style={[styles.sectionTitle, { color: palette.textMuted }]}>App language</AppText>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {LANGUAGES.map((option, index) => {
            const selected = language === option.id;
            const isLast = index === LANGUAGES.length - 1;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.row,
                  !isLast && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: palette.border,
                  },
                  selected && { backgroundColor: palette.accentSoft },
                  index === 0 && styles.rowFirst,
                  isLast && styles.rowLast,
                ]}
                activeOpacity={0.7}
                onPress={() => select(option.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.native} (${option.english})`}
              >
                <View style={styles.text}>
                  <AppText style={[styles.title, { color: palette.text }]}>
                    {option.native}
                  </AppText>
                  <AppText style={[styles.subtitle, { color: palette.textMuted }]}>
                    {option.english}
                    {option.id === DEFAULT_LANGUAGE.id ? ' · Default' : ''}
                  </AppText>
                </View>
                {selected ? (
                  <Check size={ms(20)} color={palette.accent} strokeWidth={2.6} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

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
