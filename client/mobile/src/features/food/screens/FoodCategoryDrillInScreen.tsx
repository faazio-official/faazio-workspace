import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import AppText from '@/components/AppText';
import Button from '@/components/Button';
import { gateway, type Category } from '@/services/api/GatewayClient';
import { dishToProduct } from '@data/food/specials';
import { localizedName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';
import { useFoodFilterStore } from '@/state/foodFilterStore';
import type { FoodStackParamList, RootStackParamList } from '@/navigation/types';
import type { SpecialDish } from '../types';
import { productViewToDish } from '../utils/productViewToDish';
import { dishMatches } from '../utils/dietFilter';
import FoodDetailTopBar from '../components/FoodDetailTopBar';
import DietEmptyNote from '../components/DietEmptyNote';
import SearchDishCard from '../components/SearchDishCard';
import { foodTheme } from '../constants/theme';

/**
 * Food category drill-in. Resolves the tapped FOOD taxonomy node, shows its leaf sub-categories as
 * a chip rail (first selected) and lists the dishes the selected leaf's `searchQuery` resolves to
 * through the same server FTS the Food search uses. A childless category is its own single leaf, so
 * tapping any rail chip always lands on real, server-backed results or an honest empty state.
 */
export function FoodCategoryDrillInScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FoodStackParamList>>();
  const route = useRoute<any>(); // route.params: { categoryId, title }
  const { categoryId, title } = route.params ?? {};
  const language = useLanguageStore((s) => s.language);
  const dietFilter = useFoodFilterStore((s) => s.dietFilter);

  const [categories, setCategories] = useState<Category[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState(false);
  const [activeLeafId, setActiveLeafId] = useState<string | null>(null);
  const [dishes, setDishes] = useState<SpecialDish[]>([]);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [dishesError, setDishesError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setTreeLoading(true);
    setTreeError(false);
    gateway
      .fetchCategories('FOOD')
      .then((list) => {
        if (active) setCategories(list);
      })
      .catch(() => {
        if (!active) return;
        setCategories([]);
        setTreeError(true);
      })
      .finally(() => {
        if (active) setTreeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  const byParent = useMemo(() => {
    const map = new Map<string | null, Category[]>();
    for (const category of categories) {
      const key = category.parentId ?? null;
      const bucket = map.get(key);
      if (bucket) bucket.push(category);
      else map.set(key, [category]);
    }
    return map;
  }, [categories]);

  const node = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId],
  );

  /** Every leaf under the tapped node; a childless node is its own leaf. */
  const leaves = useMemo(() => {
    if (!node) return [] as Category[];
    const out: Category[] = [];
    const walk = (id: string) => {
      const children = byParent.get(id) ?? [];
      if (children.length === 0) {
        const leaf = categories.find((category) => category.id === id);
        if (leaf) out.push(leaf);
        return;
      }
      for (const child of children) walk(child.id);
    };
    walk(node.id);
    return out;
  }, [node, byParent, categories]);

  const activeLeaf = useMemo(
    () => leaves.find((leaf) => leaf.id === activeLeafId) ?? leaves[0],
    [leaves, activeLeafId],
  );

  const searchQuery = activeLeaf?.searchQuery?.trim() || activeLeaf?.name || '';

  /** Respect the shared Food veg/non-veg toggle without re-querying the server. */
  const visibleDishes = useMemo(
    () => dishes.filter((dish) => dishMatches(dietFilter, dish)),
    [dishes, dietFilter],
  );

  useEffect(() => {
    if (!activeLeaf || !searchQuery) {
      setDishes([]);
      setDishesLoading(false);
      setDishesError(false);
      return;
    }
    let active = true;
    setDishesLoading(true);
    setDishesError(false);
    gateway
      .searchProducts(searchQuery, 'FOOD')
      .then((rows) => {
        if (active) setDishes(rows.map(productViewToDish));
      })
      .catch(() => {
        if (!active) return;
        setDishes([]);
        setDishesError(true);
      })
      .finally(() => {
        if (active) setDishesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeLeaf, searchQuery, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const openDish = useCallback(
    (dish: SpecialDish) => {
      navigation
        .getParent<NativeStackNavigationProp<RootStackParamList>>()
        ?.navigate('ProductDetail', { product: dishToProduct(dish) });
    },
    [navigation],
  );

  const renderDish = useCallback(
    ({ item }: { item: SpecialDish }) => (
      <SearchDishCard dish={item} onPress={openDish} restaurantId={item.restaurantId} />
    ),
    [openDish],
  );

  const headerTitle = node ? localizedName(node, language) : title ?? 'Category';
  const cuisineLine = [node?.atomicCategory, node?.atomicSubcategory]
    .filter(Boolean)
    .join(' · ');

  const body = (() => {
    if (treeLoading) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={foodTheme.primaryDeep} />
        </View>
      );
    }
    if (treeError) {
      return (
        <View style={styles.stateWrap}>
          <AppText style={styles.stateTitle}>Could not load this category</AppText>
          <AppText style={styles.stateSub}>Check your connection and try again.</AppText>
          <Button
            label="Try again"
            onPress={retry}
            accent={foodTheme.primaryDeep}
            style={styles.retryBtn}
          />
        </View>
      );
    }
    if (!node) {
      return (
        <View style={styles.stateWrap}>
          <AppText style={styles.stateTitle}>Category not found</AppText>
          <AppText style={styles.stateSub}>It may have been removed or renamed.</AppText>
        </View>
      );
    }
    if (dishesLoading) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={foodTheme.primaryDeep} />
        </View>
      );
    }
    if (dishesError) {
      return (
        <View style={styles.stateWrap}>
          <AppText style={styles.stateTitle}>Could not load dishes</AppText>
          <AppText style={styles.stateSub}>Check your connection and try again.</AppText>
          <Button
            label="Try again"
            onPress={retry}
            accent={foodTheme.primaryDeep}
            style={styles.retryBtn}
          />
        </View>
      );
    }
    if (dishes.length === 0) {
      return (
        <View style={styles.stateWrap}>
          <AppText style={styles.stateTitle}>No dishes in this category yet</AppText>
          <AppText style={styles.stateSub}>Please check back soon.</AppText>
        </View>
      );
    }
    if (visibleDishes.length === 0) {
      return (
        <View style={styles.stateWrap}>
          <DietEmptyNote />
        </View>
      );
    }
    return (
      <FlatList
        data={visibleDishes}
        keyExtractor={(item) => item.id}
        renderItem={renderDish}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <AppText style={styles.resultsTitle}>
            {visibleDishes.length} {visibleDishes.length === 1 ? 'dish' : 'dishes'}
          </AppText>
        }
      />
    );
  })();

  return (
    <View style={styles.container}>
      <FoodDetailTopBar title={headerTitle} onBack={goBack} />
      {cuisineLine ? (
        <AppText style={styles.cuisineLine} numberOfLines={1}>
          {cuisineLine}
        </AppText>
      ) : null}
      {node && leaves.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRail}
          contentContainerStyle={styles.chipContent}
          keyboardShouldPersistTaps="handled"
        >
          {leaves.map((leaf) => {
            const isActive = activeLeaf?.id === leaf.id;
            return (
              <TouchableOpacity
                key={leaf.id}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveLeafId(leaf.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <AppText style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {localizedName(leaf, language)}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
      <View style={styles.body}>{body}</View>
    </View>
  );
}

export default FoodCategoryDrillInScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: foodTheme.background,
  },
  cuisineLine: {
    fontSize: ms(11),
    color: foodTheme.textSecondary,
    textAlign: 'center',
    paddingHorizontal: hs(16),
    paddingBottom: vs(4),
  },
  chipRail: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipContent: {
    paddingHorizontal: hs(16),
    paddingTop: vs(4),
    paddingBottom: SPACE.ITEM,
    gap: hs(10),
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: hs(16),
    paddingVertical: vs(8),
    borderRadius: ms(20),
    minHeight: vs(36),
    justifyContent: 'center',
    backgroundColor: foodTheme.white,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: foodTheme.primarySoft,
    borderColor: foodTheme.primary,
  },
  chipLabel: {
    fontSize: ms(13),
    fontWeight: '500',
    color: foodTheme.textSecondary,
  },
  chipLabelActive: {
    fontWeight: '600',
    color: foodTheme.primaryDeep,
  },
  body: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(32),
  },
  resultsTitle: {
    fontSize: ms(13),
    fontWeight: '600',
    color: foodTheme.textSecondary,
    paddingBottom: vs(10),
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(32),
  },
  stateTitle: {
    fontSize: ms(16),
    fontWeight: '600',
    color: foodTheme.textPrimary,
    textAlign: 'center',
  },
  stateSub: {
    fontSize: ms(13),
    color: foodTheme.textSecondary,
    textAlign: 'center',
    marginTop: vs(6),
  },
  retryBtn: {
    marginTop: vs(20),
    alignSelf: 'stretch',
  },
});
