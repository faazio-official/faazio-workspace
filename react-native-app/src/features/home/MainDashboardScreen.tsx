import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import {
  Home,
  LayoutGrid,
  Heart,
  ShoppingBag,
  User,
  MapPin,
  Bell,
} from 'lucide-react-native';

// Import Hub Views
import HomeView from '../../components/HomeView';
import CategoriesView from '../../components/CategoriesView';
import FavouritesView from '../../components/FavouritesView';
import AccountView from '../../components/AccountView';
import CartView from '../../components/CartView';
import SubAppWrapper from '../../components/SubAppWrapper';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MainDashboardScreenProps {
  navigation: any;
  route: any;
}

export function MainDashboardScreen({ navigation }: MainDashboardScreenProps) {
  const [activeTab, setActiveTab] = useState<'Home' | 'Categories' | 'Favourites' | 'Account' | 'Cart'>('Home');
  const [activeSubApp, setActiveSubApp] = useState<'FA_MART' | 'FOOD' | 'GROCERY' | 'PHARMA' | null>(null);

  // Unified persistent state shared across Hub and active sub-apps
  const [cartItems, setCartItems] = useState<
    { id: string; name: string; price: number; quantity: number; emoji: string }[]
  >([
    { id: "cat-fm-1", name: "Spicy Tonkotsu Ramen", price: 225, quantity: 1, emoji: "🍜" }
  ]);

  const [favorites, setFavorites] = useState<string[]>(['cat-fm-1', 'cat-gg-2', 'cat-mt-1']);

  // Cart Helper actions
  const addToCart = (id: string, name: string, price: number, emoji: string) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === id);
      if (existing) {
        return prev.map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { id, name, price, quantity: 1, emoji }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      return [...prev, productId];
    });
  };

  const handleReset = () => {
    setCartItems([]);
    setActiveTab('Home');
    setActiveSubApp(null);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const setShowLocationRequestState = (val: boolean) => {
    // Graceful callback
  };

  const setIsLoggedIn = (val: boolean) => {
    // Graceful callback
  };

  // Total items in cart
  const totalCartQty = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

  // If a sub-app is active, let SubAppWrapper take complete edge-to-edge layout control!
  if (activeSubApp !== null) {
    return (
      <SafeAreaView style={styles.container}>
        <SubAppWrapper
          subAppId={activeSubApp}
          onExit={() => setActiveSubApp(null)}
          addToCart={addToCart}
          cartItems={cartItems}
          setCartItems={setCartItems}
          updateCartQuantity={updateCartQuantity}
          handleReset={handleReset}
          setShowLocationRequestState={setShowLocationRequestState}
          setIsLoggedIn={setIsLoggedIn}
          onProductClick={(prod) => {
            navigation.navigate('ProductDetail', { productId: prod.id });
          }}
        />
      </SafeAreaView>
    );
  }

  // Otherwise, render the Hub view!
  const renderHubContent = () => {
    switch (activeTab) {
      case 'Home':
        return (
          <HomeView
            onLaunchSubApp={(subAppId) => setActiveSubApp(subAppId)}
            addToCart={addToCart}
          />
        );
      case 'Categories':
        return (
          <CategoriesView
            selectedCategory="ALL"
            setSelectedCategory={() => {}}
            addToCart={addToCart}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            onProductClick={(prod) => {
              navigation.navigate('ProductDetail', { productId: prod.id });
            }}
          />
        );
      case 'Favourites':
        return (
          <FavouritesView
            addToCart={addToCart}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            onProductClick={(prod) => {
              navigation.navigate('ProductDetail', { productId: prod.id });
            }}
          />
        );
      case 'Account':
        return (
          <AccountView
            handleReset={handleReset}
            setShowLocationRequestState={setShowLocationRequestState}
            setIsLoggedIn={setIsLoggedIn}
          />
        );
      case 'Cart':
        return (
          <CartView
            cartItems={cartItems}
            setCartItems={setCartItems}
            updateCartQuantity={updateCartQuantity}
            setActiveTab={(tab) => {
              if (tab === 'Home') setActiveTab('Home');
              else if (tab === 'Account') setActiveTab('Account');
            }}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Hub Top Fixed Location Header */}
      <View style={styles.topBar}>
        <View style={styles.locationWrapper}>
          <MapPin size={15} color="#2c56f6" style={styles.pinIcon} />
          <View>
            <Text style={styles.locationLabel}>Delivering to</Text>
            <Text style={styles.locationValue} numberOfLines={1}>Sunnambukkara Street, Karaikal</Text>
          </View>
        </View>

        <View style={styles.rightHeaderGroup}>
          <Text style={styles.faazioBrandTitle}>FAAZIO HUB</Text>
          <TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8}>
            <Bell size={16} color="#475569" />
            <View style={styles.badgeDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Scrollable Hub content */}
      <View style={styles.viewport}>
        {renderHubContent()}
      </View>

      {/* 3. Hub Bottom Navigation Tabs */}
      <View style={styles.tabBar}>
        {[
          { name: 'Home' as const, icon: Home, label: 'Hub' },
          { name: 'Categories' as const, icon: LayoutGrid, label: 'Explore' },
          { name: 'Favourites' as const, icon: Heart, label: 'Saved' },
          { name: 'Cart' as const, icon: ShoppingBag, label: 'Bag' },
          { name: 'Account' as const, icon: User, label: 'Profile' },
        ].map((tab, idx) => {
          const isCurrent = activeTab === tab.name;
          const Icon = tab.icon;

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => setActiveTab(tab.name)}
              style={styles.tabItem}
              activeOpacity={0.85}
            >
              {isCurrent && (
                <View style={styles.activeIndicator} />
              )}
              <View style={styles.iconContainer}>
                <Icon size={18} color={isCurrent ? '#0f172a' : '#94a3b8'} />
                {tab.name === 'Cart' && totalCartQty > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{totalCartQty}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isCurrent && { color: '#0f172a', fontWeight: '900' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  locationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 16,
  },
  pinIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  locationLabel: {
    fontSize: 7.5,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  locationValue: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 1,
  },
  rightHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  faazioBrandTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  notificationBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  viewport: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  tabBar: {
    height: 62,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 3,
    backgroundColor: '#0f172a',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#f97316',
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '900',
  },
  tabLabel: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 3,
  },
});
