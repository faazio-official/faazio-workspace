import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView as NativeWebView } from 'react-native-webview';
import type { WebViewNavigation, WebViewProps } from 'react-native-webview';
import { WEB_PORTAL_URL } from '@/lib/config';
import { FaazioLogo } from '@/components/FaazioLogo';
import { OfflinePage } from '@/components/shared/OfflinePage';
import { getSellerPushToken, startSellerPush } from '@/services/sellerPush';
import { ms, vs } from '@/utils/responsive';
import { parentRamp } from '@/theme/brandTokens';

type WebViewHandle = {
  injectJavaScript: (script: string) => void;
  goBack: () => void;
  clearCache: (includeDiskFiles: boolean) => void;
};

// react-native-webview's class default generic (`P = undefined`) collapses its props to `never`
// under the repo's TS config; this wrapper keeps the real props/ref surface.
const WebView = NativeWebView as unknown as React.ComponentType<
  WebViewProps & React.RefAttributes<WebViewHandle>
>;

const portalBase = WEB_PORTAL_URL.replace(/\/+$/, '');

/** Permission kinds the portal may request through the bridge (`window.__faazioRequestPermission`). */
type PermissionKind = 'camera' | 'location' | 'notifications' | 'storage';

interface PermissionResult {
  requestId: string;
  kind: PermissionKind;
  granted: boolean;
  status: 'granted' | 'denied' | 'blocked' | 'handled-by-webview';
}

type AndroidPermission =
  (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];

const ANDROID_PERMISSIONS: Record<PermissionKind, AndroidPermission[]> = {
  camera: [PermissionsAndroid.PERMISSIONS.CAMERA],
  location: [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ],
  notifications: [PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS],
  // The system photo picker (API 33+) needs no storage permission; legacy devices still do.
  storage:
    Number(Platform.Version) >= 33
      ? []
      : [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE],
};

function isPermissionKind(value: unknown): value is PermissionKind {
  return (
    value === 'camera' ||
    value === 'location' ||
    value === 'notifications' ||
    value === 'storage'
  );
}

/**
 * Ask the OS for a permission the portal needs. iOS WKWebView owns camera/mic/location prompts via
 * its own Info.plist strings, so native only reports "handled-by-webview" and lets the prompt show.
 */
async function requestNativePermission(
  requestId: string,
  kind: PermissionKind,
): Promise<PermissionResult> {
  if (Platform.OS !== 'android') {
    return { requestId, kind, granted: true, status: 'handled-by-webview' };
  }
  const permissions = ANDROID_PERMISSIONS[kind];
  if (permissions.length === 0) {
    return { requestId, kind, granted: true, status: 'granted' };
  }
  let granted = true;
  for (const permission of permissions) {
    if (await PermissionsAndroid.check(permission)) continue;
    const result = await PermissionsAndroid.request(permission);
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      granted = false;
      break;
    }
  }
  return {
    requestId,
    kind,
    granted,
    status: granted ? 'granted' : 'denied',
  };
}

// Last vendor the seller shell was on (persisted natively) so a cold start can re-open the portal
// scoped to the same shop via window.__faazio.vendorId before the console hydrates.
const LAST_VENDOR_KEY = 'faazio.seller.lastVendorId';

// Portal → native announcement when the seller switches the active shop inside the console. We
// mirror it into LAST_VENDOR_KEY so a cold start re-opens the portal on the newly chosen shop.
const VENDOR_CHANGE_EVENT = 'faazio:vendor-change';

// Portal → native announcement once the portal's session restore has settled (signed in or out).
// It is the real auth boundary: the first painted page is `/login` even for a signed-in seller,
// and the redirect to `/seller/*` happens client-side afterwards.
const AUTH_RESOLVED_EVENT = 'faazio:auth-resolved';

// The portal owns the seller session, so its first painted page is usually `/login` while the
// client-side JS checks the HttpOnly cookie and redirects to `/seller/*`. Announcing readiness on
// that first paint flashes the login page; instead we wait for the seller route and fall back after
// this bound so a genuinely signed-out seller is not pinned on the splash.
const PORTAL_AUTH_RESOLVE_TIMEOUT_MS = 5000;

