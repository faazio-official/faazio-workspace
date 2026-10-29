import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Switch,
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
import AppTextInput from '@/components/AppTextInput';
import InfoButton from '@/components/shared/InfoButton';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { savedAddresses } from '@data/index';
import type { SavedAddress, AddressTag } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';
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
  onEdit: (item: SavedAddress) => void;
  onDelete: (item: SavedAddress) => void;
}

function AddressCard({ item, isSelected, onSelect, onEdit, onDelete }: AddressCardProps) {
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
          <TouchableOpacity
            onPress={() => onEdit(item)}
            style={styles.actionBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.tag} address`}
          >
            <Pencil size={ms(11)} color="#374151" strokeWidth={2.2} />
            <AppText style={styles.actionText}>Edit</AppText>
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <TouchableOpacity
            onPress={() => onDelete(item)}
            style={styles.actionBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.tag} address`}
          >
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

const TAG_OPTIONS: AddressTag[] = ['HOME', 'WORK', 'OTHER'];

function blankAddress(): SavedAddress {
  return { id: '', tag: 'HOME', isDefault: false, name: '', phone: '', address: '' };
}

interface AddressEditorProps {
  visible: boolean;
  initial: SavedAddress | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: SavedAddress) => void;
  onDelete: (item: SavedAddress) => void;
}

