import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  TextInput,
  LayoutChangeEvent,
  LayoutRectangle,
  StatusBar,
} from 'react-native';
import { Canvas, Fill, Rect, RoundedRect, Circle, Line, Group, Shadow, BackdropBlur, LinearGradient, RadialGradient, vec } from '@shopify/react-native-skia';
import { SCREEN_W, hs, vs, ms } from '@/utils/responsive';
import {
  Home,
  LayoutGrid,
  Heart,
  ShoppingBag,
  User,
  MapPin,
  ChevronDown,
} from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Rect as SvgRect, Circle as SvgCircle } from 'react-native-svg';
import { FaazioLogo } from '@/components/FaazioLogo';

import { useCartStore } from '@/state/cartStore';
import { useFavoriteStore } from '@/state/favoriteStore';
import { useUIStore } from '@/state/uiStore';
import type { CartItem } from '@/state/cartStore';

import HomeView from '../../components/HomeView';
import ProductDetailView from '../../components/ProductDetailView';
import CategoriesView from '../../components/CategoriesView';
import FavouritesView from '../../components/FavouritesView';
import AccountView from '../../components/AccountView';
import CartView from '../../components/CartView';
import SubAppWrapper from '../../components/SubAppWrapper';

const TAB_ORDER = ['Home', 'Categories', 'Favourites', 'Account', 'Cart'] as const;
type TabName = typeof TAB_ORDER[number];

const LABEL_TABS: TabName[] = ['Home', 'Categories', 'Favourites', 'Account'];

const TAB_COLORS: Record<TabName, string> = {
  Home: '#2F80ED',
  Categories: '#27AE60',
  Favourites: '#FF4A6B',
  Account: '#6C5CE7',
  Cart: '#F2994A',
};

const TAB_GLOW: Record<TabName, string> = {
  Home: 'rgba(47,128,237,0.25)',
  Categories: 'rgba(39,174,96,0.25)',
  Favourites: 'rgba(255,74,107,0.25)',
  Account: 'rgba(108,92,231,0.25)',
  Cart: 'rgba(242,153,74,0.25)',
};

const TAB_GLOW_COLORS: Record<TabName, string> = {
  Home: 'rgba(47,128,237,0.4)',
  Categories: 'rgba(39,174,96,0.4)',
  Favourites: 'rgba(255,74,107,0.4)',
  Account: 'rgba(108,92,231,0.4)',
  Cart: 'rgba(242,153,74,0.4)',
};

const TAB_LABELS: Record<TabName, string> = {
  Home: 'Home',
  Categories: 'Categories',
  Favourites: 'Favourites',
  Account: 'Account',
  Cart: '',
};

const DROPLET_W = ms(32);
const TAB_BAR_PAD = hs(20);
const TAB_BAR_H = vs(76);

interface MainDashboardScreenProps {
  navigation: any;
  route: any;
}

const HEADER_NOTCH_INSET = StatusBar.currentHeight ?? 0;
const HEADER_TOP_GAP = vs(16);
const HEADER_MIN_TOP_GAP = vs(10);
const HEADER_ROW_H = vs(24);
const HEADER_ROW_GAP = vs(12);
const HEADER_SEARCH_H = Math.max(44, vs(44));
const HEADER_BOTTOM_PAD = vs(10);
const HEADER_H = HEADER_NOTCH_INSET + HEADER_TOP_GAP + HEADER_ROW_H + HEADER_ROW_GAP + HEADER_SEARCH_H + HEADER_BOTTOM_PAD;
const HEADER_COLLAPSE = HEADER_TOP_GAP + HEADER_ROW_H + HEADER_ROW_GAP - HEADER_MIN_TOP_GAP;

