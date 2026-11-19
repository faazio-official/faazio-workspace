import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { Check, ArrowRight, ChevronLeft } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { Screen } from '@/components/shared';
import { useLanguageStore } from '@/state/languageStore';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { parentRamp } from '@/theme/brandTokens';
import { TOUCH } from '@/theme/tokens';
import { LANGUAGES } from '@/lib/languages';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguageSelection'>;


const ACCENT = parentRamp.base;
const ACCENT_LIGHT = '#DBEAFE';
const ACCENT_SOFT = '#EFF6FF';

export default function LanguageSelectionScreen({ navigation }: Props) {
  const [selectedId, setSelectedId] = useState<string>('en');
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const languages = useMemo(() => LANGUAGES, []);

  const handleContinue = () => {
    setLanguage(selectedId);
    navigation.navigate('Location');
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flexContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
            >
              <ChevronLeft size={ms(22)} color="#111827" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerContainer}>
            <View style={styles.headerTextContainer}>
              <AppText style={styles.headerTitle}>Choose your language</AppText>
            </View>

            {/* Custom Illustration Block */}
            <View style={styles.illustrationContainer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.darkBubble}>
                <AppText style={styles.darkBubbleText}>A</AppText>
                <View style={styles.darkBubbleTail} />
              </View>
              <View style={styles.lightBubble}>
                <AppText style={styles.lightBubbleText}>अ</AppText>
                <View style={styles.lightBubbleTail} />
              </View>
            </View>
          </View>

          {/* LANGUAGE OPTIONS */}
          <AppText style={styles.sectionTitleDark}>Languages</AppText>
          {languages.map((lang) => {
            const isSelected = selectedId === lang.id;

            return (
              <TouchableOpacity
                key={lang.id}
                activeOpacity={0.7}
                onPress={() => setSelectedId(lang.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${lang.english}, ${isSelected ? 'selected' : 'not selected'}`}
                style={[styles.rowPill, isSelected && styles.rowPillSelected]}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.avatarCircle}>
                    <AppText style={styles.avatarTextAccentSmall}>
                      {lang.avatar}
                    </AppText>
                  </View>
                  <View>
                    <AppText style={styles.languageNativeText}>
                      {lang.native}
                    </AppText>
                    <AppText style={styles.languageEnglishText}>
                      {lang.english}
                    </AppText>
                  </View>
                </View>
                {isSelected ? (
                  <View style={styles.checkedCircle}>
                    <Check size={ms(14)} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                ) : (
                  <View style={styles.radioCircle} />
                )}
              </TouchableOpacity>
            );
          })}

          {/* Bottom Padding for scroll area */}
          <View style={{ height: vs(100) }} />
        </ScrollView>

        {/* STICKY FOOTER */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleContinue}
            style={styles.continueButton}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <AppText style={styles.continueText}>Continue</AppText>
            <ArrowRight size={ms(18)} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: hs(20), paddingTop: SPACE.SECTION },

  navRow: { marginBottom: vs(4) },
  backButton: {
    width: TOUCH.min,
    height: TOUCH.min,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  /* Header */
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACE.SECTION,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: hs(16),
    justifyContent: 'center',
    paddingTop: vs(8),
  },
  headerTitle: { fontSize: ms(22), fontWeight: '600', color: '#111827', marginBottom: vs(6) },

  /* Illustration Block */
  illustrationContainer: { width: hs(60), height: vs(60), position: 'relative' },
  darkBubble: {
    position: 'absolute',
    top: vs(5),
    left: 0,
    backgroundColor: ACCENT,
    paddingHorizontal: hs(10),
    paddingVertical: vs(6),
    borderRadius: ms(8),
    zIndex: 1,
  },
  darkBubbleText: { color: '#FFFFFF', fontSize: ms(16), fontWeight: 'bold' },
  darkBubbleTail: {
    position: 'absolute',
    bottom: -4,
    left: 8,
    width: 8,
    height: 8,
    backgroundColor: ACCENT,
    transform: [{ rotate: '45deg' }],
  },
  lightBubble: {
    position: 'absolute',
    bottom: vs(5),
    right: 0,
    backgroundColor: ACCENT_LIGHT,
    paddingHorizontal: hs(10),
    paddingVertical: vs(6),
    borderRadius: ms(8),
    zIndex: 2,
  },
  lightBubbleText: { color: ACCENT, fontSize: ms(16), fontWeight: 'bold' },
  lightBubbleTail: {
    position: 'absolute',
    bottom: -4,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: ACCENT_LIGHT,
    transform: [{ rotate: '45deg' }],
  },

  /* Sections */
  sectionTitleDark: {
    fontSize: ms(14),
    fontWeight: '600',
    color: '#111827',
    marginBottom: SPACE.BLOCK,
    marginTop: vs(8),
  },

  /* Soft semi-pilled rows */
  rowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: ms(16),
    paddingHorizontal: hs(16),
    paddingVertical: vs(14),
    marginBottom: SPACE.ITEM,
  },
  rowPillSelected: {
    backgroundColor: ACCENT_SOFT,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },

  /* Avatars */
  avatarCircle: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(16),
  },
  avatarTextAccentSmall: { color: ACCENT, fontWeight: '600', fontSize: ms(12) },

  /* Text styling */
  languageNativeText: { fontSize: ms(15), fontWeight: '600', color: '#111827', marginBottom: vs(2) },
  languageEnglishText: { fontSize: ms(13), color: '#6B7280' },

  /* Radio & Check */
  radioCircle: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  checkedCircle: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: hs(20),
    paddingTop: vs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  continueButton: {
    backgroundColor: ACCENT,
    minHeight: TOUCH.min,
    height: vs(54),
    borderRadius: ms(30),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueText: { color: '#FFFFFF', fontSize: ms(16), fontWeight: '600' },
});
