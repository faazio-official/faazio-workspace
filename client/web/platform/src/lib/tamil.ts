/**
 * Tamil-only validation for the translation inputs the portal authors.
 *
 * Sellers write a Tamil copy of a product name/description, super admins the same for a category.
 * The field must not accept Latin (or any other script) text: a mistyped English word in a Tamil
 * column would surface as English copy in the Tamil app. The gateway re-validates — this keeps the
 * form honest before submit.
 */

const TAMIL_CHARS = /^[\u0B80-\u0BFF\s\d.,\-–—/()&%!?'"+:;]*$/;

/** True when every character is Tamil script, whitespace, a digit, or light punctuation. */
export function isTamilText(value: string): boolean {
  return TAMIL_CHARS.test(value);
}

/**
 * Returns an error message for a Tamil translation field, or null when it is acceptable.
 * Blank is valid — it means "not translated yet" and the app falls back to English.
 */
export function tamilFieldError(
  value: string,
  maxLength: number,
  label = "Tamil text",
): string | null {
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return `${label} must be ${maxLength} characters or fewer.`;
  if (trimmed && !isTamilText(trimmed)) return `${label}: use Tamil letters only.`;
  return null;
}
