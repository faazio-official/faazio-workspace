import React from 'react';
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Camera, LocateFixed, Plus, Store, X } from 'lucide-react-native';
import AppText from '@/components/AppText';
import Checkbox from '@/components/shared/Checkbox';
import SelectDropdown, { type SelectOption } from '@/components/shared/SelectDropdown';
import { hs, ms, vs } from '@/utils/responsive';
import { neutral, parentRamp } from '@/theme/brandTokens';
import type { AppBrand } from '@data/types';
import type { Category } from '@/services/api/GatewayClient';
import { DocumentRow, TextInputField } from './FormControls';

/** One shop (vendor) the account applies to carry. */
export interface VendorDraft {
  key: string;
  app: AppBrand;
  shopName: string;
  shopAddress: string;
  platformFee: string;
  categoryId: string | null;
  categories: Category[];
  categoriesLoading: boolean;
  fssaiNumber: string;
  fssaiUri: string | null;
  drugLicenseNumber: string;
  drugLicenseUri: string | null;
  /**
   * Public shop-front photos (captured URIs). At least one is required: the gateway rejects a shop
   * with no picture, because an unreviewable shop cannot be activated and customers need a preview.
   */
  shopPhotoUris: string[];
  sameAsAccountBank: boolean;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBeneficiary: string;
  latitude?: number;
  longitude?: number;
  pinnedAddress: string;
}

export function newVendorDraft(app: AppBrand = 'MART'): VendorDraft {
  return {
    key: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    app,
    shopName: '',
    shopAddress: '',
    platformFee: '10',
    categoryId: null,
    categories: [],
    categoriesLoading: false,
    fssaiNumber: '',
    fssaiUri: null,
    drugLicenseNumber: '',
    drugLicenseUri: null,
    shopPhotoUris: [],
    sameAsAccountBank: true,
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBeneficiary: '',
    pinnedAddress: '',
  };
}

const APP_OPTIONS: SelectOption<AppBrand>[] = [
  { value: 'MART', label: 'Mart' },
  { value: 'FOOD', label: 'Food' },
  { value: 'PHARMA', label: 'Pharma' },
];

interface Props {
  vendor: VendorDraft;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  onChange: (patch: Partial<VendorDraft>) => void;
  onAppChange: (app: AppBrand) => void;
  onPinLocation: () => void;
  onCaptureDoc: (kind: 'fssai' | 'drug') => void;
  onAddShopPhoto: () => void;
  onRemoveShopPhoto: (uri: string) => void;
  onAddAnother: () => void;
}

