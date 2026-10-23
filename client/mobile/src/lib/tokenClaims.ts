/**
 * Client-side read of the gateway-verified Firebase ID token. Nothing here trusts the token
 * cryptographically — the server re-verifies it on every call — this only surfaces the partner
 * role/state claims the app already holds so admin UI can be gated client-side. `app_role` /
 * `state_code` travel top-level or under `app_metadata` (mirrors internal/platform/auth).
 *
 * Claims never touch logs; decode failures degrade to an empty object.
 */

export interface TokenClaims {
  /** Partner role claim (SELLER | DISTRICT_ADMIN | SUPER_ADMIN), uppercased. */
  role?: string;
  /** Partner district scope claim, uppercased (3-letter code, e.g. TCH). */
  districtCode?: string;
  /** Legacy parent state scope claim, uppercased (2-letter code). */
  stateCode?: string;
  /** Seller claim (SELLER logins only). */
  sellerId?: string;
  /** Firebase verified `phone_number` (E.164). */
  phone?: string;
  /** Firebase subject (`user_id`). */
  uid?: string;
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const BASE64URL_LOOKUP: Record<string, number> = {};
for (let i = 0; i < BASE64URL_ALPHABET.length; i++) {
  BASE64URL_LOOKUP[BASE64URL_ALPHABET[i]] = i;
}

function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b & 0x80) === 0) {
      out += String.fromCharCode(b);
    } else if ((b >> 5) === 0x6 && i + 1 < bytes.length) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[++i] & 0x3f));
    } else if ((b >> 4) === 0xe && i + 2 < bytes.length) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f),
      );
    } else if ((b >> 3) === 0x1e && i + 3 < bytes.length) {
      out += String.fromCharCode(
        ((b & 0x07) << 18) |
          ((bytes[++i] & 0x3f) << 12) |
          ((bytes[++i] & 0x3f) << 6) |
          (bytes[++i] & 0x3f),
      );
    }
  }
  return out;
}

function base64UrlToUtf8(b64: string): string {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of b64) {
    if (ch === '=') break;
    const v = BASE64URL_LOOKUP[ch];
    if (v === undefined) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return utf8Decode(new Uint8Array(bytes));
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export function decodeIdToken(token: string | null | undefined): TokenClaims {
  if (!token) return {};
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  let payload: string;
  try {
    payload = base64UrlToUtf8(parts[1]);
  } catch {
    return {};
  }
  try {
    const p = JSON.parse(payload) as Record<string, unknown>;
    const meta = (p.app_metadata ?? {}) as Record<string, unknown>;
    const role = asString(p.app_role) ?? asString(meta.app_role) ?? asString(meta.role);
    const state = asString(p.state_code) ?? asString(meta.state_code);
    const district = asString(p.district_code) ?? asString(meta.district_code);
    const seller = asString(p.seller_id) ?? asString(meta.seller_id);
    return {
      role: role?.toUpperCase(),
      stateCode: state?.toUpperCase(),
      districtCode: district?.toUpperCase(),
      sellerId: seller,
      phone: asString(p.phone_number),
      uid: asString(p.user_id) ?? asString(p.sub),
    };
  } catch {
    return {};
  }
}