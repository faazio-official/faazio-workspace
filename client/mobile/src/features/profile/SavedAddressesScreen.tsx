import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Briefcase,
  Heart,
  MapPin,
  Pencil,
  Trash2,
  Plus,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { savedAddresses } from '@data/index';
import type { SavedAddress } from '@data/types';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SavedAddresses'>;

const TAG_ICONS: Record<SavedAddress['tag'], React.ComponentType<any>> = {
  HOME: Home,
  WORK: Briefcase,
  OTHER: Heart,
};

interface AddressCardProps {
  item: SavedAddress;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function AddressCard({ item, isSelected, onSelect }: AddressCardProps) {
  const TagIcon = TAG_ICONS[item.tag];
  const handleSelect = useCallback(() => onSelect(item.id), [item.id, onSelect]);

  return (
    <TouchableOpacity
      onPress={handleSelect}
      activeOpacity={0.9}
      style={[styles.addressCard, isSelected ? styles.selectedCard : styles.unselectedCard]}
    >
      {/* Card Header — badges & actions */}
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <View style={styles.tagBadge}>
            <TagIcon size={ms(11)} color="#166534" strokeWidth={2.4} />
            <AppText style={styles.tagText}>{item.tag}</AppText>
          </View>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <AppText style={styles.defaultText}>Default Address</AppText>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Pencil size={ms(11)} color="#374151" strokeWidth={2.2} />
            <AppText style={styles.actionText}>Edit</AppText>
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Trash2 size={ms(11)} color="#374151" strokeWidth={2.2} />
            <AppText style={styles.actionText}>Delete</AppText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Card Body */}
      <View style={styles.cardBody}>
        <View style={styles.detailsContainer}>
          <AppText style={styles.userName}>{item.name}</AppText>
          <AppText style={styles.userPhone}>{item.phone}</AppText>
          <AppText style={styles.addressText}>{item.address}</AppText>

          <TouchableOpacity onPress={handleSelect} style={styles.deliverHereRow} activeOpacity={0.7}>
            <MapPin size={ms(14)} color="#16A34A" strokeWidth={2.2} />
            <AppText style={styles.deliverHereText}>Deliver here</AppText>
          </TouchableOpacity>
        </View>

        {/* Radio */}
        <TouchableOpacity onPress={handleSelect} style={styles.radioContainer} activeOpacity={0.8}>
          <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
            {isSelected && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export function SavedAddressesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string>(
    savedAddresses.find((a) => a.isDefault)?.id ?? savedAddresses[0]?.id ?? '',
  );
  const [showBanner, setShowBanner] = useState<boolean>(true);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  const handleAddNew = useCallback(() => {
    // TODO: Add New Address screen — no-op placeholder (no target screen yet).
  }, []);
  const handleGoogleMaps = useCallback(() => {
    // TODO: Add from Google Maps flow — no-op placeholder.
  }, []);
  const handleCloseBanner = useCallback(() => setShowBanner(false), []);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + vs(12) }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back">
              <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
            </TouchableOpacity>
            <View>
              <AppText style={styles.headerTitle}>Addresses</AppText>
              <AppText style={styles.headerSubtitle}>Manage your saved addresses</AppText>
            </View>
          </View>
          <TouchableOpacity onPress={handleAddNew} style={styles.addNewBtn} activeOpacity={0.7}>
            <Plus size={ms(14)} color="#16A34A" strokeWidth={2.6} />
            <AppText style={styles.addNewText}>Add New</AppText>
          </TouchableOpacity>
        </View>

        {/* Section title */}
        <AppText style={styles.sectionTitle}>Saved Addresses</AppText>

        {/* Address cards */}
        {savedAddresses.map((item) => (
          <AddressCard
            key={item.id}
            item={item}
            isSelected={selectedId === item.id}
            onSelect={setSelectedId}
          />
        ))}

        {/* Tip banner */}
        {showBanner && (
          <View style={styles.tipBanner}>
            <View style={styles.tipIconBox}>
              <MapPin size={ms(24)} color="#16A34A" strokeWidth={2.2} />
            </View>
            <View style={styles.tipTextContainer}>
              <AppText style={styles.tipTitle}>Add accurate addresses</AppText>
              <AppText style={styles.tipSubtitle}>
                This helps us deliver your orders faster and avoid any delivery issues.
              </AppText>
            </View>
            <TouchableOpacity onPress={handleCloseBanner} style={styles.closeBannerBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Dismiss">
              <X size={ms(16)} color="#9CA3AF" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        )}

        {/* Google Maps card */}
        <TouchableOpacity onPress={handleGoogleMaps} style={styles.mapCard} activeOpacity={0.8}>
          <View style={styles.mapCardLeft}>
            <View style={styles.mapIconCircle}>
              <MapPin size={ms(16)} color="#16A34A" strokeWidth={2.2} />
            </View>
            <AppText style={styles.mapCardTitle}>Add from Google Maps</AppText>
          </View>
          <ChevronRight size={ms(18)} color="#9CA3AF" strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  bottomSpacer: {
    height: vs(40),
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACE.BLOCK,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: hs(10),
    padding: hs(2),
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: ms(12),
    fontWeight: '500',
    color: '#6B7280',
    marginTop: vs(2),
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(4),
    paddingHorizontal: hs(8),
  },
  addNewText: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#16A34A',
    marginLeft: hs(3),
  },

  /* Section */
  sectionTitle: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#111827',
    marginBottom: SPACE.BLOCK,
    marginLeft: hs(2),
  },

  /* Address Card */
  addressCard: {
    borderRadius: ms(16),
    padding: hs(16),
    marginBottom: SPACE.BLOCK,
    borderWidth: 1,
  },
  selectedCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  unselectedCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.BLOCK,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
    marginRight: hs(8),
    gap: hs(4),
  },
  tagText: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#166534',
  },
  defaultBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  defaultText: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#4B5563',
  },

  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: hs(2),
    gap: hs(3),
  },
  actionText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#374151',
  },
  actionDivider: {
    width: 1,
    height: vs(12),
    backgroundColor: '#D1D5DB',
    marginHorizontal: hs(8),
  },

  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
    paddingRight: hs(12),
  },
  userName: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#111827',
    marginBottom: vs(2),
  },
  userPhone: {
    fontSize: ms(12),
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: vs(8),
  },
  addressText: {
    fontSize: ms(12),
    fontWeight: '500',
    color: '#4B5563',
    lineHeight: vs(18),
    marginBottom: SPACE.ITEM,
  },

  deliverHereRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  deliverHereText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#16A34A',
  },

  radioContainer: {
    padding: hs(4),
  },
  radioOuter: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#16A34A',
  },
  radioInner: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: '#16A34A',
  },

  /* Tip Banner */
  tipBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#DCFCE7',
    padding: hs(12),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACE.BLOCK,
  },
  tipIconBox: {
    marginRight: hs(12),
  },
  tipTextContainer: {
    flex: 1,
    paddingRight: hs(8),
  },
  tipTitle: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#111827',
    marginBottom: vs(2),
  },
  tipSubtitle: {
    fontSize: ms(11),
    fontWeight: '500',
    color: '#6B7280',
    lineHeight: vs(15),
  },
  closeBannerBtn: {
    padding: hs(4),
  },

  /* Google Maps Card */
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    padding: hs(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mapCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapIconCircle: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(12),
  },
  mapCardTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#111827',
  },
});
