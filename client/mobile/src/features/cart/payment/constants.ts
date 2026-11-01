import { parentRamp } from '@/theme/brandTokens';
/** Shared colour tokens for the Payment Options screen. */
export const BRAND = {
  /** Light gray screen background. */
  screenBg: '#F3F4F6',
  /** Ink / primary text. */
  ink: '#111827',
  /** Selected / pay accent. */
  green: '#12A34B',
  /** Add-new + promo accent. */
  orange: '#FF7A1A',
  /** Section titles. */
  section: '#374151',
  /** Subtle borders / separators. */
  border: '#EEF1F4',
  /** Destination dot / timeline. */
  blue: parentRamp.base,
} as const;