/** Add / edit sheet for a saved address. Purely presentational — the screen owns the gateway write. */
function AddressEditor({ visible, initial, saving, onClose, onSave, onDelete }: AddressEditorProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SavedAddress>(() => initial ?? blankAddress());

  // Re-seed the form each time the sheet opens (or the target row changes).
  useEffect(() => {
    if (visible) setDraft(initial ?? blankAddress());
  }, [visible, initial]);

  const isNew = !initial || initial.id === '';
  const canSave = draft.name.trim().length > 0 && draft.address.trim().length > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + SPACE.BLOCK }]}>
          <View style={styles.modalHeader}>
            <AppText style={styles.modalTitle}>{isNew ? 'Add New Address' : 'Edit Address'}</AppText>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={ms(18)} color="#6B7280" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AppText style={styles.fieldLabel}>Address type</AppText>
            <View style={styles.tagRow}>
              {TAG_OPTIONS.map((tag) => {
                const TagIcon = TAG_ICONS[tag];
                const active = draft.tag === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setDraft((d) => ({ ...d, tag }))}
                    style={[styles.tagOption, active && styles.tagOptionActive]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <TagIcon size={ms(13)} color={active ? '#166534' : '#6B7280'} strokeWidth={2.4} />
                    <AppText style={[styles.tagOptionText, active && styles.tagOptionTextActive]}>{tag}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <AppText style={styles.fieldLabel}>Full name</AppText>
            <AppTextInput
              style={styles.fieldInput}
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder="Recipient name"
              placeholderTextColor="#9CA3AF"
            />

            <AppText style={styles.fieldLabel}>Phone</AppText>
            <AppTextInput
              style={styles.fieldInput}
              value={draft.phone}
              onChangeText={(phone) => setDraft((d) => ({ ...d, phone }))}
              placeholder="+91 98765 43210"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />

            <AppText style={styles.fieldLabel}>Address</AppText>
            <AppTextInput
              style={[styles.fieldInput, styles.fieldInputMultiline]}
              value={draft.address}
              onChangeText={(address) => setDraft((d) => ({ ...d, address }))}
              placeholder="House / street / area / city / PIN"
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.defaultRow}>
              <View style={styles.defaultCopy}>
                <AppText style={styles.defaultTitle}>Set as default</AppText>
                <AppText style={styles.defaultSub}>Use this address first at checkout.</AppText>
              </View>
              <Switch
                value={!!draft.isDefault}
                onValueChange={(isDefault) => setDraft((d) => ({ ...d, isDefault }))}
                trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                thumbColor={draft.isDefault ? '#16A34A' : '#F3F4F6'}
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            {!isNew && (
              <TouchableOpacity
                onPress={() => onDelete(initial as SavedAddress)}
                style={styles.modalDeleteBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Delete address"
              >
                <Trash2 size={ms(15)} color="#DC2626" strokeWidth={2.3} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => onSave(draft)}
              disabled={!canSave}
              style={[styles.modalSaveBtn, !canSave && styles.modalSaveBtnDisabled]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <AppText style={styles.modalSaveText}>{isNew ? 'Add Address' : 'Save Changes'}</AppText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function SavedAddressesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [addresses, setAddresses] = useState<SavedAddress[]>(savedAddresses);
  const [selectedId, setSelectedId] = useState<string>('');
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [saving, setSaving] = useState(false);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  // Hydrate the caller's durable addresses; keep the @data fixtures when empty/mock/error.
  useEffect(() => {
    let alive = true;
    gateway
      .getAddresses()
      .then((rows) => {
        if (alive && rows.length > 0) setAddresses(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Explicit selection wins; otherwise default → first.
  const activeId = useMemo(
    () => selectedId || addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || '',
    [selectedId, addresses],
  );

  const openAdd = useCallback(() => {
    setEditing(null);
    setEditorVisible(true);
  }, []);
  const openEdit = useCallback((item: SavedAddress) => {
    setEditing(item);
    setEditorVisible(true);
  }, []);
  const closeEditor = useCallback(() => {
    if (!saving) setEditorVisible(false);
  }, [saving]);

  const deleteAddress = useCallback(async (item: SavedAddress) => {
    try {
      await gateway.deleteAddress(item.id);
    } catch {
      // The server rejects a foreign/unknown id; still drop it locally so the UI is consistent.
    }
    setAddresses((prev) => prev.filter((a) => a.id !== item.id));
    setSelectedId((cur) => (cur === item.id ? '' : cur));
    setEditorVisible(false);
  }, []);

  const handleDelete = useCallback(
    (item: SavedAddress) => {
      Alert.alert('Delete address?', 'This address will be removed from your saved list.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteAddress(item) },
      ]);
    },
    [deleteAddress],
  );

  const handleSave = useCallback(async (draft: SavedAddress) => {
    setSaving(true);
    try {
      const saved = await gateway.saveAddress(draft);
      // The server mints the id for a new address; mock mode echoes an empty id — assign a local one.
      const withId: SavedAddress = saved.id ? saved : { ...saved, id: `addr-local-${Date.now()}` };
      setAddresses((prev) => {
        // A new default clears the others (mirrors the server).
        const base = withId.isDefault ? prev.map((a) => ({ ...a, isDefault: false })) : prev;
        const idx = base.findIndex((a) => a.id === withId.id);
        if (idx < 0) return [...base, withId];
        const copy = [...base];
        copy[idx] = withId;
        return copy;
      });
      setSelectedId(withId.id);
      setEditorVisible(false);
    } catch {
      Alert.alert('Could not save', 'Please check the address and try again.');
    } finally {
      setSaving(false);
    }
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: hs(8) }}>
            <TouchableOpacity onPress={openAdd} style={styles.addNewBtn} activeOpacity={0.7}>
              <Plus size={ms(14)} color="#16A34A" strokeWidth={2.6} />
              <AppText style={styles.addNewText}>Add New</AppText>
            </TouchableOpacity>
            <InfoButton contentKey="SavedAddresses" />
          </View>
        </View>

        {/* Section title */}
        <AppText style={styles.sectionTitle}>Saved Addresses</AppText>

        {/* Address cards */}
        {addresses.map((item) => (
          <AddressCard
            key={item.id}
            item={item}
            isSelected={activeId === item.id}
            onSelect={setSelectedId}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        ))}
        {addresses.length === 0 && (
          <View style={styles.emptyCard}>
            <MapPin size={ms(24)} color="#9CA3AF" strokeWidth={2.2} />
            <AppText style={styles.emptyTitle}>No saved addresses yet</AppText>
            <AppText style={styles.emptySub}>Tap “Add New” to save your first delivery address.</AppText>
          </View>
        )}

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

      <AddressEditor
        visible={editorVisible}
        initial={editing}
        saving={saving}
        onClose={closeEditor}
        onSave={handleSave}
        onDelete={handleDelete}
      />
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

  /* Empty state */
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    paddingHorizontal: hs(24),
    paddingVertical: vs(32),
    gap: SPACE.BLOCK,
  },
  emptyTitle: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: ms(11),
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: vs(16),
  },

  /* Address editor sheet */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: ms(20),
    borderTopRightRadius: ms(20),
    paddingHorizontal: hs(20),
    paddingTop: SPACE.SECTION,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.BLOCK,
  },
  modalTitle: {
    fontSize: ms(17),
    fontWeight: '800',
    color: '#111827',
  },
  modalClose: {
    padding: hs(4),
  },
  modalBody: {
    flexGrow: 0,
  },
  modalBodyContent: {
    gap: SPACE.ITEM,
    paddingBottom: SPACE.BLOCK,
  },
  fieldLabel: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#374151',
    marginTop: SPACE.ITEM,
  },
  tagRow: {
    flexDirection: 'row',
    gap: hs(8),
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: ms(10),
    paddingHorizontal: hs(12),
    paddingVertical: vs(8),
    backgroundColor: '#FFFFFF',
  },
  tagOptionActive: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  tagOptionText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#6B7280',
  },
  tagOptionTextActive: {
    color: '#166534',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: ms(10),
    paddingHorizontal: hs(12),
    paddingVertical: vs(10),
    fontSize: ms(13),
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  fieldInputMultiline: {
    minHeight: vs(72),
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
    marginTop: SPACE.ITEM,
  },
  defaultCopy: {
    flex: 1,
  },
  defaultTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#111827',
  },
  defaultSub: {
    fontSize: ms(11),
    fontWeight: '500',
    color: '#6B7280',
    marginTop: vs(2),
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingTop: SPACE.BLOCK,
  },
  modalDeleteBtn: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtn: {
    flex: 1,
    height: ms(48),
    borderRadius: ms(12),
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnDisabled: {
    backgroundColor: '#86EFAC',
  },
  modalSaveText: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
