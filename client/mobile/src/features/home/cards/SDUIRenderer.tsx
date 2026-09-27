import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { brandTokens } from '@/theme/brandTokens';
import MartProductCard from '@/features/ecommerce/cards/MartProductCard';
import FoodProductCard from '@/features/food/cards/FoodProductCard';
import PharmaProductCard from '@/features/pharma/cards/PharmaProductCard';
import HomeRailCard from './HomeRailCard';
import StoreCardBase from '@/components/shared/StoreCardBase';
import type { SDUINode } from '@data/schema';
import type { AppBrand } from '@data/types';
import AppText from '@/components/AppText';

interface SDUIRendererProps {
  node: SDUINode;
  onProductClick?: (product: any) => void;
  onAddToCart?: (id: string, name: string, price: number, emoji: string) => void;
  cartQuantities?: Record<string, number>;
  addedIds?: Set<string>;
  favorites?: string[];
  onToggleFavorite?: (id: string) => void;
}

function renderProductCard(node: SDUINode, props: SDUIRendererProps) {
  if (node.type !== 'ProductCard') return null;
  const p = node.props;
  const qty = props.cartQuantities?.[p.id] || 0;
  const isAdded = props.addedIds?.has(p.id) || false;
  const isFav = props.favorites?.includes(p.id) || false;
  const cardProps = {
    product: p,
    quantity: qty,
    isAdded,
    isFavorite: isFav,
    onPress: () => props.onProductClick?.(p),
    onAdd: () => props.onAddToCart?.(p.id, p.name, p.price, p.emoji),
    onIncrement: () => {},
    onDecrement: () => {},
    onFavorite: () => props.onToggleFavorite?.(p.id),
  };
  switch (node.appBrand) {
    case 'MART': return <MartProductCard {...cardProps} />;
    case 'FOOD': return <FoodProductCard {...cardProps} />;
    case 'PHARMA': return <PharmaProductCard {...cardProps} />;
    default: return <FoodProductCard {...cardProps} />;
  }
}

function renderRail(node: SDUINode, { onProductClick, onAddToCart, cartQuantities, addedIds, favorites, onToggleFavorite }: SDUIRendererProps) {
  if (node.type !== 'Rail') return null;
  return (
    <View style={railStyles.wrapper}>
      {node.title && <AppText style={railStyles.title}>{node.title}</AppText>}
      {node.subtitle && <AppText style={railStyles.subtitle}>{node.subtitle}</AppText>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={railStyles.scroll}>
        {node.children.map((child, i) => (
          <View key={i} style={railStyles.itemWrap}>
            <SDUIRenderer node={child} onProductClick={onProductClick} onAddToCart={onAddToCart} cartQuantities={cartQuantities} addedIds={addedIds} favorites={favorites} onToggleFavorite={onToggleFavorite} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function renderSection(node: SDUINode, { onProductClick, onAddToCart, cartQuantities, addedIds, favorites, onToggleFavorite }: SDUIRendererProps) {
  if (node.type !== 'Section') return null;
  const spacing = node.spacing === 'sm' ? SPACE.ITEM : node.spacing === 'lg' ? SPACE.SECTION : SPACE.BLOCK;
  return (
    <View style={{ marginBottom: spacing }}>
      {node.title && <AppText style={sectionStyles.title}>{node.title}</AppText>}
      {node.subtitle && <AppText style={sectionStyles.subtitle}>{node.subtitle}</AppText>}
      {node.children.map((child, i) => (
        <SDUIRenderer key={i} node={child} onProductClick={onProductClick} onAddToCart={onAddToCart} cartQuantities={cartQuantities} addedIds={addedIds} favorites={favorites} onToggleFavorite={onToggleFavorite} />
      ))}
    </View>
  );
}

function renderCategoryPill(node: SDUINode) {
  if (node.type !== 'CategoryPill') return null;
  return (
    <View style={[pillStyles.pill, { backgroundColor: node.color + '20', borderColor: node.color }]}>
      <AppText style={{ fontSize: ms(14) }}>{node.emoji}</AppText>
      <AppText style={[pillStyles.label, { color: node.color }]}>{node.label}</AppText>
    </View>
  );
}

function renderSearchBar(node: SDUINode) {
  if (node.type !== 'SearchBar') return null;
  return (
    <View style={searchStyles.bar}>
      <AppText style={searchStyles.text}>🔍 {node.placeholder || 'Search...'}</AppText>
    </View>
  );
}

function renderEmptyState(node: SDUINode) {
  if (node.type !== 'EmptyState') return null;
  return (
    <View style={emptyStyles.container}>
      <AppText style={{ fontSize: ms(32) }}>{node.icon || '📭'}</AppText>
      <AppText style={emptyStyles.message}>{node.message}</AppText>
    </View>
  );
}

export default function SDUIRenderer(props: SDUIRendererProps) {
  const { node } = props;
  switch (node.type) {
    case 'ProductCard': return renderProductCard(node, props);
    case 'Rail': return renderRail(node, props);
    case 'Section': return renderSection(node, props);
    case 'CategoryPill': return renderCategoryPill(node);
    case 'SearchBar': return renderSearchBar(node);
    case 'EmptyState': return renderEmptyState(node);
    case 'StoreCard': return <StoreCardBase store={node.props} onPress={() => props.onProductClick?.(node.props)} />;
    default: return null;
  }
}

const railStyles = StyleSheet.create({
  wrapper: { marginBottom: vs(4) },
  title: { fontSize: ms(13), fontWeight: '900', color: '#0f172a', paddingHorizontal: hs(16), marginBottom: vs(2), textTransform: 'uppercase' },
  subtitle: { fontSize: ms(9), fontWeight: '600', color: '#64748b', paddingHorizontal: hs(16), marginBottom: vs(8) },
  scroll: { paddingHorizontal: hs(16), paddingBottom: vs(8) },
  itemWrap: { marginRight: hs(8) },
});

const sectionStyles = StyleSheet.create({
  title: { fontSize: ms(13), fontWeight: '900', color: '#0f172a', paddingHorizontal: hs(16), marginBottom: vs(2), textTransform: 'uppercase' },
  subtitle: { fontSize: ms(9), fontWeight: '600', color: '#64748b', paddingHorizontal: hs(16), marginBottom: vs(8) },
});

const pillStyles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: hs(10), paddingVertical: vs(6), borderRadius: ms(16), borderWidth: 1, marginRight: hs(8) },
  label: { fontSize: ms(9), fontWeight: '800', marginLeft: hs(4) },
});

const searchStyles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: ms(16), paddingHorizontal: hs(12), height: vs(44), marginBottom: vs(12), borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: hs(16) },
  text: { fontSize: ms(11), fontWeight: '700', color: '#94a3b8' },
});

const emptyStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: vs(60) },
  message: { fontSize: ms(12), fontWeight: '900', color: '#0f172a', marginTop: vs(8) },
});
