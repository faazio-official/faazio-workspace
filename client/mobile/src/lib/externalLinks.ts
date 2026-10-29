import { Linking } from 'react-native';

/**
 * Restricts `Linking.openURL` for web links to Faazio's own domain. Legal/support
 * pages open in the system browser; anything else is refused rather than handed to
 * an untrusted destination (defends against a tampered URL string reaching the OS).
 */
const TRUSTED_HOSTS = ['faazio.com'];

/** True only for `https://` URLs whose host is `faazio.com` or a `*.faazio.com` subdomain. */
export function isTrustedUrl(raw: string): boolean {
  const trimmed = raw.trim();
  const scheme = 'https://';
  if (!trimmed.toLowerCase().startsWith(scheme)) return false;

  const authority = trimmed.slice(scheme.length).split(/[/?#]/, 1)[0] ?? '';
  if (!authority || authority.includes('@')) return false;

  const host = authority.replace(/:\d+$/, '').toLowerCase();
  return TRUSTED_HOSTS.some((trusted) => host === trusted || host.endsWith(`.${trusted}`));
}

/**
 * Opens an `https://faazio.com` URL in the system browser. Returns `false` (and
 * opens nothing) when the URL is not on an allowed host or cannot be opened.
 */
export async function openTrustedUrl(raw: string): Promise<boolean> {
  if (!isTrustedUrl(raw)) return false;
  try {
    await Linking.openURL(raw);
    return true;
  } catch {
    return false;
  }
}