function portalOrigin(): { protocol: string; host: string } | null {
  if (!portalBase) return null;
  try {
    const url = new URL(portalBase);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return { protocol: url.protocol, host: url.host };
  } catch {
    return null;
  }
}

function isPortalUrl(raw: string): boolean {
  const origin = portalOrigin();
  if (!origin || raw === 'about:blank') return raw === 'about:blank';
  try {
    const url = new URL(raw);
    return url.protocol === origin.protocol && url.host === origin.host;
  } catch {
    return false;
  }
}

function isAdminPath(raw: string): boolean {
  if (!isPortalUrl(raw)) return false;
  try {
    return new URL(raw).pathname.startsWith('/admin');
  } catch {
    return false;
  }
}

function isSellerPath(raw: string): boolean {
  if (!isPortalUrl(raw)) return false;
  try {
    return new URL(raw).pathname.startsWith('/seller');
  } catch {
    return false;
  }
}

function openExternal(raw: string): void {
  if (!/^(https?:|mailto:|tel:|upi:|intent:)/i.test(raw)) return;
  void Linking.openURL(raw).catch(() => undefined);
}

/**
 * Seller Partner shell: the web partner portal owns the entire seller UI and session (HttpOnly
 * cookies). Native only supplies safe-area/status-bar chrome, external-link handling, hardware
 * back, push-token injection and notification deep links. No native auth token is stored.
 */
interface SellerWebViewScreenProps {
  /**
   * Fired once the portal's auth has resolved — it navigated to a `/seller/*` route (session
   * confirmed) or the bounded fallback elapsed / the portal failed. The root drops the branded
   * layer-2 splash then. Only the first outcome counts, so a later retry never re-shows the splash.
   */
  onPortalReady?: () => void;
}

