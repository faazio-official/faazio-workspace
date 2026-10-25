import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView as NativeWebView } from 'react-native-webview';
import type { WebViewNavigation, WebViewProps } from 'react-native-webview';
import { WEB_PORTAL_URL } from '@/lib/config';
import { getSellerPushToken, startSellerPush } from '@/services/sellerPush';
import { ms, vs } from '@/utils/responsive';

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

function openExternal(raw: string): void {
  if (!/^(https?:|mailto:|tel:|upi:|intent:)/i.test(raw)) return;
  void Linking.openURL(raw).catch(() => undefined);
}

/**
 * Seller Partner shell: the web partner portal owns the entire seller UI and session (HttpOnly
 * cookies). Native only supplies safe-area/status-bar chrome, external-link handling, hardware
 * back, push-token injection and notification deep links. No native auth token is stored.
 */
export function SellerWebViewScreen() {
  const webviewRef = useRef<WebViewHandle>(null);
  const canGoBack = useRef(false);
  const loaded = useRef(false);
  const wasInPortal = useRef(false);
  const pendingOrder = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const origin = useMemo(portalOrigin, []);

  const portalUrl = `${portalBase}/seller`;
  const originWhitelist = useMemo(
    () =>
      origin
        ? [`${origin.protocol}//${origin.host}`, `${origin.protocol}//${origin.host}/*`]
        : [],
    [origin],
  );

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

  const openOrder = useCallback(
    (orderId: string | null) => {
      if (!orderId) return;
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

  const onNavigationChange = useCallback((nav: WebViewNavigation) => {
    canGoBack.current = nav.canGoBack;
    let path = '';
    try {
      path = new URL(nav.url).pathname;
    } catch {
      path = nav.url;
    }
    if (path.startsWith('/seller') || path.startsWith('/admin')) {
      wasInPortal.current = true;
    } else if (path === '/login' && wasInPortal.current) {
      wasInPortal.current = false;
      webviewRef.current?.clearCache(true);
    }
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setReloadKey((key) => key + 1);
  }, []);

  if (!origin) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.state}>
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
        originWhitelist={originWhitelist}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        onLoadStart={() => {
          loaded.current = false;
          setLoading(true);
        }}
        onLoadEnd={() => {
          loaded.current = true;
          setLoading(false);
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
        }}
        onHttpError={(event: { nativeEvent: { statusCode: number } }) => {
          if (event.nativeEvent.statusCode >= 500) {
            setError(`The portal returned ${event.nativeEvent.statusCode}.`);
          }
        }}
        onNavigationStateChange={onNavigationChange}
        onShouldStartLoadWithRequest={(request: { url: string }) => {
          if (isPortalUrl(request.url)) return true;
          openExternal(request.url);
          return false;
        }}
        style={styles.webview}
      />
      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="small" color="#1162D3" />
        </View>
      ) : null}
      {error ? (
        <View style={styles.state}>
          <Text style={styles.title}>Cannot reach the portal</Text>
          <Text style={styles.body}>{error}</Text>
          <Pressable onPress={retry} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
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
  title: { fontSize: ms(18), fontWeight: '900', color: '#0f172a', textAlign: 'center' },
  body: { fontSize: ms(13), lineHeight: ms(19), color: '#64748b', textAlign: 'center' },
  button: {
    marginTop: vs(8),
    paddingHorizontal: ms(20),
    paddingVertical: vs(10),
    borderRadius: ms(10),
    backgroundColor: '#1162D3',
  },
  buttonText: { fontSize: ms(13), fontWeight: '800', color: '#fff' },
});
