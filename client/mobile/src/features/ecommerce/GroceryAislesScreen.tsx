import React, { memo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Search, ChevronRight, ShieldCheck, Leaf, Truck, Package } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import GroceryImage from './components/grocery-home/GroceryImage';
import {
  GROCERY_AISLES,
  GROCERY_TRUST_BADGES,
  type GroceryAisleCategory,
  type GroceryTrustBadge,
} from './mocks/groceryAisles';

const GREEN = '#118C4F';
const INK = '#1E2022';
const GREY = '#666666';

const TRUST_ICONS: Record<GroceryTrustBadge['icon'], React.ComponentType<any>> = {
  shield: ShieldCheck,
  leaf: Leaf,
  truck: Truck,
  cube: Package,
};

interface GroceryAislesScreenProps {
  onCategoryPress?: (category: GroceryAisleCategory) => void;
  onSearchPress?: () => void;
  onOffersPress?: () => void;
}

const TrustBadgeItem = memo(function TrustBadgeItem({ badge }: { badge: GroceryTrustBadge }) {
  const Icon = TRUST_ICONS[badge.icon];
  return (
    <TouchableOpacity style={styles.badgeItem} activeOpacity={0.8} accessibilityRole="button">
      <View style={[styles.badgeIcon, { backgroundColor: badge.bgColor }]}>
        <Icon size={ms(20)} color={GREEN} strokeWidth={2.2} />
      </View>
      <View style={styles.badgeTextStack}>
        <AppText style={styles.badgeTitle}>{badge.title}</AppText>
        <AppText style={styles.badgeSubtitle}>{badge.subtitle}</AppText>
      </View>
    </TouchableOpacity>
  );
});

const CategoryCard = memo(function CategoryCard({
  item,
  onPress,
}: {
  item: GroceryAisleCategory;
  onPress?: (category: GroceryAisleCategory) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => onPress?.(item)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={styles.categoryCircle}>
        <GroceryImage uri={item.imageUrl} style={styles.categoryImage} contentFit="contain" />
      </View>
      <AppText style={styles.categoryLabel} numberOfLines={2}>
        {item.name}
      </AppText>
    </TouchableOpacity>
  );
});

