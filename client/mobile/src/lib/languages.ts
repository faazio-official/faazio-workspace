/**
 * The languages the app ships. Exactly two: English (the default) and Tamil. Consumed by the
 * onboarding picker and the Account → Language screen so the list exists once.
 *
 * `id` is stored by `languageStore` (AsyncStorage `faazio:selectedLanguage`) and read by the font
 * and catalog-copy resolvers, so it must stay in sync with `TAMIL_LANGUAGE` in `lib/localizedText`.
 */
export interface AppLanguage {
  id: string;
  /** Name in its own script — what the picker shows as the row title. */
  native: string;
  english: string;
  avatar: string;
}

export const DEFAULT_LANGUAGE: AppLanguage = {
  id: 'en',
  native: 'English',
  english: 'English',
  avatar: 'EN',
};

export const OTHER_LANGUAGES: AppLanguage[] = [
  { id: 'ta', native: 'தமிழ்', english: 'Tamil', avatar: 'தமி' },
];

export const LANGUAGES: AppLanguage[] = [DEFAULT_LANGUAGE];

/** Display label for the selected language, e.g. "தமிழ் (Tamil)" or "English". */
export function languageLabel(id: string): string {
  const match = LANGUAGES.find((l) => l.id === id);
  if (!match) return DEFAULT_LANGUAGE.native;
  return match.id === DEFAULT_LANGUAGE.id ? match.native : `${match.native} (${match.english})`;
}
