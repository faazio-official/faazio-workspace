import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  ArrowLeft,
  Trash2,
  Heart,
  Minus,
  Plus,
  ChevronDown,
  LayoutGrid,
  ShoppingBag,
  Utensils,
  Pill,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import {
  filterChips,
  favCategories,
  favsSummary,
  type FavIconKey,
  type FilterChip,
} from './mocks';

const ICON_MAP: Record<FavIconKey, LucideIcon> = {
  grid: LayoutGrid,
  bag: ShoppingBag,
  food: Utensils,
  pharma: Pill,
};

interface FavouritesViewProps {
  onBack?: () => void;
}

function ChipIcon({ icon, color, size }: { icon: FavIconKey; color: string; size: number }) {
  const Icon = ICON_MAP[icon];
  return <Icon size={ms(size)} color={color} strokeWidth={2.4} />;
}

export default function FavouritesView({ onBack }: FavouritesViewProps) {
  const [activeChip, setActiveChip] = useState<FilterChip['id']>('all');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [cleared, setCleared] = useState(false);
  const insets = useSafeAreaInsets();

  const visibleCategories =
    activeChip === 'all'
      ? favCategories
      : favCategories.filter((cat) => cat.id === activeChip);

  const allItems = favCategories.flatMap((cat) => cat.items);
  const visibleItems = visibleCategories.flatMap((cat) => cat.items);

  const totalCount = allItems.length;
  const displayCount = visibleCategories === favCategories ? totalCount : visibleItems.length;

  const bumpQty = (id: string, delta: number) => {
    setQuantities((prev) => {
      const next = (prev[id] ?? 0) + delta;
      const copy = { ...prev };
      if (next <= 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  };

  const qtyOf = (id: string) => quantities[id] ?? 0;

  const chipLabel = (chip: FilterChip) =>
    chip.id === 'all' ? `${chip.label} (${chip.count})` : chip.label;

  return (
    <View style={styles.root}>
      {/* 1. Fixed Top Navigation Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + vs(12) }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={ms(20)} color="#1E2022" strokeWidth={2.4} />
        </TouchableOpacity>
        <AppText style={styles.topBarTitle}>Favourites</AppText>
        <TouchableOpacity
          onPress={() => {
            setCleared(true);
            setQuantities({});
          }}
          style={styles.trashBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Trash2 size={ms(20)} color="#4B5563" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* 2. Filter Chips Row */}
      <View style={styles.chipsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {filterChips.map((chip) => {
            const isActive = activeChip === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => setActiveChip(chip.id)}
                style={[
                  styles.chip,
                  isActive ? styles.chipActive : styles.chipInactive,
                ]}
                activeOpacity={0.8}
              >
                <ChipIcon
                  icon={chip.icon}
                  color={isActive ? '#ffffff' : chipColor(chip.id)}
                  size={12}
                />
                <AppText
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : styles.chipTextInactive,
                  ]}
                >
                  {chipLabel(chip)}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Scrollable categorized list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {cleared || totalCount === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Heart size={ms(22)} color="#FB7185" strokeWidth={2} />
            </View>
            <AppText style={styles.emptyTitle}>No Favourites Yet</AppText>
            <AppText style={styles.emptyDesc}>
              Tap the heart icon on any product across Mart, Food, Grocery, or
              Pharma to add it to your favourites.
            </AppText>
            <TouchableOpacity
              onPress={() => setCleared(false)}
              style={styles.emptyAction}
              activeOpacity={0.8}
            >
              <AppText style={styles.emptyActionText}>Restore Favourites</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          visibleCategories.map((cat) => {
            const items = cat.items;
            if (items.length === 0) return null;
            return (
              <View key={cat.id} style={styles.categoryCard}>
                {/* Category Header */}
                <View style={styles.catHeader}>
                  <View style={styles.catHeaderLeft}>
                    <ChipIcon icon={cat.icon} color={cat.color} size={18} />
                    <AppText style={styles.catTitle}>{cat.title}</AppText>
                  </View>
                  <View style={styles.catHeaderRight}>
                    <AppText style={styles.catCount}>{items.length} items</AppText>
                    <ChevronDown size={ms(16)} color="#118C4F" strokeWidth={2.6} />
                  </View>
                </View>

                {/* Item Rows */}
                {items.map((item, idx) => {
                  const isLast = idx === items.length - 1;
                  const qty = qtyOf(item.id);
                  return (
                    <View
                      key={item.id}
                      style={[styles.itemRow, !isLast && styles.itemRowBorder]}
                    >
                      <View style={styles.thumb}>
                        <AppText style={styles.thumbEmoji}>🛍️</AppText>
                      </View>

                      <View style={styles.itemDetails}>
                        <AppText style={styles.itemName} numberOfLines={2}>
                          {item.name}
                        </AppText>
                        <AppText style={styles.itemQty}>{item.qty}</AppText>
                        <View style={styles.priceRow}>
                          <AppText style={styles.itemPrice}>₹{item.price}</AppText>
                          <AppText style={styles.itemOldPrice}>₹{item.oldPrice}</AppText>
                          <AppText style={styles.itemDiscount}>{item.discount}</AppText>
                        </View>
                      </View>

                      <View style={styles.itemActions}>
                        <View style={styles.heartWrap}>
                          <Heart size={ms(14)} color="#E11D48" fill="#E11D48" />
                        </View>
                        <View style={styles.stepper}>
                          <TouchableOpacity
                            onPress={() => bumpQty(item.id, -1)}
                            style={styles.stepperBtn}
                            activeOpacity={0.8}
                          >
                            <Minus size={ms(12)} color="#118C4F" strokeWidth={2.6} />
                          </TouchableOpacity>
                          <AppText style={styles.stepperValue}>{qty}</AppText>
                          <TouchableOpacity
                            onPress={() => bumpQty(item.id, 1)}
                            style={styles.stepperBtn}
                            activeOpacity={0.8}
                          >
                            <Plus size={ms(12)} color="#118C4F" strokeWidth={2.6} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 4. Sticky Bottom Action Bar */}
      {!cleared && totalCount > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomDetails}>
            <Heart size={ms(16)} color="#118C4F" fill="#118C4F" />
            <View>
              <AppText style={styles.bottomCountText}>
                {displayCount} items in favourites
              </AppText>
              <View style={styles.bottomTotalRow}>
                <AppText style={styles.bottomTotal}>{favsSummary.total}</AppText>
                <AppText style={styles.bottomOldTotal}>{favsSummary.oldTotal}</AppText>
              </View>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              allItems.forEach((i) => bumpQty(i.id, 1));
            }}
            style={styles.addAllBtn}
            activeOpacity={0.88}
          >
            <AppText style={styles.addAllText}>Add All to Cart ({displayCount})</AppText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function chipColor(id: FilterChip['id']): string {
  switch (id) {
    case 'mart':
      return '#118C4F';
    case 'food':
      return '#F97316';
    case 'pharma':
      return '#0EA5E9';
    default:
      return '#64748B';
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: vs(12),
    backgroundColor: '#ffffff',
  },
  backBtn: {
    width: ms(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: ms(18),
    fontWeight: 'bold',
    color: '#1E2022',
  },
  trashBtn: {
    width: ms(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsBar: {
    backgroundColor: '#ffffff',
  },
  chipsContent: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(16),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ms(20),
    paddingHorizontal: hs(12),
    paddingVertical: vs(8),
    marginRight: hs(8),
  },
  chipActive: {
    backgroundColor: '#118C4F',
  },
  chipInactive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipText: {
    fontSize: ms(12),
    fontWeight: '600',
    marginLeft: hs(5),
  },
  chipTextActive: {
    color: '#ffffff',
  },
  chipTextInactive: {
    color: '#1E2022',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(20),
  },
  categoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    padding: hs(16),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginTop: vs(16),
    marginBottom: vs(12),
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(16),
  },
  catHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  catTitle: {
    fontSize: ms(15),
    fontWeight: 'bold',
    color: '#1E2022',
  },
  catHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
  catCount: {
    fontSize: ms(12),
    color: '#888888',
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: vs(12),
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  thumb: {
    width: ms(60),
    height: ms(60),
    borderRadius: ms(8),
    backgroundColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: {
    fontSize: ms(22),
  },
  itemDetails: {
    flex: 1,
    paddingHorizontal: hs(12),
  },
  itemName: {
    fontSize: ms(13),
    fontWeight: 'bold',
    color: '#1E2022',
  },
  itemQty: {
    fontSize: ms(11),
    color: '#888888',
    marginTop: vs(4),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(8),
  },
  itemPrice: {
    fontSize: ms(13),
    fontWeight: 'bold',
    color: '#1E2022',
  },
  itemOldPrice: {
    fontSize: ms(11),
    color: '#888888',
    textDecorationLine: 'line-through',
    marginLeft: hs(6),
  },
  itemDiscount: {
    fontSize: ms(9),
    color: '#118C4F',
    fontWeight: 'bold',
    marginLeft: hs(8),
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heartWrap: {
    width: ms(26),
    height: ms(26),
    borderRadius: ms(6),
    backgroundColor: '#FFE9EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#118C4F',
    borderRadius: ms(8),
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
  },
  stepperValue: {
    fontSize: ms(12),
    fontWeight: 'bold',
    color: '#1E2022',
    minWidth: ms(24),
    textAlign: 'center',
  },
  bottomBar: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    paddingBottom: vs(24),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#D5EAD8',
  },
  bottomDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    flexShrink: 1,
  },
  bottomCountText: {
    fontSize: ms(12),
    fontWeight: 'bold',
    color: '#118C4F',
  },
  bottomTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(2),
  },
  bottomTotal: {
    fontSize: ms(13),
    fontWeight: 'bold',
    color: '#1E2022',
  },
  bottomOldTotal: {
    fontSize: ms(11),
    color: '#888888',
    textDecorationLine: 'line-through',
    marginLeft: hs(6),
  },
  addAllBtn: {
    backgroundColor: '#118C4F',
    borderRadius: ms(8),
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    marginLeft: hs(10),
  },
  addAllText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: ms(13),
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    paddingVertical: vs(48),
    paddingHorizontal: hs(16),
    alignItems: 'center',
    marginTop: vs(16),
  },
  emptyIconCircle: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(12),
  },
  emptyTitle: {
    fontSize: ms(15),
    fontWeight: 'bold',
    color: '#1E2022',
  },
  emptyDesc: {
    fontSize: ms(12),
    color: '#888888',
    textAlign: 'center',
    marginTop: vs(6),
    lineHeight: ms(18),
  },
  emptyAction: {
    marginTop: vs(16),
    backgroundColor: '#118C4F',
    borderRadius: ms(8),
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
  },
  emptyActionText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: ms(13),
  },
});