export function GroceryAislesScreen({
  onCategoryPress,
  onSearchPress,
  onOffersPress,
}: GroceryAislesScreenProps) {
  const renderCategory = useCallback(
    ({ item }: { item: GroceryAisleCategory }) => (
      <CategoryCard item={item} onPress={onCategoryPress} />
    ),
    [onCategoryPress],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. SEARCH BAR */}
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.7}
          onPress={onSearchPress}
          accessibilityRole="button"
        >
          <Search size={ms(18)} color="#9E9E9E" strokeWidth={2.2} />
          <AppText style={styles.searchPlaceholder}>Search in Grocery</AppText>
        </TouchableOpacity>

        {/* 2. HERO PROMOTIONAL BANNER */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <AppText style={styles.heroRow1}>Everything you need,</AppText>
            <AppText style={styles.heroRow2}>delivered fresh!</AppText>
            <AppText style={styles.heroSubtitle}>
              Best quality • Great prices • On-time delivery
            </AppText>
          </View>
          <GroceryImage
            uri="https://images.unsplash.com/photo-1542838132-92c53300491e?fm=jpg&fit=crop&q=80&w=400&h=400"
            style={styles.heroImage}
            contentFit="cover"
          />
        </View>

        {/* 3. TRUST BADGES */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.badgeScroll}
          contentContainerStyle={styles.badgeScrollContent}
        >
          {GROCERY_TRUST_BADGES.map((badge) => (
            <TrustBadgeItem key={badge.id} badge={badge} />
          ))}
        </ScrollView>

        {/* 4. SHOP BY CATEGORY */}
        <AppText style={styles.sectionHeader}>Shop by Category</AppText>
        <View style={styles.categoryGrid}>
          {GROCERY_AISLES.map((item) => renderCategory({ item }))}
        </View>

        {/* 5. BOTTOM PROMOTIONAL BANNER */}
        <TouchableOpacity
          style={styles.offersBanner}
          activeOpacity={0.8}
          onPress={onOffersPress}
          accessibilityRole="button"
        >
          <View style={styles.offersLeft}>
            <View style={styles.offersGraphic}>
              <AppText style={styles.offersGraphicText}>%</AppText>
            </View>
            <View style={styles.offersTextStack}>
              <AppText style={styles.offersTitle}>Save More with Offers</AppText>
              <AppText style={styles.offersSubtitle}>Check out today's exciting deals</AppText>
            </View>
          </View>
          <ChevronRight size={ms(22)} color={GREEN} strokeWidth={2.5} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default GroceryAislesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: vs(24),
  },
  searchBar: {
    marginHorizontal: hs(16),
    marginTop: vs(8),
    marginBottom: vs(16),
    backgroundColor: '#F5F6F8',
    borderRadius: ms(12),
    paddingHorizontal: hs(12),
    height: vs(48),
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchPlaceholder: {
    color: '#9E9E9E',
    fontSize: ms(13),
    marginLeft: hs(8),
    fontWeight: '500',
  },
  hero: {
    marginHorizontal: hs(16),
    backgroundColor: '#E8F5E9',
    borderRadius: ms(16),
    overflow: 'hidden',
    flexDirection: 'row',
    height: vs(130),
  },
  heroLeft: {
    padding: hs(16),
    flex: 1,
    justifyContent: 'center',
  },
  heroRow1: {
    fontSize: ms(16),
    fontWeight: '700',
    color: INK,
  },
  heroRow2: {
    fontSize: ms(16),
    fontWeight: '700',
    color: GREEN,
  },
  heroSubtitle: {
    fontSize: ms(12),
    color: GREY,
    marginTop: vs(8),
    fontWeight: '500',
  },
  heroImage: {
    width: hs(130),
    height: hs(130),
  },
  badgeScroll: {
    marginTop: vs(20),
    flexGrow: 0,
  },
  badgeScrollContent: {
    paddingLeft: hs(16),
    paddingRight: hs(8),
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: hs(16),
  },
  badgeIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTextStack: {
    marginLeft: hs(8),
  },
  badgeTitle: {
    fontSize: ms(12),
    fontWeight: '700',
    color: INK,
  },
  badgeSubtitle: {
    fontSize: ms(10),
    color: GREY,
    marginTop: vs(1),
  },
  sectionHeader: {
    fontSize: ms(18),
    fontWeight: '700',
    color: INK,
    marginHorizontal: hs(16),
    marginTop: vs(24),
    marginBottom: vs(16),
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
  },
  categoryCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    alignItems: 'center',
    padding: hs(12),
    marginBottom: vs(12),
  },
  categoryCircle: {
    width: ms(70),
    height: ms(70),
    borderRadius: ms(35),
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryImage: {
    width: ms(50),
    height: ms(50),
  },
  categoryLabel: {
    marginTop: vs(10),
    textAlign: 'center',
    fontSize: ms(11),
    fontWeight: '600',
    color: '#333333',
  },
  offersBanner: {
    marginHorizontal: hs(16),
    marginTop: vs(12),
    marginBottom: vs(24),
    backgroundColor: '#F0F8EC',
    borderRadius: ms(12),
    padding: hs(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  offersGraphic: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(10),
    backgroundColor: '#DFF0D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offersGraphicText: {
    fontSize: ms(20),
    fontWeight: '800',
    color: GREEN,
  },
  offersTextStack: {
    marginLeft: hs(10),
  },
  offersTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    color: INK,
  },
  offersSubtitle: {
    fontSize: ms(10.5),
    color: GREY,
    marginTop: vs(2),
  },
});
