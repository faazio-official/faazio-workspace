import React, { memo, useEffect, useState, useCallback } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, View } from 'react-native';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { AppImage } from '@/components/shared/AppImage';
import { gateway } from '@/services/api/GatewayClient';
import type { Category } from '@/services/api/GatewayClient';
import { useNavigation } from '@react-navigation/native';
import type { FoodStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface FoodCategoryRailProps {
  /** optional style for the scroll view */
  style?: any;
}

const FoodCategoryRail = memo(function FoodCategoryRail({ style }: FoodCategoryRailProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<FoodStackParamList>>();

  useEffect(() => {
    void (async () => {
      try {
        const cats = await gateway.fetchCategories('FOOD');
        setCategories(cats);
      } catch (e) {
        // ignore – empty state will render nothing
      }
    })();
  }, []);

  const onPress = useCallback((cat: Category) => {
    navigation.navigate('FoodCategoryDrillIn', { categoryId: cat.id, title: cat.name });
  }, [navigation]);

  if (categories.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={styles.content}>
      {categories.map((cat) => (
        <TouchableOpacity key={cat.id} style={styles.item} onPress={() => onPress(cat)} accessibilityRole="button">
          {cat.iconUrl ? (
            <AppImage source={{ uri: cat.iconUrl }} style={styles.image} contentFit="cover" />
          ) : null}
          <AppText style={styles.label} numberOfLines={1}>{cat.name}</AppText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
});

export default FoodCategoryRail;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: hs(16),
    gap: hs(12),
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    width: hs(80),
  },
  image: {
    width: hs(64),
    height: hs(64),
    borderRadius: ms(32),
    marginBottom: vs(4),
  },
  label: {
    fontSize: ms(12),
    textAlign: 'center',
  },
});