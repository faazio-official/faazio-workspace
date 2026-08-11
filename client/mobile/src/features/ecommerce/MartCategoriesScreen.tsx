import React, { memo, useCallback } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import MartImage from './components/mart-home/MartImage';
import { MART_ALL_CATEGORIES, type MartCategoryTile } from './mocks/martAllCategories';

const CIRCLE_SIZE = ms(70);
const CIRCLE_RADIUS = CIRCLE_SIZE / 2;
const ICON_SIZE = ms(45);

interface MartCategoriesScreenProps {
  onCategoryPress?: (category: MartCategoryTile) => void;
}

const HeroBanner = memo(function HeroBanner() {
  return (
    <LinearGradient
      colors={['#4F46E5', '#7C3AED']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroLeft}>
        <AppText style={styles.heroTitle}>
          Explore Top{'\n'}Categories
        </AppText>
        <AppText style={styles.heroSubtitle}>
          Find everything you need in one place!
        </AppText>
      </View>
      <View style={styles.heroRight}>
        <MartImage
          uri="https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?fm=jpg&fit=crop&q=80&w=400&h=400"
          style={styles.heroImage}
          contentFit="contain"
        />
      </View>
    </LinearGradient>
  );
});

const CategoryTile = memo(function CategoryTile({
  item,
  onPress,
}: {
  item: MartCategoryTile;
  onPress?: (category: MartCategoryTile) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={() => onPress?.(item)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={[styles.circle, { backgroundColor: item.bgColor }]}>
        <MartImage uri={item.imageUrl} style={styles.icon} contentFit="contain" />
      </View>
      <AppText style={styles.label} numberOfLines={2}>
        {item.name}
      </AppText>
    </TouchableOpacity>
  );
});

export function MartCategoriesScreen({ onCategoryPress }: MartCategoriesScreenProps) {
  const renderItem = useCallback(
    ({ item }: { item: MartCategoryTile }) => (
      <CategoryTile item={item} onPress={onCategoryPress} />
    ),
    [onCategoryPress],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={MART_ALL_CATEGORIES}
        keyExtractor={(item) => item.id}
        numColumns={4}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={<HeroBanner />}
        ListFooterComponent={<View style={styles.footer} />}
      />
    </View>
  );
}

export default MartCategoriesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingBottom: vs(24),
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
  },
  hero: {
    marginHorizontal: hs(16),
    marginTop: vs(16),
    marginBottom: vs(24),
    borderRadius: ms(16),
    overflow: 'hidden',
    flexDirection: 'row',
    padding: ms(20),
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: vs(140),
  },
  heroLeft: {
    flex: 1,
    paddingRight: hs(10),
  },
  heroTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: ms(22),
    lineHeight: ms(28),
  },
  heroSubtitle: {
    color: '#FFFFFF',
    fontSize: ms(14),
    marginTop: vs(8),
    opacity: 0.9,
  },
  heroRight: {
    width: ms(100),
    height: ms(100),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: ms(100),
    height: ms(100),
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    maxWidth: '22%',
    marginBottom: vs(24),
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  label: {
    marginTop: vs(8),
    textAlign: 'center',
    fontSize: ms(11),
    fontWeight: '600',
    color: '#333333',
  },
  footer: {
    height: vs(8),
  },
});
