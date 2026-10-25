#!/usr/bin/env node
/**
 * configure.js — the single JS <-> native configuration contract.
 *
 * Build-time values are generated into `src/lib/config.ts` (bundled by Metro in
 * debug, embedded by Gradle/Xcode in release). Release builds additionally
 * rewrite the Android network-security-config with the configured certificate
 * pins.
 *
 * Inputs are read from the process environment, then `.env.local`, then `.env`
 * (process env wins).
 *
 * Usage:
 *   node scripts/configure.js                  # debug / Metro
 *   CONFIGURE_RELEASE=1 node scripts/configure.js
 *
 * Nothing here is secret at rest: values are public client config. Never put
 * tokens or passwords in these variables.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB_DIR = path.join(ROOT, 'src', 'lib');
const CONFIG_FILE = path.join(LIB_DIR, 'config.ts');
const TRANSPORT_FILE = path.join(LIB_DIR, 'activeTransport.ts');
const VARIANT_FILE = path.join(LIB_DIR, 'appVariant.ts');
const NSC_FILE = path.join(
  ROOT,
  'android',
  'app',
  'src',
  'main',
  'res',
  'xml',
  'network_security_config.xml',
);
const MAPS_KEY_FILE = path.join(
  ROOT,
  'android',
  'app',
  'src',
  'main',
  'res',
  'values',
  'google_maps_api_key.xml',
);

/** Parse a dotenv file without adding a dependency. Missing file -> {}. */
function readEnvFile(file) {
  try {
    const out = {};
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

const fileEnv = {
  ...readEnvFile(path.join(ROOT, '.env')),
  ...readEnvFile(path.join(ROOT, '.env.local')),
};

function env(name) {
  const value = process.env[name];
  if (value !== undefined && value !== '') return value;
  return fileEnv[name] ?? '';
}

function flag(name) {
  return ['1', 'true', 'yes'].includes(String(env(name)).toLowerCase());
}

const gatewayUrl = env('GATEWAY_URL').replace(/\/+$/, '');
// Web Partner Portal origin loaded by the seller WebView shell. The portal owns the session
// (HttpOnly cookies), so this is the only seller-side endpoint the native shell talks to.
const webPortalUrl = env('WEB_PORTAL_URL').replace(/\/+$/, '');
// Server-only by default (MVP): an explicitly empty value still means "on"; set USE_GATEWAY=false
// or STRICT=false to opt out for a special build. A missing GATEWAY_URL leaves the app offline.
const useGateway = env('USE_GATEWAY') === '' ? true : flag('USE_GATEWAY');
const strict = env('STRICT') === '' ? true : flag('STRICT');
const devUser = env('DEV_USER').trim();
const googleMapsAndroidKey = env('GOOGLE_MAPS_API_KEY_ANDROID').trim();
const googleMapsIosKey = env('GOOGLE_MAPS_API_KEY_IOS').trim();
const googlePlacesKey = env('GOOGLE_PLACES_API_KEY').trim();
const appVariantRaw = env('APP_VARIANT').trim().toLowerCase();
const appVariant =
  appVariantRaw === 'delivery' || appVariantRaw === 'seller' ? appVariantRaw : 'customer';
const firebaseSetting = env('USE_FIREBASE_AUTH').trim().toLowerCase();
const useFirebaseAuth =
  appVariant === 'seller' ? false : firebaseSetting === '' || ['1', 'true', 'yes'].includes(firebaseSetting);
const isRelease = flag('CONFIGURE_RELEASE');
const requirePins = flag('REQUIRE_CERT_PINS');
const transport = isRelease ? 'embedded' : 'metro';

// Each product has its own Firebase app entry (distinct package/bundle id). The partner build
// must not silently reuse the customer config — Firebase rejects the mismatched package.
const GOOGLE_SERVICES_JSON = path.join(
  ROOT,
  'android',
  'app',
  appVariant === 'delivery'
    ? 'src/delivery/google-services.json'
    : appVariant === 'seller'
      ? 'src/seller/google-services.json'
      : 'google-services.json',
);
const GOOGLE_SERVICE_INFO_PLIST = path.join(
  ROOT,
  'ios',
  'Faazio',
  appVariant === 'delivery'
    ? 'GoogleService-Info-Delivery.plist'
    : appVariant === 'seller'
      ? 'GoogleService-Info-Seller.plist'
      : 'GoogleService-Info.plist',
);

const pins = String(env('CERT_PINS'))
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => p.replace(/^sha256\//i, ''));

if (gatewayUrl) {
  let parsed;
  try {
    parsed = new URL(gatewayUrl);
  } catch {
    fail(`GATEWAY_URL is not a valid URL: ${gatewayUrl}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    fail('GATEWAY_URL must be http(s).');
  }
  if (isRelease && parsed.protocol !== 'https:') {
    fail('Release builds require an https GATEWAY_URL (refusing to embed cleartext config).');
  }
}

if (webPortalUrl) {
  let parsed;
  try {
    parsed = new URL(webPortalUrl);
  } catch {
    fail(`WEB_PORTAL_URL is not a valid URL: ${webPortalUrl}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    fail('WEB_PORTAL_URL must be http(s).');
  }
  if (isRelease && parsed.protocol !== 'https:') {
    fail('Release builds require an https WEB_PORTAL_URL (the seller WebView refuses cleartext).');
  }
}
if (appVariant === 'seller' && !webPortalUrl) {
  const message =
    'Web Portal origin is not configured. Seller builds need WEB_PORTAL_URL ' +
    '(e.g. https://<portal-origin>; http://localhost:3000 for local Metro + portal dev).';
  if (isRelease) fail(message);
  warn(message);
}

for (const pin of pins) {
  // Android pin values are base64 of the certificate's SubjectPublicKeyInfo.
  if (!/^[A-Za-z0-9+/=]{40,}$/.test(pin)) {
    fail(`CERT_PINS contains an invalid SHA-256 pin: ${pin}`);
  }
}

if (isRelease && useGateway && pins.length === 0) {
  const message =
    'Release build has USE_GATEWAY=true but no CERT_PINS. Set CERT_PINS ' +
    '(comma-separated base64 SHA-256 SPKI pins) before shipping.';
  if (requirePins) fail(message);
  warn(message);
}

if (isRelease && useGateway && !useFirebaseAuth && appVariant !== 'seller') {
  fail(
    'Release build has USE_GATEWAY=true but USE_FIREBASE_AUTH=false. ' +
      'Real phone-OTP sessions are required — refusing to embed a mock-login build.',
  );
}
// All three products need the native Firebase app for FCM; customer additionally needs it for OTP.
const needsFirebaseConfig = useFirebaseAuth || appVariant === 'delivery' || appVariant === 'seller';
if (needsFirebaseConfig) {
  if (!fs.existsSync(GOOGLE_SERVICES_JSON)) {
    const message =
      `Missing Firebase native config: ${path.relative(ROOT, GOOGLE_SERVICES_JSON)}. ` +
      'Native Firebase (OTP / FCM) cannot initialize without it.';
    if (isRelease && useGateway) fail(message);
    warn(message);
  }
  // The iOS copy build phase hard-fails when the plist is missing, so an Android-only
  // release job is not blocked by the partner's iOS plist (supplied by a separate CI step).
  if (!fs.existsSync(GOOGLE_SERVICE_INFO_PLIST)) {
    warn(
      `Missing Firebase native config: ${path.relative(ROOT, GOOGLE_SERVICE_INFO_PLIST)}. ` +
        'The iOS build will fail until it is supplied.',
    );
  }
} else {
  warn('USE_FIREBASE_AUTH=false: phone OTP is disabled (dev-only mock login).');
}

function fail(message) {
  console.error(`[configure] ERROR: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[configure] WARNING: ${message}`);
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

const header = `// AUTO-GENERATED by scripts/configure.js — do not edit, do not commit.\n`;

write(
  CONFIG_FILE,
  `${header}
export const GATEWAY_URL = ${JSON.stringify(gatewayUrl)};
/**
 * Web Partner Portal origin for the seller WebView shell. Empty disables the seller app
 * (native auth was removed — the portal owns the HttpOnly session).
 */
export const WEB_PORTAL_URL = ${JSON.stringify(webPortalUrl)};
export const USE_GATEWAY = ${useGateway};
export const STRICT = ${strict};
export const DEV_USER = ${JSON.stringify(devUser)};
export const FIREBASE_AUTH_ENABLED = ${useFirebaseAuth};
export const CERT_PINS: readonly string[] = ${JSON.stringify(pins)};
export const IS_RELEASE_CONFIG = ${isRelease};
/** Restricted Google Maps SDK keys (native map rendering; Android needs the manifest resource). */
export const GOOGLE_MAPS_API_KEY_ANDROID = ${JSON.stringify(googleMapsAndroidKey)};
export const GOOGLE_MAPS_API_KEY_IOS = ${JSON.stringify(googleMapsIosKey)};
/** Restricted Places API (New) key for the address autocomplete proxy; empty disables suggestions. */
export const GOOGLE_PLACES_API_KEY = ${JSON.stringify(googlePlacesKey)};
`,
);

write(
  VARIANT_FILE,
  `${header}
/** 'delivery' selects the Delivery Partner root; 'seller' the Seller Partner root; else the SuperApp. */
export const APP_VARIANT: 'customer' | 'delivery' | 'seller' = ${JSON.stringify(appVariant)};
`,
);

write(
  TRANSPORT_FILE,
  `${header}
export type Transport = 'metro' | 'embedded';

/**
 * 'metro'    — debug shell, JS served by Metro over adb reverse / Wi-Fi.
 * 'embedded' — release shell, JS bundled and embedded in the binary.
 */
export const TRANSPORT: Transport = ${JSON.stringify(transport)};
`,
);

/**
 * Android Maps SDK key. The manifest references `@string/google_maps_api_key`;
 * writing an empty value keeps the build valid when maps are not configured
 * (the map renders blank, everything else works). The file is gitignored.
 */
write(
  MAPS_KEY_FILE,
  `<?xml version="1.0" encoding="utf-8"?>\n<!-- AUTO-GENERATED by scripts/configure.js -->\n<resources>\n  <string name="google_maps_api_key" translatable="false">${googleMapsAndroidKey}</string>\n</resources>\n`,
);

/**
 * Release-only: write the declarative Android pin set. Debug builds use the
 * committed debug override (cleartext to Metro only), so this never runs for
 * `npm run start` / `npm run android`.
 */
if (isRelease && fs.existsSync(path.dirname(NSC_FILE))) {
  const gatewayHost = gatewayUrl ? new URL(gatewayUrl).hostname : '';
  const portalHost = webPortalUrl ? new URL(webPortalUrl).hostname : '';

  const pinSet =
    pins.length > 0
      ? `    <pin-set>\n${pins
          .map((pin) => `      <pin digest="SHA-256">${pin}</pin>`)
          .join('\n')}\n    </pin-set>\n`
      : '';

  // The portal is a separate origin with its own (system-trusted) certificate — never reuse the
  // gateway pins for it. Cleartext is denied site-wide by base-config; the entry makes the
  // seller-WebView origin explicit for auditing.
  const gatewayConfig =
    gatewayHost && pins.length > 0
      ? `  <domain-config cleartextTrafficPermitted="false">\n    <domain includeSubdomains="true">${gatewayHost}</domain>\n${pinSet}  </domain-config>\n`
      : '';
  const portalConfig =
    portalHost && portalHost !== gatewayHost
      ? `  <domain-config cleartextTrafficPermitted="false">\n    <domain includeSubdomains="true">${portalHost}</domain>\n  </domain-config>\n`
      : '';
  const domainConfig = gatewayConfig + portalConfig;

  write(
    NSC_FILE,
    `<?xml version="1.0" encoding="utf-8"?>\n<!-- AUTO-GENERATED by scripts/configure.js for release builds. -->\n<network-security-config>\n  <base-config cleartextTrafficPermitted="false" />\n${domainConfig}</network-security-config>\n`,
  );
}

console.log(
  `[configure] app=${appVariant} transport=${transport} gateway=${gatewayUrl || '(mock)'} ` +
    `portal=${webPortalUrl || '(unconfigured)'} ` +
    `useGateway=${useGateway} strict=${strict} firebaseAuth=${useFirebaseAuth} pins=${pins.length}`,
);