export function SellerWebViewScreen({ onPortalReady }: SellerWebViewScreenProps = {}) {
  const webviewRef = useRef<WebViewHandle>(null);
  const canGoBack = useRef(false);
  const loaded = useRef(false);
  const wasInPortal = useRef(false);
  const portalAuthResolved = useRef(false);
  const pendingOrder = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const origin = useMemo(portalOrigin, []);
  const announceReady = useCallback(() => {
    onPortalReady?.();
  }, [onPortalReady]);

  // The portal is "ready" for splash purposes only once the seller session has resolved. A signed-in
  // seller lands on `/seller/*` after the portal's client-side redirect; a signed-out seller stays on
  // `/login`, so the timeout releases the splash instead of pinning it.
  const announceAuthResolved = useCallback(() => {
    if (portalAuthResolved.current) return;
    portalAuthResolved.current = true;
    announceReady();
  }, [announceReady]);

  // Restore the last active vendor so every portal (re)load opens scoped to the same shop.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(LAST_VENDOR_KEY)
      .then((stored) => {
        if (alive && stored) setVendorId(stored);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Go straight to the seller sign-in. The portal middleware bounces unauthenticated
  // /seller/* → /login itself, so loading /login avoids ever painting the dashboard shell.
  const portalUrl = `${portalBase}/login`;
  const originWhitelist = useMemo(
    () =>
      origin
        ? [`${origin.protocol}//${origin.host}`, `${origin.protocol}//${origin.host}/*`]
        : [],
    [origin],
  );

  // Before the portal hydrates: app/platform/webview native-shell identity plus the last active
  // vendor (window.__faazio.vendorId) so the console opens on the right shop after a reload.
  const appContextScript = useMemo(() => {
    const vendor = vendorId ? `,vendorId:${JSON.stringify(vendorId)}` : '';
    return `window.__faazio=Object.assign({},window.__faazio,{app:'seller',platform:${
      Platform.OS === 'ios' ? "'ios'" : "'android'"
    },webview:true${vendor}});true;`;
  }, [vendorId]);

  const inject = useCallback((script: string) => {
    webviewRef.current?.injectJavaScript(`${script};true;`);
  }, []);

  const injectToken = useCallback(
    (token: string | null) => {
      if (!token) return;
      inject(
        `window.__faazioPushToken=${JSON.stringify(token)};` +
          `window.__faazioPushPlatform=${JSON.stringify(Platform.OS === 'ios' ? 'ios' : 'android')};` +
          "window.dispatchEvent(new Event('faazio-push-token'));",
      );
    },
    [inject],
  );

  // Bridge: the portal posts `{type, ...}` messages and native answers with CustomEvents on window.
  //  - `faazio:auth-resolved` → the portal's session restore settled; drop the layer-2 splash.
  //  - `faazio:permission` → asks the OS for camera/location/notifications/storage; the portal never
  //    sees a fake grant.
  //  - `faazio:vendor-change` → the seller switched the active shop in the console; persist the new
  //    vendor natively so a cold start reopens on it.
  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (!payload || typeof payload !== 'object') return;
      const message = payload as Record<string, unknown>;
      if (message['type'] === AUTH_RESOLVED_EVENT) {
        announceAuthResolved();
        return;
      }
      if (message['type'] === VENDOR_CHANGE_EVENT) {
        const storeId = typeof message['storeId'] === 'string' ? message['storeId'] : '';
        if (storeId) {
          setVendorId(storeId);
          AsyncStorage.setItem(LAST_VENDOR_KEY, storeId).catch(() => undefined);
        }
        return;
      }
      if (message['type'] !== 'faazio:permission') return;
      const requestId = typeof message['requestId'] === 'string' ? message['requestId'] : '';
      const kind = message['kind'];
      if (!requestId || !isPermissionKind(kind)) return;
      void requestNativePermission(requestId, kind)
        .then((result) => {
          inject(
            `window.dispatchEvent(new CustomEvent('faazio-permission-result',{detail:${JSON.stringify(
              result,
            )}}));`,
          );
        })
        .catch(() => {
          const denied: PermissionResult = {
            requestId,
            kind,
            granted: false,
            status: 'denied',
          };
          inject(
            `window.dispatchEvent(new CustomEvent('faazio-permission-result',{detail:${JSON.stringify(
              denied,
            )}}));`,
          );
        });
    },
    [announceAuthResolved, inject],
  );

  const openOrder = useCallback(
    (orderId: string | null, storeId?: string | null) => {
      if (!orderId) return;
      // When the push carries the order's vendor, remember it natively AND set the portal's vendor
      // context before landing (window.__faazio.vendorId) so the console opens scoped to the shop.
      if (storeId) {
        setVendorId(storeId);
        AsyncStorage.setItem(LAST_VENDOR_KEY, storeId).catch(() => undefined);
        inject(`window.__faazio=Object.assign({},window.__faazio,{vendorId:${JSON.stringify(storeId)}});true;`);
      }
      const target = `${portalBase}/seller/orders/${encodeURIComponent(orderId)}`;
      if (webviewRef.current && loaded.current) {
        inject(`window.location.assign(${JSON.stringify(target)});`);
      } else {
        pendingOrder.current = target;
      }
    },
    [inject],
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;
    void startSellerPush({
      onOrder: openOrder,
      onToken: (token) => injectToken(token),
    }).then((dispose) => {
      if (active) cleanup = dispose;
      else dispose();
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, [injectToken, openOrder]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current) {
        webviewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, []);

  const onNavigationChange = useCallback(
    (nav: WebViewNavigation) => {
      canGoBack.current = nav.canGoBack;
      let path = '';
      try {
        path = new URL(nav.url).pathname;
      } catch {
        path = nav.url;
      }
      // Defense-in-depth: even if a client-side redirect slips past the portal guard, never leave the
      // seller shell sitting on an admin route.
      if (path.startsWith('/admin')) {
        setBlocked(true);
      }
      if (path.startsWith('/seller')) {
        wasInPortal.current = true;
        // The portal has navigated past the sign-in page: the seller session is resolved, so the
        // branded splash can hand over to the dashboard without flashing the login page.
        announceAuthResolved();
      } else if (path === '/login' && wasInPortal.current) {
        wasInPortal.current = false;
        webviewRef.current?.clearCache(true);
      }
    },
    [announceAuthResolved],
  );

  // Fallback: a signed-out seller stays on `/login`, so release the splash after a bound instead of
  // pinning it forever. No-op when auth already resolved.
  useEffect(() => {
    const timeout = setTimeout(announceAuthResolved, PORTAL_AUTH_RESOLVE_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [announceAuthResolved]);

  const retry = useCallback(() => {
    setError(null);
    setBlocked(false);
    setLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  // A missing portal origin paints its own state — never hold the branded splash over it.
  useEffect(() => {
    if (!origin) announceReady();
  }, [origin, announceReady]);

  if (!origin) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.state}>
          <FaazioLogo size={30} />
          <Text style={styles.title}>Portal not configured</Text>
          <Text style={styles.body}>
            This build is missing WEB_PORTAL_URL. Set it before building the seller app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WebView
        key={reloadKey}
        ref={webviewRef}
        source={{ uri: portalUrl }}
        injectedJavaScriptBeforeContentLoaded={appContextScript}
        originWhitelist={originWhitelist}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        geolocationEnabled
        allowsBackForwardNavigationGestures
        onLoadStart={() => {
          loaded.current = false;
          setLoading(true);
        }}
        onLoadEnd={(event: { nativeEvent: { url?: string } }) => {
          loaded.current = true;
          setLoading(false);
          // `onLoadEnd` fires for the first painted page, which for a returning seller is `/login`
          // (the portal redirects client-side afterwards). Only a `/seller/*` load means the session
          // already resolved — otherwise leave the splash up until the navigation change or timeout.
          if (isSellerPath(event.nativeEvent.url ?? '')) announceAuthResolved();
          injectToken(getSellerPushToken());
          if (pendingOrder.current) {
            const target = pendingOrder.current;
            pendingOrder.current = null;
            inject(`window.location.assign(${JSON.stringify(target)});`);
          }
        }}
        onError={(event: { nativeEvent: { description?: string } }) => {
          loaded.current = false;
          setLoading(false);
          setError(event.nativeEvent.description || 'The portal could not be loaded.');
          announceAuthResolved();
        }}
        onHttpError={(event: { nativeEvent: { statusCode: number } }) => {
          if (event.nativeEvent.statusCode >= 500) {
            setError(`The portal returned ${event.nativeEvent.statusCode}.`);
            announceAuthResolved();
          }
        }}
        onMessage={onMessage}
        onNavigationStateChange={onNavigationChange}
        onShouldStartLoadWithRequest={(request: { url: string }) => {
          if (isPortalUrl(request.url)) {
            if (isAdminPath(request.url)) {
              setBlocked(true);
              return false;
            }
            return true;
          }
          openExternal(request.url);
          return false;
        }}
        style={styles.webview}
      />
      {loading && !blocked ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="small" color={parentRamp.base} />
        </View>
      ) : null}
      {blocked ? (
        <View style={styles.state}>
          <FaazioLogo size={30} />
          <Text style={styles.title}>Not available in the Faazio Seller app</Text>
          <Text style={styles.body}>This section is limited to seller tools.</Text>
          <Pressable onPress={retry} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        </View>
      ) : null}
      {error && !blocked ? (
        <View style={styles.offlineOverlay}>
          <OfflinePage onRetry={retry} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  webview: { flex: 1, backgroundColor: '#f8fafc' },
  loading: {
    position: 'absolute',
    top: vs(14),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  state: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(28),
    gap: vs(10),
    backgroundColor: '#f8fafc',
  },
  offlineOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#ffffff',
  },
  title: { fontSize: ms(18), fontWeight: '900', color: '#0f172a', textAlign: 'center' },
  body: { fontSize: ms(13), lineHeight: ms(19), color: '#64748b', textAlign: 'center' },
  button: {
    marginTop: vs(8),
    paddingHorizontal: ms(20),
    paddingVertical: vs(10),
    borderRadius: ms(10),
    backgroundColor: parentRamp.base,
  },
  buttonText: { fontSize: ms(13), fontWeight: '800', color: '#fff' },
});
