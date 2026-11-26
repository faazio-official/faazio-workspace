import React, { memo, useCallback, useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { UtensilsCrossed } from 'lucide-react-native';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { AppImage } from '@/components/shared/AppImage';
import { gateway } from '@/services/api/GatewayClient';
import type { Category } from '@/services/api/GatewayClient';
import { localizedName } from '@/lib/localizedText';
import { useLanguageStore } from '@/state/languageStore';
import type { FoodStackParamList } from '@/navigation/types';
import { foodTheme } from '../constants/theme';

interface FoodCategoryRailProps {
  /** Extra style for the horizontal rail box. */
  style?: any;
}

/** One category chip — a round icon (server image or a food fallback) over its name. */
const CategoryChip = memo(function CategoryChip({
  category,
  language,
  onPress,
}: {
  category: Category;
  language: string;
  onPress: (category: Category) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const label = localizedName(category, language);
  const showImage = Boolean(category.iconUrl) && !imageFailed;

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(category)}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${label}`}
    >
      <View style={styles.iconCircle}>
        {showImage ? (
          <AppImage
            source={{ uri: category.iconUrl as string }}
            style={styles.image}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <UtensilsCrossed size={ms(26)} color={foodTheme.primaryDeep} strokeWidth={2} />
        )}
      </View>
      <AppText style={styles.label} numberOfLines={2}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
});

/**
 * Food home category rail — the superadmin-owned FOOD taxonomy roots (`GET /categories?app=FOOD`),
 * rendered directly below the paid hero. A root without an uploaded icon shows a rounded food glyph
 * instead of a blank tile, so every category stays tappable. Tapping opens the category drill-in.
 */
const FoodCategoryRail = memo(function FoodCategoryRail({ style }: FoodCategoryRailProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<FoodStackParamList>>();
  const language = useLanguageStore((s) => s.language);

  useEffect(() => {
    let active = true;
    gateway
      .fetchCategories('FOOD')
      .then((cats) => {
        if (active) setCategories(cats.filter((category) => category.parentId === null));
      })
      .catch(() => {
        // Honest empty rail: no fixture category chips when the taxonomy read fails.
      });
    return () => {
      active = false;
    };
  }, []);

  const onPress = useCallback(
    (cat: Category) => {
      navigation.navigate('FoodCategoryDrillIn', { categoryId: cat.id, title: cat.name });
    },
    [navigation],
  );

  if (categories.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.rail, style]}
      contentContainerStyle={styles.content}
    >
      {categories.map((category) => (
        <CategoryChip
          key={category.id}
          category={category}
          language={language}
          onPress={onPress}
        />
      ))}
    </ScrollView>
  );
});

export default FoodCategoryRail;

const styles = StyleSheet.create({
  rail: {
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    paddingHorizontal: hs(16),
    gap: hs(14),
    alignItems: 'flex-start',
  },
  item: {
    alignItems: 'center',
    width: hs(72),
  },
  iconCircle: {
    width: ms(60),
    height: ms(60),
    borderRadius: ms(30),
    backgroundColor: foodTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: vs(6),
  },
  image: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontSize: ms(12),
    fontWeight: '600',
    lineHeight: ms(15),
    color: foodTheme.textPrimary,
    textAlign: 'center',
  },
});