export function MainDashboardScreen({ navigation }: MainDashboardScreenProps) {
  const cartItems = useCartStore((s) => s.cart);
  const addToCart = useCartStore((s) => s.addToCart);
  const storeUpdateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const replaceCart = useCartStore((s) => s.replaceCart);
  const favorites = useFavoriteStore((s) => s.favorites);
  const toggleFavorite = useFavoriteStore((s) => s.toggleFavorite);
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const activeSubApp = useUIStore((s) => s.activeSubApp);
  const setActiveSubApp = useUIStore((s) => s.setActiveSubApp);
  const selectedProduct = useUIStore((s) => s.selectedProduct);
  const setSelectedProduct = useUIStore((s) => s.setSelectedProduct);
  const resetUI = useUIStore((s) => s.reset);

  const headerCollapseAnim = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const dropletX = useRef(new Animated.Value(0)).current;

  const scrollYRef = useRef(0);
  const scrollDir = useRef<'up' | 'down' | null>(null);

  const tabLayouts = useRef<Record<string, LayoutRectangle>>({});
  const [, setMeasReady] = useState(0);

  const totalCartQty = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

  const updateCartQuantity = useCallback((id: string, delta: number) => {
    storeUpdateQuantity(id, delta);
  }, [storeUpdateQuantity]);

  const setCartItems = useCallback((action: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    if (typeof action === 'function') {
      const prev = useCartStore.getState().cart;
      replaceCart(action(prev));
    } else {
      replaceCart(action);
    }
  }, [replaceCart]);

  const handleProductClick = useCallback((product: any) => {
    setSelectedProduct(product);
  }, [setSelectedProduct]);

  const handleLaunchSubApp = useCallback((id: any) => {
    setActiveSubApp(id);
  }, [setActiveSubApp]);

  const handleSetActiveTab = useCallback((tab: any) => {
    setActiveTab(tab as TabName);
  }, [setActiveTab]);

  const handleReset = useCallback(() => {
    clearCart();
    resetUI();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [clearCart, resetUI, navigation]);

  const handleScroll = useCallback((offsetY: number) => {
    const prevOffset = scrollYRef.current;
    scrollYRef.current = offsetY;

    if (offsetY <= 0) {
      if (scrollDir.current !== 'up') {
        scrollDir.current = 'up';
        Animated.timing(headerCollapseAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }
      return;
    }

    const deltaY = offsetY - prevOffset;
    if (deltaY >= 1 && scrollDir.current !== 'down') {
      scrollDir.current = 'down';
      Animated.timing(headerCollapseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else if (deltaY <= -1 && scrollDir.current !== 'up') {
      scrollDir.current = 'up';
      Animated.timing(headerCollapseAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [headerCollapseAnim]);

  const scrollProps = useMemo(() => ({ onScroll: handleScroll }), [handleScroll]);

  const onTabLayout = useCallback((name: string, e: LayoutChangeEvent) => {
    tabLayouts.current[name] = e.nativeEvent.layout;
    if (Object.keys(tabLayouts.current).length >= TAB_ORDER.length) {
      setMeasReady((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'Cart') return;
    const layout = tabLayouts.current[activeTab];
    if (!layout) return;
    const targetX = layout.x + layout.width / 2 - DROPLET_W / 2;
    Animated.spring(dropletX, {
      toValue: targetX,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [activeTab, dropletX]);

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  useEffect(() => {
    navigation.setOptions({ statusBarStyle: activeSubApp !== null ? 'dark' : 'light' });
  }, [activeSubApp, navigation]);

  const headerTranslateY = headerCollapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -HEADER_COLLAPSE],
  });

  const viewportTranslateY = headerCollapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -HEADER_COLLAPSE],
  });

  const topRowOpacity = headerCollapseAnim.interpolate({
    inputRange: [0, 0.75, 1],
    outputRange: [1, 1, 0],
  });

  const activeLayout = activeTab !== 'Cart' ? tabLayouts.current[activeTab] : null;
  const cartLayout = tabLayouts.current['Cart'];

  const capRect = activeLayout
    ? {
        x: activeLayout.x + TAB_BAR_PAD,
        y: activeLayout.y,
        w: activeLayout.width,
        h: activeLayout.height,
        iconCX: activeLayout.x + TAB_BAR_PAD + activeLayout.width / 2,
        iconCY: activeLayout.y + activeLayout.height / 2,
      }
    : null;

  const cartRect = cartLayout
    ? {
        cx: cartLayout.x + TAB_BAR_PAD + cartLayout.width / 2,
        cy: cartLayout.y + cartLayout.height / 2,
      }
    : null;

  if (activeSubApp !== null) {
    return (
      <View style={styles.container}>
        <SubAppWrapper
          subAppId={activeSubApp}
          onExit={() => setActiveSubApp(null)}
          addToCart={addToCart}
          cartItems={cartItems}
          setCartItems={setCartItems}
          updateCartQuantity={updateCartQuantity}
          handleReset={handleReset}
          setShowLocationRequestState={() => {}}
          setIsLoggedIn={() => {}}
          onProductClick={(prod) => handleProductClick(prod)}
        />
        {selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            addToCart={addToCart}
            cartItems={cartItems}
            updateCartQuantity={updateCartQuantity}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        )}
      </View>
    );
  }

  const activeColor = TAB_COLORS[activeTab];

  const renderHubContent = () => (
    <>
      <View key="Home" style={{ flex: 1, display: activeTab === 'Home' ? 'flex' : 'none' }}>
        {activeTab === 'Home' && <HomeView onLaunchSubApp={handleLaunchSubApp} addToCart={addToCart} onProductClick={handleProductClick} {...scrollProps} />}
      </View>
      <View key="Categories" style={{ flex: 1, display: activeTab === 'Categories' ? 'flex' : 'none' }}>
        {activeTab === 'Categories' && <CategoriesView selectedCategory="ALL" setSelectedCategory={() => {}} addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} onProductClick={(prod) => navigation.navigate('ProductDetail', { productId: prod.id })} {...scrollProps} />}
      </View>
      <View key="Favourites" style={{ flex: 1, display: activeTab === 'Favourites' ? 'flex' : 'none' }}>
        {activeTab === 'Favourites' && <FavouritesView addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} onProductClick={(prod) => navigation.navigate('ProductDetail', { productId: prod.id })} {...scrollProps} />}
      </View>
      <View key="Account" style={{ flex: 1, display: activeTab === 'Account' ? 'flex' : 'none' }}>
        {activeTab === 'Account' && <AccountView handleReset={handleReset} setShowLocationRequestState={() => navigation.navigate('Location')} setIsLoggedIn={() => {}} {...scrollProps} />}
      </View>
      <View key="Cart" style={{ flex: 1, display: activeTab === 'Cart' ? 'flex' : 'none' }}>
        {activeTab === 'Cart' && <CartView cartItems={cartItems} setCartItems={setCartItems} updateCartQuantity={updateCartQuantity} setActiveTab={handleSetActiveTab} {...scrollProps} />}
      </View>
    </>
  );

  return (
    <>
      <Animated.View
        style={[
          styles.entranceRoot,
          {
            backgroundColor: '#ffffff',
            opacity: entranceAnim,
            transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [vs(10), 0] }) }],
          },
        ]}
      >
        <Animated.View style={[styles.viewport, { transform: [{ translateY: viewportTranslateY }] }]}>
          {renderHubContent()}
        </Animated.View>

        <Animated.View
          style={[
            styles.headerOuter,
            { transform: [{ translateY: headerTranslateY }] },
          ]}
        >
          <View style={styles.headerGradientWrap}>
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgGrad id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#6D28D9" />
                  <Stop offset="50%" stopColor="#8B5CF6" />
                  <Stop offset="100%" stopColor="#C4B5FD" stopOpacity={0.15} />
                </SvgGrad>
              </Defs>
              <SvgRect width="100%" height="100%" fill="url(#headerGrad)" />
              <SvgCircle cx={SCREEN_W * 1.1} cy={vs(-20)} r={ms(96)} fill="rgba(255,255,255,0.05)" />
              <SvgCircle cx={hs(-30)} cy={vs(120)} r={ms(96)} fill="rgba(255,255,255,0.04)" />
            </Svg>
          </View>
          <View style={styles.headerContent}>
            <Animated.View style={[styles.headerTopRow, { opacity: topRowOpacity }]}>
              <View style={styles.logoPill}>
                <FaazioLogo size={ms(16)} />
              </View>

              <View style={styles.headerCenter}>
                <TouchableOpacity style={styles.locationRow} activeOpacity={0.7} onPress={() => navigation.navigate('Location')}>
                  <MapPin size={ms(11)} color="#7CE045" />
                  <Text style={styles.locationText} numberOfLines={1}>Sunnambukkara Street, Karaikal</Text>
                  <ChevronDown size={ms(11)} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>
            </Animated.View>

            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for food, groceries or more..."
                placeholderTextColor="#94a3b8"
                textAlign="center"
              />
            </View>
          </View>
        </Animated.View>

        {/* Skia Liquid Glass Tab Bar */}
        <View style={styles.tabBarWrap}>
          <Canvas style={StyleSheet.absoluteFill}>
            {/* Layer 1: Backdrop blur */}
            <BackdropBlur blur={20}>
              <Fill color="rgba(255,255,255,0.75)" />
            </BackdropBlur>

            {/* Layer 2: Glass tint gradient */}
            <Rect x={0} y={0} width={SCREEN_W} height={TAB_BAR_H}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, TAB_BAR_H)}
                colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.7)']}
              />
            </Rect>

            {/* Layer 3: Top edge hairline */}
            <Line p1={vec(0, 0.5)} p2={vec(SCREEN_W, 0.5)} color="rgba(255,255,255,0.9)" style="stroke" strokeWidth={1} />

            {/* Layer 4: Active capsule with glass effect */}
            {capRect && (
              <Group>
                <RoundedRect x={capRect.x} y={capRect.y} width={capRect.w} height={capRect.h} r={14}>
                  <Shadow dx={0} dy={2} blur={8} color={TAB_GLOW[activeTab]} />
                  <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.06)" />
                </RoundedRect>
                <RoundedRect x={capRect.x} y={capRect.y} width={capRect.w} height={capRect.h} r={14}>
                  <LinearGradient
                    start={vec(0, capRect.y)}
                    end={vec(0, capRect.y + capRect.h)}
                    colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.88)', 'rgba(255,255,255,0.78)']}
                    positions={[0, 0.4, 1]}
                  />
                </RoundedRect>
                <RoundedRect x={capRect.x} y={capRect.y} width={capRect.w} height={capRect.h} r={14}>
                  <LinearGradient
                    start={vec(0, capRect.y)}
                    end={vec(0, capRect.y + capRect.h)}
                    colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.2)', 'transparent']}
                    positions={[0, 0.35, 0.6]}
                  />
                </RoundedRect>
                <Circle cx={capRect.iconCX} cy={capRect.iconCY} r={16}>
                  <RadialGradient
                    c={vec(capRect.iconCX, capRect.iconCY)}
                    r={16}
                    colors={[TAB_GLOW_COLORS[activeTab], 'transparent']}
                  />
                </Circle>
              </Group>
            )}

            {/* Layer 5: Cart FAB glass orb */}
            {cartRect && (
              <Group>
                <Circle cx={cartRect.cx} cy={cartRect.cy} r={30}>
                  <Shadow dx={0} dy={6} blur={15} color="rgba(255,150,50,0.35)" />
                  <Shadow dx={0} dy={2} blur={4} color="rgba(0,0,0,0.1)" />
                </Circle>
                <Circle cx={cartRect.cx} cy={cartRect.cy} r={30}>
                  <RadialGradient
                    c={vec(cartRect.cx - 5, cartRect.cy - 5)}
                    r={30}
                    colors={['#FFB347', '#FF8C42', '#E86B2E']}
                  />
                </Circle>
                <Circle cx={cartRect.cx - 10} cy={cartRect.cy - 12} r={12}>
                  <RadialGradient
                    c={vec(cartRect.cx - 10, cartRect.cy - 12)}
                    r={12}
                    colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.15)', 'transparent']}
                    positions={[0, 0.4, 1]}
                  />
                </Circle>
                <Circle cx={cartRect.cx} cy={cartRect.cy} r={28} style="stroke" strokeWidth={0.5} color="rgba(255,255,255,0.2)" />
              </Group>
            )}
          </Canvas>

          {/* Touch layer: tab buttons */}
          <View style={styles.tabBarInner}>
            <Animated.View
              style={[
                styles.droplet,
                { backgroundColor: activeColor, transform: [{ translateX: dropletX }] },
              ]}
            />
            {TAB_ORDER.map((name) => {
              const isCart = name === 'Cart';
              const isActive = activeTab === name;
              const Icon = name === 'Home' ? Home : name === 'Categories' ? LayoutGrid : name === 'Favourites' ? Heart : name === 'Cart' ? ShoppingBag : User;
              return (
                <TouchableOpacity
                  key={name}
                  onPress={() => setActiveTab(name)}
                  onLayout={(e) => onTabLayout(name, e)}
                  style={[styles.tabItem, isCart && styles.cartTabItem]}
                  activeOpacity={0.85}
                >
                  {isCart ? (
                    <View style={styles.cartVisualWrap}>
                      <ShoppingBag size={ms(22)} color="#ffffff" />
                      {totalCartQty > 0 && (
                        <View style={styles.cartBadge}>
                          <Text style={styles.cartBadgeText}>{totalCartQty}</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      <Icon
                        size={isActive ? ms(20) : ms(18)}
                        color={isActive ? TAB_COLORS[name] : 'rgba(148,163,184,0.9)'}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      <Text style={[styles.tabLabel, isActive && { color: TAB_COLORS[name], fontWeight: '900' }]}>
                        {TAB_LABELS[name]}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.View>
      {selectedProduct && (
        <ProductDetailView
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          addToCart={addToCart}
          cartItems={cartItems}
          updateCartQuantity={updateCartQuantity}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  entranceRoot: { flex: 1 },
  viewport: { flex: 1, paddingTop: HEADER_H },
  headerOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    height: HEADER_H,
    shadowColor: 'rgba(109,40,217,0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  headerGradientWrap: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: ms(32),
    borderBottomRightRadius: ms(32),
    overflow: 'hidden',
  },
  headerContent: { paddingTop: HEADER_NOTCH_INSET + HEADER_TOP_GAP, paddingBottom: HEADER_BOTTOM_PAD, paddingHorizontal: hs(16), gap: HEADER_ROW_GAP },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  logoPill: {
    height: HEADER_ROW_H,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: ms(12),
    paddingHorizontal: hs(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    maxWidth: hs(200),
  },
  locationText: {
    fontSize: ms(10),
    fontWeight: '900',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    maxWidth: hs(160),
  },
  searchBar: {
    height: HEADER_SEARCH_H,
    borderRadius: ms(22),
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#0f172a',
    paddingHorizontal: hs(20),
  },
  tabBarWrap: {
    height: TAB_BAR_H,
    borderTopLeftRadius: ms(30),
    borderTopRightRadius: ms(30),
    paddingHorizontal: TAB_BAR_PAD,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 35,
    elevation: 20,
  },
  tabBarInner: {
    flexDirection: 'row',
    position: 'relative',
    height: vs(64),
    alignItems: 'center',
  },
  droplet: {
    position: 'absolute',
    top: 0,
    width: DROPLET_W,
    height: vs(4),
    borderRadius: ms(2),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(2),
  },
  cartTabItem: {
    marginTop: -vs(20),
  },
  tabLabel: {
    fontSize: ms(8),
    fontWeight: '700',
    color: 'rgba(148,163,184,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cartVisualWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: vs(-6),
    right: hs(-10),
    backgroundColor: '#e11d48',
    borderRadius: ms(8),
    minWidth: hs(18),
    height: vs(18),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(3),
    borderWidth: 2,
    borderColor: '#ffffff',
    zIndex: 3,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: ms(8),
    fontWeight: '900',
  },
});
