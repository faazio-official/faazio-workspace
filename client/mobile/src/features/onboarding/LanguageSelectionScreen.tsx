import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { Search } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { Screen } from '@/components/shared';
import { useLanguageStore } from '@/state/languageStore';
import { hs, vs, ms } from '@/utils/responsive';

type Props = NativeStackScreenProps<RootStackParamList, 'LanguageSelection'>;

interface Language {
  id: string;
  native: string;
  english: string;
  avatar: string;
}

const SUGGESTED_LANGUAGE: Language = {
  id: 'en',
  native: 'English',
  english: 'English',
  avatar: 'EN',
};

const ALL_LANGUAGES: Language[] = [
  { id: 'hi', native: 'हिंदी', english: 'Hindi', avatar: 'हिं' },
  { id: 'bn', native: 'বাংলা', english: 'Bengali', avatar: 'বাং' },
  { id: 'te', native: 'తెలుగు', english: 'Telugu', avatar: 'తెలు' },
  { id: 'mr', native: 'मराठी', english: 'Marathi', avatar: 'मरा' },
  { id: 'ta', native: 'தமிழ்', english: 'Tamil', avatar: 'தமி' },
  { id: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada', avatar: 'ಕನ್ನ' },
  { id: 'ml', native: 'മലയാളം', english: 'Malayalam', avatar: 'മല' },
  { id: 'gu', native: 'ગુજરાતી', english: 'Gujarati', avatar: 'ગુજ' },
  { id: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi', avatar: 'ਪੰਜਾ' },
  { id: 'ur', native: 'اردو', english: 'Urdu', avatar: 'اردو' },
];

const ACCENT = '#7C3AED';
const ACCENT_LIGHT = '#EDE9FE';
const ACCENT_SOFT = '#F5F3FF';

export default function LanguageSelectionScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('en');
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const filteredLanguages = useMemo(() => {
    if (!searchQuery) return ALL_LANGUAGES;
    const lowerQuery = searchQuery.toLowerCase();
    return ALL_LANGUAGES.filter(
      (lang) =>
        lang.english.toLowerCase().includes(lowerQuery) ||
        lang.native.includes(lowerQuery)
    );
  }, [searchQuery]);

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
          <View style={styles.headerContainer}>
            <View style={styles.headerTextContainer}>
              <AppText style={styles.headerTitle}>Choose your language</AppText>
            </View>

            {/* Custom Illustration Block */}
            <View style={styles.illustrationContainer}>
              <View style={styles.darkBubble}>
                <AppText style={styles.darkBubbleText}>A</AppText>
                <View style={styles.darkBubbleTail} />
              </View>
              <View style={styles.lightBubble}>
                <AppText style={styles.lightBubbleText}>अ</AppText>
                <View style={styles.lightBubbleTail} />
              </View>
              {/* Decorative stars */}
              <AppText style={[styles.star, styles.starOne]}>✦</AppText>
              <AppText style={[styles.star, styles.starTwo]}>✦</AppText>
              <AppText style={[styles.star, styles.starThree]}>✦</AppText>
            </View>
          </View>

          {/* SEARCH BAR */}
          <View style={styles.searchContainer}>
            <Search size={ms(18)} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              onChangeText={setSearchQuery}
              placeholder="Search language"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              value={searchQuery}
            />
          </View>

          {/* SUGGESTED SECTION */}
          {!searchQuery && (
            <>
              <AppText style={styles.sectionTitleAccent}>Suggested</AppText>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelectedId(SUGGESTED_LANGUAGE.id)}
                style={[
                  styles.rowPill,
                  styles.suggestedPill,
                  selectedId === SUGGESTED_LANGUAGE.id && styles.rowPillSelected,
                ]}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.avatarCircle}>
                    <AppText style={styles.avatarTextAccent}>
                      {SUGGESTED_LANGUAGE.avatar}
                    </AppText>
                  </View>
                  <View>
                    <AppText style={styles.languageNativeText}>
                      {SUGGESTED_LANGUAGE.native}
                    </AppText>
                    <AppText style={styles.languageEnglishText}>
                      {SUGGESTED_LANGUAGE.english}
                    </AppText>
                  </View>
                </View>
                {selectedId === SUGGESTED_LANGUAGE.id ? (
                  <View style={styles.checkedCircle}>
                    <AppText style={styles.checkIcon}>✓</AppText>
                  </View>
                ) : (
                  <View style={styles.radioCircle} />
                )}
              </TouchableOpacity>
            </>
          )}

          {/* ALL LANGUAGES LIST */}
          <AppText style={styles.sectionTitleDark}>All Languages</AppText>
          {filteredLanguages.map((lang) => {
            const isSelected = selectedId === lang.id;

            return (
              <TouchableOpacity
                key={lang.id}
                activeOpacity={0.7}
                onPress={() => setSelectedId(lang.id)}
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
                    <AppText style={styles.checkIcon}>✓</AppText>
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
          <TouchableOpacity onPress={handleContinue} style={styles.continueButton}>
            <AppText style={styles.continueText}>Continue →</AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: hs(20), paddingTop: vs(20) },

  /* Header */
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vs(24),
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: hs(16),
    justifyContent: 'center',
    paddingTop: vs(8),
  },
  headerTitle: { fontSize: ms(22), fontWeight: '700', color: '#111827', marginBottom: vs(6) },

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
  star: { position: 'absolute', fontSize: ms(14) },
  starOne: { top: 0, right: 10, color: '#C4B5FD' },
  starTwo: { top: 10, right: -5, fontSize: ms(15), color: '#FCD34D' },
  starThree: { bottom: -5, left: 10, fontSize: ms(10), color: '#F59E0B' },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: ms(24),
    paddingHorizontal: hs(16),
    height: vs(48),
    marginBottom: vs(24),
  },
  searchIcon: { marginRight: hs(8) },
  searchInput: { flex: 1, fontSize: ms(15), color: '#111827' },

  /* Sections */
  sectionTitleAccent: {
    fontSize: ms(14),
    fontWeight: '700',
    color: ACCENT,
    marginBottom: vs(12),
  },
  sectionTitleDark: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#111827',
    marginBottom: vs(12),
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
    marginBottom: vs(12),
  },
  rowPillSelected: {
    backgroundColor: ACCENT_SOFT,
  },
  suggestedPill: {
    marginBottom: vs(24),
    borderRadius: ms(20),
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
  avatarTextAccent: { color: ACCENT, fontWeight: '700', fontSize: ms(14) },
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
  checkIcon: { color: '#FFFFFF', fontSize: ms(12), fontWeight: 'bold' },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: hs(20),
    paddingTop: vs(16),
    paddingBottom: Platform.OS === 'ios' ? vs(34) : vs(24),
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  continueButton: {
    backgroundColor: ACCENT,
    height: vs(54),
    borderRadius: ms(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { color: '#FFFFFF', fontSize: ms(16), fontWeight: '700' },
});
