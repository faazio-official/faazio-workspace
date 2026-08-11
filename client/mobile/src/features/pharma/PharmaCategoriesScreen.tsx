import React, { memo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Upload,
  RefreshCw,
  ClipboardList,
  Tag,
  ShieldCheck,
  Percent,
  Truck,
  RotateCcw,
  Info,
  BadgeCheck,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import PharmaImage from './components/pharma-home/PharmaImage';
import {
  PHARMA_QUICK_ACTIONS,
  PHARMA_ALL_CATEGORIES,
  PHARMA_OFFERS_BADGES,
  type PharmaQuickAction,
  type PharmaAllCategory,
  type PharmaOffersBadge,
} from './mocks/pharmaCategories';

const TEAL = '#0B7B83';
const INK = '#1E2022';
const GREY = '#444444';

const QUICK_ICONS: Record<PharmaQuickAction['icon'], React.ComponentType<any>> = {
  'file-text': FileText,
  upload: Upload,
  'refresh-cw': RefreshCw,
  'clipboard-list': ClipboardList,
  tag: Tag,
};

const OFFER_ICONS: Record<PharmaOffersBadge['icon'], React.ComponentType<any>> = {
  percent: Percent,
  'shield-check': ShieldCheck,
  truck: Truck,
  'rotate-ccw': RotateCcw,
};

const HERO_FEATURES = [
  '100% Genuine Medicines',
  'Fast & Reliable Delivery',
  'Secure Payments',
];

interface PharmaCategoriesScreenProps {
  onBack?: () => void;
  onCategoryPress?: (category: PharmaAllCategory) => void;
  onSearchPress?: () => void;
  onQuickAction?: (action: PharmaQuickAction) => void;
}

const QuickActionCard = memo(function QuickActionCard({
  item,
  onPress,
}: {
  item: PharmaQuickAction;
  onPress?: (action: PharmaQuickAction) => void;
}) {
  const Icon = QUICK_ICONS[item.icon];
  return (
    <TouchableOpacity
      style={styles.quickCard}
      onPress={() => onPress?.(item)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={[styles.quickIconWrap, { backgroundColor: item.bgColor }]}>
        <Icon size={ms(18)} color={TEAL} strokeWidth={2.2} />
      </View>
      <AppText style={styles.quickTitle} numberOfLines={2}>
        {item.title}
      </AppText>
    </TouchableOpacity>
  );
});

const CategoryCard = memo(function CategoryCard({
  item,
  onPress,
}: {
  item: PharmaAllCategory;
  onPress?: (category: PharmaAllCategory) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => onPress?.(item)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={styles.categoryCircle}>
        <PharmaImage uri={item.imageUrl} style={styles.categoryImage} contentFit="contain" />
      </View>
      <AppText style={styles.categoryLabel} numberOfLines={2}>
        {item.name}
      </AppText>
    </TouchableOpacity>
  );
});

const OfferBadgeItem = memo(function OfferBadgeItem({ item }: { item: PharmaOffersBadge }) {
  const Icon = OFFER_ICONS[item.icon];
  return (
    <View style={styles.offerBox}>
      <View style={[styles.offerIconWrap, { backgroundColor: item.bgColor }]}>
        <Icon size={ms(16)} color={TEAL} strokeWidth={2.2} />
      </View>
      <View style={styles.offerTextStack}>
        <AppText style={styles.offerTitle} numberOfLines={1}>{item.title}</AppText>
        <AppText style={styles.offerSubtitle} numberOfLines={1}>{item.subtitle}</AppText>
      </View>
    </View>
  );
});

export function PharmaCategoriesScreen({
  onBack,
  onCategoryPress,
  onSearchPress,
  onQuickAction,
}: PharmaCategoriesScreenProps) {
  const renderCategory = useCallback(
    ({ item }: { item: PharmaAllCategory }) => (
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
        {/* 1. IN-SCREEN HEADER */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <ChevronLeft size={ms(18)} color={INK} strokeWidth={2.5} />
          </TouchableOpacity>
          <AppText style={styles.topTitle}>Pharmacy</AppText>
          <View style={{ width: ms(32) }} />
        </View>

        {/* 2. SEARCH BAR */}
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.7}
          onPress={onSearchPress}
          accessibilityRole="button"
        >
          <Search size={ms(18)} color="#9E9E9E" strokeWidth={2.2} />
          <AppText style={styles.searchPlaceholder}>
            Search medicines & healthcare products
          </AppText>
        </TouchableOpacity>

        {/* 3. HERO PROMOTIONAL BANNER */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <AppText style={styles.heroRow1}>Your Health,</AppText>
            <AppText style={styles.heroRow2}>Our Priority</AppText>
            <View style={styles.heroFeatures}>
              {HERO_FEATURES.map((feature) => (
                <View key={feature} style={styles.heroFeatureChip}>
                  <BadgeCheck size={ms(10)} color={TEAL} strokeWidth={2.5} />
                  <AppText style={styles.heroFeatureText} numberOfLines={1}>
                    {feature}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
          <PharmaImage
            uri="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=300&h=300"
            style={styles.heroImage}
            contentFit="contain"
          />
        </View>

        {/* 4. QUICK ACTIONS */}
        <View style={styles.quickRow}>
          {PHARMA_QUICK_ACTIONS.map((action) => (
            <QuickActionCard
              key={action.id}
              item={action}
              onPress={onQuickAction}
            />
          ))}
        </View>

        {/* 5. SHOP BY CATEGORY */}
        <AppText style={styles.sectionHeader}>Shop by Category</AppText>
        <View style={styles.categoryGrid}>
          {PHARMA_ALL_CATEGORIES.map((item) => renderCategory({ item }))}
        </View>

        {/* 6. TRUST & OFFERS STRIP */}
        <View style={styles.offersStrip}>
          {PHARMA_OFFERS_BADGES.map((badge) => (
            <OfferBadgeItem key={badge.id} item={badge} />
          ))}
        </View>

        {/* 7. UPLOAD PRESCRIPTION CTA */}
        <TouchableOpacity
          style={styles.ctaBanner}
          activeOpacity={0.85}
          onPress={() => onQuickAction?.({ id: 2, title: 'Upload Prescription', icon: 'upload', bgColor: '#EFF8F8' })}
          accessibilityRole="button"
        >
          <View style={styles.ctaLeft}>
            <View style={styles.ctaIconWrap}>
              <FileText size={ms(22)} color="#FFFFFF" strokeWidth={2} />
            </View>
            <View style={styles.ctaTextStack}>
              <AppText style={styles.ctaTitle}>Upload Prescription</AppText>
              <AppText style={styles.ctaSubtitle}>
                Get medicines delivered at your doorstep
              </AppText>
            </View>
          </View>
          <View style={styles.ctaButton}>
            <AppText style={styles.ctaButtonText}>Upload Now</AppText>
            <ChevronRight size={ms(14)} color={TEAL} strokeWidth={2.5} />
          </View>
        </TouchableOpacity>

        {/* 8. FOOTER ASSURANCE */}
        <View style={styles.footerAssurance}>
          <Info size={ms(12)} color="#9E9E9E" strokeWidth={2} />
          <AppText style={styles.footerText}>
            We ensure 100% genuine products delivered safely to your doorstep.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

export default PharmaCategoriesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: vs(24),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    paddingBottom: vs(8),
  },
  backBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  topTitle: {
    fontSize: ms(20),
    fontWeight: '700',
    color: INK,
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
    backgroundColor: '#E8F6F7',
    borderRadius: ms(16),
    overflow: 'hidden',
    flexDirection: 'row',
    height: vs(140),
    padding: hs(16),
  },
  heroLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  heroRow1: {
    fontSize: ms(18),
    fontWeight: '700',
    color: INK,
  },
  heroRow2: {
    fontSize: ms(18),
    fontWeight: '700',
    color: TEAL,
  },
  heroFeatures: {
    marginTop: vs(12),
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  heroFeatureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: hs(8),
    marginBottom: vs(4),
  },
  heroFeatureText: {
    fontSize: ms(9),
    fontWeight: '600',
    color: GREY,
    marginLeft: hs(3),
    maxWidth: hs(90),
  },
  heroImage: {
    width: hs(110),
    height: hs(110),
  },
  quickRow: {
    marginHorizontal: hs(16),
    marginTop: vs(16),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#F7FCFC',
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#E6F0F0',
    paddingVertical: vs(10),
    paddingHorizontal: hs(6),
    alignItems: 'center',
    marginHorizontal: hs(3),
  },
  quickIconWrap: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(6),
  },
  quickTitle: {
    fontSize: ms(9.5),
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
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
    paddingHorizontal: hs(12),
  },
  categoryCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#F2F4F4',
    alignItems: 'center',
    paddingVertical: vs(10),
    paddingHorizontal: hs(4),
    marginBottom: vs(10),
    marginHorizontal: '1%',
  },
  categoryCircle: {
    width: ms(54),
    height: ms(54),
    borderRadius: ms(27),
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryImage: {
    width: ms(40),
    height: ms(40),
  },
  categoryLabel: {
    marginTop: vs(8),
    textAlign: 'center',
    fontSize: ms(10),
    fontWeight: '600',
    color: '#333333',
  },
  offersStrip: {
    marginHorizontal: hs(16),
    marginTop: vs(16),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  offerBox: {
    width: '48%',
    backgroundColor: '#F8FAF9',
    borderRadius: ms(8),
    padding: hs(10),
    marginBottom: vs(8),
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerIconWrap: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(15),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(8),
  },
  offerTextStack: {
    flex: 1,
  },
  offerTitle: {
    fontSize: ms(11),
    fontWeight: '700',
    color: INK,
  },
  offerSubtitle: {
    fontSize: ms(9),
    color: '#9E9E9E',
    marginTop: vs(1),
  },
  ctaBanner: {
    marginHorizontal: hs(16),
    marginTop: vs(12),
    backgroundColor: TEAL,
    borderRadius: ms(12),
    padding: hs(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ctaIconWrap: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(10),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(10),
  },
  ctaTextStack: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: ms(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ctaSubtitle: {
    fontSize: ms(11),
    color: '#DFF3F4',
    marginTop: vs(2),
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(20),
    paddingHorizontal: hs(14),
    paddingVertical: vs(8),
    marginLeft: hs(8),
  },
  ctaButtonText: {
    fontSize: ms(11),
    fontWeight: '700',
    color: TEAL,
    marginRight: hs(2),
  },
  footerAssurance: {
    marginHorizontal: hs(16),
    marginTop: vs(16),
    marginBottom: vs(28),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: '#9E9E9E',
    fontSize: ms(11),
    textAlign: 'center',
    marginLeft: hs(6),
  },
});
