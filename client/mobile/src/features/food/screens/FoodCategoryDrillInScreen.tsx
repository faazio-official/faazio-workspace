import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { gateway } from '@/services/api/GatewayClient';
import type { Category } from '@/services/api/GatewayClient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { FoodStackParamList } from '@/navigation/types';
import CampaignHero from '@/components/shared/CampaignHero';
import { ChevronLeft, Search } from 'lucide-react-native';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';

type Props = {};

export function FoodCategoryDrillInScreen(props: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<FoodStackParamList>>();
  const route = useRoute<any>(); // route.params: { categoryId, title }
  const { categoryId, title } = route.params ?? {};
  const [subCategories, setSubCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!categoryId) return;
    void (async () => {
      try {
        const cats = await gateway.fetchCategories('FOOD', categoryId);
        setSubCategories(cats);
      } catch (e) {
        // ignore errors, render empty
      }
    })();
  }, [categoryId]);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const renderItem = ({ item }: { item: Category }) => (
    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('FoodCategoryDrillIn', { categoryId: item.id, title: item.name })}>
      <AppText style={styles.label}>{item.name}</AppText>
    </TouchableOpacity>
  );

return (
      <View style={styles.container}>
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Search size={18} color="#999" style={{ marginRight: 8 }} />
            <AppTextInput
              placeholder="Search"
              style={{ flex: 1 }}
            />
          </View>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <ChevronLeft size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        <CampaignHero placement="FOOD_CATEGORY" style={{ height: hs(120) }} />
        <AppText style={styles.title}>{title ?? 'Category'}</AppText>
        <FlatList data={subCategories} keyExtractor={(i) => i.id} renderItem={renderItem} contentContainerStyle={styles.list} />
      </View>
    );
}

export default FoodCategoryDrillInScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  backBtn: { marginBottom: 12 },
  backAppText: { color: '#007AFF' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  list: { paddingBottom: 20 },
  item: { paddingVertical: 8 },
  label: { fontSize: 16 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', flex: 1, backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 8, height: 36 },
});