/** Repeatable shop card: identity, app/category, fee, licence and optional bank override. */
export default function ShopCard({
  vendor,
  index,
  canRemove,
  onRemove,
  onChange,
  onAppChange,
  onPinLocation,
  onCaptureDoc,
  onAddShopPhoto,
  onRemoveShopPhoto,
  onAddAnother,
}: Props) {
  const categoryOptions: SelectOption<string>[] = vendor.categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const pinned = vendor.latitude != null && vendor.longitude != null;
  const locationLabel = pinned
    ? vendor.pinnedAddress ||
      `${vendor.latitude!.toFixed(5)}, ${vendor.longitude!.toFixed(5)}`
    : 'Pin this shop so customers can find it';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Store size={ms(14)} color={parentRamp.onBase} strokeWidth={2.2} />
        </View>
        <AppText style={styles.title}>Shop {index + 1}</AppText>
        {canRemove ? (
          <TouchableOpacity
            onPress={onRemove}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel={`Remove shop ${index + 1}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={ms(16)} color={neutral.inkSubtle} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}
      </View>

      <SelectDropdown
        label="App"
        required
        options={APP_OPTIONS}
        value={vendor.app}
        onChange={onAppChange}
      />

      <TextInputField
        label="Shop name"
        placeholder={vendor.app === 'FOOD' ? 'e.g. Paradise Biryani House' : 'e.g. Darling Mobiles'}
        value={vendor.shopName}
        onChangeText={(value) => onChange({ shopName: value })}
      />
      <TextInputField
        label="Shop address"
        placeholder="Street, area, city"
        value={vendor.shopAddress}
        onChangeText={(value) => onChange({ shopAddress: value })}
      />

      {vendor.categoriesLoading ? (
        <ActivityIndicator color={parentRamp.base} style={styles.categoryLoader} />
      ) : (
        <SelectDropdown
          label={vendor.app === 'FOOD' ? 'Restaurant type' : 'Category'}
          required
          options={categoryOptions}
          value={vendor.categoryId}
          onChange={(categoryId) => onChange({ categoryId })}
          placeholder={
            vendor.categories.length === 0
              ? `Categories unavailable for ${vendor.app}`
              : 'Select a category'
          }
          disabled={vendor.categories.length === 0}
        />
      )}

      <TextInputField
        label="Platform fee %"
        placeholder={vendor.app === 'FOOD' ? '5 – 100' : '1 – 100'}
        value={vendor.platformFee}
        onChangeText={(value) => onChange({ platformFee: value })}
        keyboardType="number-pad"
        maxLength={3}
      />
      <AppText style={styles.helper}>
        The platform retains this share of each order; the rest is settled to your bank after the
        7-day buyer-protection hold.
      </AppText>

      <View style={styles.photoBlock}>
        <AppText style={styles.photoLabel}>
          Photos of your shop <AppText style={styles.photoRequired}>(at least one)</AppText>
        </AppText>
        <AppText style={styles.helper}>
          A photo of the shop front is what customers see once you go live. It is converted to AVIF
          before it is stored.
        </AppText>
        <View style={styles.photoGrid}>
          {vendor.shopPhotoUris.map((uri, photoIndex) => (
            <View key={uri} style={styles.photoTile}>
              <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => onRemoveShopPhoto(uri)}
                accessibilityRole="button"
                accessibilityLabel={`Remove shop photo ${photoIndex + 1}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={ms(12)} color={neutral.surface} strokeWidth={2.6} />
              </TouchableOpacity>
            </View>
          ))}
          {vendor.shopPhotoUris.length < 5 ? (
            <TouchableOpacity
              style={styles.photoAdd}
              onPress={onAddShopPhoto}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Add a photo of your shop"
            >
              <Camera size={ms(18)} color={parentRamp.base} strokeWidth={2.2} />
              <AppText style={styles.photoAddText}>
                {vendor.shopPhotoUris.length ? 'Add' : 'Add photo'}
              </AppText>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {vendor.app === 'FOOD' ? (
        <>
          <TextInputField
            label="FSSAI licence number (optional)"
            placeholder="14-digit licence number"
            value={vendor.fssaiNumber}
            onChangeText={(value) => onChange({ fssaiNumber: value })}
            keyboardType="number-pad"
          />
          <DocumentRow
            label="FSSAI certificate (optional)"
            optional
            uri={vendor.fssaiUri}
            onCapture={() => onCaptureDoc('fssai')}
            onRemove={() => onChange({ fssaiUri: null })}
          />
        </>
      ) : null}

      {vendor.app === 'PHARMA' ? (
        <>
          <TextInputField
            label="Drug licence number (optional)"
            placeholder="Licence number"
            value={vendor.drugLicenseNumber}
            onChangeText={(value) => onChange({ drugLicenseNumber: value })}
          />
          <DocumentRow
            label="Drug licence certificate (optional)"
            optional
            uri={vendor.drugLicenseUri}
            onCapture={() => onCaptureDoc('drug')}
            onRemove={() => onChange({ drugLicenseUri: null })}
          />
        </>
      ) : null}

      <TouchableOpacity style={styles.pinButton} onPress={onPinLocation} activeOpacity={0.8}>
        <LocateFixed size={ms(16)} color={parentRamp.base} strokeWidth={2.2} />
        <View style={{ flex: 1 }}>
          <AppText style={styles.pinTitle}>{pinned ? 'Shop location pinned' : 'View location on map'}</AppText>
          <AppText style={styles.pinValue} numberOfLines={1}>
            {locationLabel}
          </AppText>
        </View>
      </TouchableOpacity>

      <View style={styles.bankToggle}>
        <Checkbox
          checked={vendor.sameAsAccountBank}
          onToggle={() => onChange({ sameAsAccountBank: !vendor.sameAsAccountBank })}
          size={20}
        />
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => onChange({ sameAsAccountBank: !vendor.sameAsAccountBank })}
          activeOpacity={0.8}
        >
          <AppText style={styles.bankToggleText}>Same as account bank details</AppText>
        </TouchableOpacity>
      </View>

      {!vendor.sameAsAccountBank ? (
        <View style={styles.bankFields}>
          <TextInputField
            label="Bank name"
            placeholder="e.g. HDFC Bank"
            value={vendor.bankName}
            onChangeText={(value) => onChange({ bankName: value })}
          />
          <TextInputField
            label="Account number"
            placeholder="Enter account number"
            value={vendor.bankAccountNumber}
            onChangeText={(value) => onChange({ bankAccountNumber: value })}
            keyboardType="number-pad"
          />
          <TextInputField
            label="IFSC"
            placeholder="HDFC0001234"
            value={vendor.bankIfsc}
            onChangeText={(value) => onChange({ bankIfsc: value })}
            autoCapitalize="characters"
            maxLength={11}
          />
          <TextInputField
            label="Beneficiary name"
            placeholder="As printed on the passbook"
            value={vendor.bankBeneficiary}
            onChangeText={(value) => onChange({ bankBeneficiary: value })}
          />
        </View>
      ) : null}

      <TouchableOpacity style={styles.addButton} onPress={onAddAnother} activeOpacity={0.8}>
        <Plus size={ms(15)} color={parentRamp.base} strokeWidth={2.2} />
        <AppText style={styles.addText}>Add another shop</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: neutral.surface,
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: neutral.border,
    padding: hs(14),
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(4) },
  badge: {
    width: ms(26),
    height: ms(26),
    borderRadius: ms(8),
    backgroundColor: parentRamp.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(8),
  },
  title: { flex: 1, fontSize: ms(13), fontWeight: '900', color: neutral.ink },
  remove: { width: ms(28), height: ms(28), alignItems: 'center', justifyContent: 'center', borderRadius: ms(8) },
  categoryLoader: { alignSelf: 'flex-start', marginVertical: vs(10) },
  helper: { fontSize: ms(10.5), color: neutral.inkSubtle, lineHeight: ms(15), marginTop: vs(8) },
  photoBlock: { marginTop: vs(12) },
  photoLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    color: neutral.inkSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  photoRequired: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: hs(8), marginTop: vs(8) },
  photoTile: { width: ms(72), height: ms(72), borderRadius: ms(10), overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: ms(3),
    right: ms(3),
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoAdd: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(4),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: neutral.border,
  },
  photoAddText: { fontSize: ms(10), color: parentRamp.base, fontWeight: '600' },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(12),
    paddingVertical: vs(10),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: neutral.border,
    backgroundColor: parentRamp.tint,
    marginTop: vs(12),
  },
  pinTitle: { fontSize: ms(11), fontWeight: '800', color: neutral.ink },
  pinValue: { fontSize: ms(10), color: neutral.inkMuted, marginTop: vs(1) },
  bankToggle: { flexDirection: 'row', alignItems: 'center', gap: hs(10), marginTop: vs(14) },
  bankToggleText: { fontSize: ms(12), fontWeight: '700', color: neutral.inkMuted },
  bankFields: { marginTop: vs(2) },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    height: Math.max(42, vs(42)),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: neutral.border,
    borderStyle: 'dashed',
    backgroundColor: neutral.card,
    marginTop: vs(14),
  },
  addText: { fontSize: ms(11.5), fontWeight: '800', color: parentRamp.base },
});
