import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { neutral } from '@/theme/brandTokens';
import { semantic } from '@/theme/brandTokens';
import { semanticTint } from '@/theme/brandTokens';
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
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { SavedAddress, AddressTag } from '@data/types';
import { gateway, GatewayHttpError } from '@/services/api/GatewayClient';
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
    <View style={[styles.addressCard, isSelected ? styles.selectedCard : styles.unselectedCard]}>
      {/* Card Header — badges & actions */}
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <View style={styles.tagBadge}>
            <TagIcon size={ms(11)} color={semantic.success} strokeWidth={2.4} />
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
            <Pencil size={ms(11)} color={neutral.inkMuted} strokeWidth={2.2} />
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
            <Trash2 size={ms(11)} color={neutral.inkMuted} strokeWidth={2.2} />
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

          <TouchableOpacity
            onPress={handleSelect}
            style={styles.deliverHereRow}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Deliver to ${item.name}, ${item.tag} address`}
          >
            <MapPin size={ms(14)} color={semantic.success} strokeWidth={2.2} />
            <AppText style={styles.deliverHereText}>
              {isSelected ? 'Delivering here' : 'Deliver here'}
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Radio */}
        <TouchableOpacity
          onPress={handleSelect}
          style={styles.radioContainer}
          activeOpacity={0.8}
          accessibilityRole="radio"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={`Select ${item.tag} address`}
        >
          <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
            {isSelected && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      </View>
    </View>
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
  /** Server write failure, shown inline instead of a blocking alert. */
  error?: string | null;
}

/** Add / edit sheet for a saved address. Purely presentational — the screen owns the gateway write. */
function AddressEditor({ visible, initial, saving, onClose, onSave, onDelete, error }: AddressEditorProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SavedAddress>(() => initial ?? blankAddress());
  const [submitted, setSubmitted] = useState(false);

  // Re-seed the form each time the sheet opens (or the target row changes).
  useEffect(() => {
    if (visible) {
      setDraft(initial ?? blankAddress());
      setSubmitted(false);
    }
  }, [visible, initial]);

  const isNew = !initial || initial.id === '';
  const nameError = draft.name.trim().length === 0 ? 'Enter the recipient name.' : '';
  const addressError = draft.address.trim().length === 0 ? 'Enter the full address.' : '';
  const phoneError =
    draft.phone.trim().length > 0 && draft.phone.replace(/\D/g, '').length < 6
      ? 'Enter a valid phone number.'
      : '';
  const hasError = Boolean(nameError || addressError || phoneError);
  const canSave = !saving;

  const handleSavePress = () => {
    setSubmitted(true);
    if (hasError) return;
    onSave(draft);
  };

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
              <X size={ms(18)} color={neutral.inkMuted} strokeWidth={2.4} />
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
                    <TagIcon size={ms(13)} color={active ? semantic.success : neutral.inkMuted} strokeWidth={2.4} />
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
              placeholderTextColor={neutral.inkSubtle}
              accessibilityLabel="Recipient name"
            />
            {submitted && nameError ? <AppText style={styles.fieldError}>{nameError}</AppText> : null}

            <AppText style={styles.fieldLabel}>Phone</AppText>
            <AppTextInput
              style={styles.fieldInput}
              value={draft.phone}
              onChangeText={(phone) => setDraft((d) => ({ ...d, phone }))}
              placeholder="+91 98765 43210"
              placeholderTextColor={neutral.inkSubtle}
              keyboardType="phone-pad"
              accessibilityLabel="Contact phone"
            />
            {submitted && phoneError ? <AppText style={styles.fieldError}>{phoneError}</AppText> : null}

            <AppText style={styles.fieldLabel}>Address</AppText>
            <AppTextInput
              style={[styles.fieldInput, styles.fieldInputMultiline]}
              value={draft.address}
              onChangeText={(address) => setDraft((d) => ({ ...d, address }))}
              placeholder="House / street / area / city / PIN"
              placeholderTextColor={neutral.inkSubtle}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Full address"
            />
            {submitted && addressError ? <AppText style={styles.fieldError}>{addressError}</AppText> : null}

            <View style={styles.defaultRow}>
              <View style={styles.defaultCopy}>
                <AppText style={styles.defaultTitle}>Set as default</AppText>
                <AppText style={styles.defaultSub}>Use this address first at checkout.</AppText>
              </View>
              <Switch
                value={!!draft.isDefault}
                onValueChange={(isDefault) => setDraft((d) => ({ ...d, isDefault }))}
                trackColor={{ false: neutral.border, true: semanticTint.success }}
                thumbColor={draft.isDefault ? semantic.success : neutral.surfaceAlt}
              />
            </View>
          </ScrollView>

          {error ? (
            <AppText style={[styles.fieldError, styles.modalError]} accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}

          <View style={styles.modalActions}>
            {!isNew && (
              <TouchableOpacity
                onPress={() => onDelete(initial as SavedAddress)}
                style={styles.modalDeleteBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Delete address"
              >
                <Trash2 size={ms(15)} color={semantic.danger} strokeWidth={2.3} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleSavePress}
              disabled={!canSave}
              style={[styles.modalSaveBtn, !canSave && styles.modalSaveBtnDisabled]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
            >
              {saving ? (
                <ActivityIndicator color={neutral.card} size="small" />
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
  // Server-only: addresses are never seeded from a fixture. An offline read shows the honest
  // error/empty state instead of treating sample rows as the caller's real addresses.
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  const retryLoad = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(false);
    gateway
      .getAddresses()
      .then((rows) => {
        if (!alive) return;
        setAddresses(rows);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Explicit selection wins; otherwise default → first.
  const activeId = useMemo(
    () => selectedId || addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || '',
    [selectedId, addresses],
  );

  const openAdd = useCallback(() => {
    setEditing(null);
    setSaveError(null);
    setEditorVisible(true);
  }, []);
  const openEdit = useCallback((item: SavedAddress) => {
    setEditing(item);
    setSaveError(null);
    setEditorVisible(true);
  }, []);
  const closeEditor = useCallback(() => {
    if (!saving) setEditorVisible(false);
  }, [saving]);

  const deleteAddress = useCallback(async (item: SavedAddress) => {
    try {
      await gateway.deleteAddress(item.id);
    } catch (err) {
      // A 404 means the server already dropped it → the local removal is truthful. Any other
      // failure (offline, foreign id, server error) must NOT remove the row: the next read would
      // bring it back, so keep the list honest and tell the user instead.
      if (!(err instanceof GatewayHttpError && err.status === 404)) {
        Alert.alert(
          'Delete failed',
          'Could not delete this address. Check your connection and try again.',
        );
        return;
      }
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
    setSaveError(null);
    try {
      const saved = await gateway.saveAddress(draft);
      // The server is the id authority. An empty id means the server did not confirm the write, so
      // treat it as a failure rather than inventing a local `addr-local-…` id that a later edit
      // would send back and the server would reject.
      if (!saved.id) {
        setSaveError('Could not save this address. Check your connection and try again.');
        return;
      }
      const withId: SavedAddress = saved;
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
      setSaveError('Could not save this address. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
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
              <ChevronLeft size={ms(26)} color={neutral.ink} strokeWidth={2.2} />
            </TouchableOpacity>
            <View>
              <AppText style={styles.headerTitle}>Addresses</AppText>
              <AppText style={styles.headerSubtitle}>Manage your saved addresses</AppText>
            </View>
          </View>
          <TouchableOpacity onPress={openAdd} style={styles.addNewBtn} activeOpacity={0.7}>
            <Plus size={ms(14)} color={semantic.success} strokeWidth={2.6} />
            <AppText style={styles.addNewText}>Add New</AppText>
          </TouchableOpacity>
        </View>

        {/* Section title */}
        <AppText style={styles.sectionTitle}>Saved Addresses</AppText>

        {/* Address cards */}
        {loading && addresses.length === 0 ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={semantic.success} />
            <AppText style={styles.emptySub}>Loading your addresses…</AppText>
          </View>
        ) : loadError && addresses.length === 0 ? (
          <View style={styles.emptyCard}>
            <MapPin size={ms(24)} color={neutral.inkSubtle} strokeWidth={1.75} />
            <AppText style={styles.emptyTitle}>Couldn't load addresses</AppText>
            <AppText style={styles.emptySub}>Check your connection and try again.</AppText>
            <TouchableOpacity
              onPress={retryLoad}
              style={styles.retryBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Retry loading addresses"
            >
              <AppText style={styles.retryText}>Try again</AppText>
            </TouchableOpacity>
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.emptyCard}>
            <MapPin size={ms(24)} color={neutral.inkSubtle} strokeWidth={1.75} />
            <AppText style={styles.emptyTitle}>No saved addresses yet</AppText>
            <AppText style={styles.emptySub}>Tap “Add New” to save your first delivery address.</AppText>
          </View>
        ) : (
          addresses.map((item) => (
            <AddressCard
              key={item.id}
              item={item}
              isSelected={activeId === item.id}
              onSelect={setSelectedId}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))
        )}

        {/* Tip banner */}
        {showBanner && (
          <View style={styles.tipBanner}>
            <View style={styles.tipIconBox}>
              <MapPin size={ms(24)} color={semantic.success} strokeWidth={2.2} />
            </View>
            <View style={styles.tipTextContainer}>
              <AppText style={styles.tipTitle}>Add accurate addresses</AppText>
              <AppText style={styles.tipSubtitle}>
                This helps us deliver your orders faster and avoid any delivery issues.
              </AppText>
            </View>
            <TouchableOpacity onPress={handleCloseBanner} style={styles.closeBannerBtn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Dismiss">
              <X size={ms(16)} color={neutral.inkSubtle} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <AddressEditor
        visible={editorVisible}
        initial={editing}
        saving={saving}
        onClose={closeEditor}
        onSave={handleSave}
        onDelete={handleDelete}
        error={saveError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neutral.surface,
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
    fontWeight: '600',
    color: neutral.ink,
  },
  headerSubtitle: {
    fontSize: ms(12),
    fontWeight: '500',
    color: neutral.inkMuted,
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
    fontWeight: '600',
    color: semantic.success,
    marginLeft: hs(3),
  },

  /* Section */
  sectionTitle: {
    fontSize: ms(15),
    fontWeight: '600',
    color: neutral.ink,
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
    backgroundColor: semanticTint.success,
    borderColor: semanticTint.success,
  },
  unselectedCard: {
    backgroundColor: neutral.card,
    borderColor: neutral.border,
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
    backgroundColor: semanticTint.success,
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
    marginRight: hs(8),
    gap: hs(4),
  },
  tagText: {
    fontSize: ms(10),
    fontWeight: '600',
    color: semantic.success,
  },
  defaultBadge: {
    backgroundColor: neutral.surfaceAlt,
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  defaultText: {
    fontSize: ms(10),
    fontWeight: '600',
    color: neutral.inkMuted,
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
    color: neutral.inkMuted,
  },
  actionDivider: {
    width: 1,
    height: vs(12),
    backgroundColor: neutral.border,
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
    fontWeight: '600',
    color: neutral.ink,
    marginBottom: vs(2),
  },
  userPhone: {
    fontSize: ms(12),
    fontWeight: '500',
    color: neutral.inkMuted,
    marginBottom: vs(8),
  },
  addressText: {
    fontSize: ms(12),
    fontWeight: '500',
    color: neutral.inkMuted,
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
    fontWeight: '600',
    color: semantic.success,
  },

  radioContainer: {
    padding: hs(4),
  },
  radioOuter: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 2,
    borderColor: neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: semantic.success,
  },
  radioInner: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: semantic.success,
  },

  /* Tip Banner */
  tipBanner: {
    backgroundColor: semanticTint.success,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: semanticTint.success,
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
    fontWeight: '600',
    color: neutral.ink,
    marginBottom: vs(2),
  },
  tipSubtitle: {
    fontSize: ms(11),
    fontWeight: '500',
    color: neutral.inkMuted,
    lineHeight: vs(15),
  },
  closeBannerBtn: {
    padding: hs(4),
  },

  /* Empty state */
  emptyCard: {
    backgroundColor: neutral.card,
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: neutral.border,
    alignItems: 'center',
    paddingHorizontal: hs(24),
    paddingVertical: vs(32),
    gap: SPACE.BLOCK,
  },
  emptyTitle: {
    fontSize: ms(13),
    fontWeight: '600',
    color: neutral.ink,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: ms(12),
    fontWeight: '500',
    color: neutral.inkMuted,
    textAlign: 'center',
    lineHeight: vs(17),
  },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: hs(20),
    borderRadius: ms(22),
    borderWidth: 1,
    borderColor: neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: semantic.success,
  },

  /* Address editor sheet */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: neutral.card,
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
    fontWeight: '600',
    color: neutral.ink,
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
    fontWeight: '600',
    color: neutral.inkMuted,
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
    borderColor: neutral.border,
    borderRadius: ms(10),
    paddingHorizontal: hs(12),
    paddingVertical: vs(8),
    backgroundColor: neutral.card,
  },
  tagOptionActive: {
    borderColor: semanticTint.success,
    backgroundColor: semanticTint.success,
  },
  tagOptionText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: neutral.inkMuted,
  },
  tagOptionTextActive: {
    color: semantic.success,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: neutral.border,
    borderRadius: ms(10),
    paddingHorizontal: hs(12),
    paddingVertical: vs(10),
    fontSize: ms(13),
    color: neutral.ink,
    backgroundColor: neutral.card,
  },
  fieldError: {
    fontSize: ms(12),
    color: semantic.danger,
    marginTop: vs(4),
  },
  modalError: {
    marginHorizontal: hs(20),
    marginBottom: vs(8),
    fontSize: ms(13),
    lineHeight: ms(18),
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
    fontWeight: '600',
    color: neutral.ink,
  },
  defaultSub: {
    fontSize: ms(11),
    fontWeight: '500',
    color: neutral.inkMuted,
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
    borderColor: semanticTint.danger,
    backgroundColor: semanticTint.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtn: {
    flex: 1,
    height: ms(48),
    borderRadius: ms(12),
    backgroundColor: semantic.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnDisabled: {
    backgroundColor: semanticTint.success,
  },
  modalSaveText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: neutral.card,
  },
});
