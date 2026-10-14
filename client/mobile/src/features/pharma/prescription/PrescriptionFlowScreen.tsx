import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '@/navigation/types';
import type { StoreProfile } from '@data/types';
import type { FulfillmentMode } from '@data/types';
import { pharmaStores } from '@data/pharma/stores';
import { defaultAddresses } from '@data/cart/addresses';
import { useOrdersStore } from '@/state/ordersStore';
import { gateway } from '@/services/api/GatewayClient';
import PrescriptionCameraStep from './PrescriptionCameraStep';
import PrescriptionNoteStep from './PrescriptionNoteStep';
import PharmaVendorList from './PharmaVendorList';
import PharmaFulfilmentSheet from './PharmaFulfilmentSheet';
import PrescriptionOrderConfirmedView from './PrescriptionOrderConfirmedView';

type Props = NativeStackScreenProps<RootStackParamList, 'PrescriptionFlow'>;

export type PrescriptionFlowStep = 'CAPTURE' | 'NOTE' | 'VENDORS' | 'CONFIRMED';

interface Draft {
  photos: string[];
  note: string;
  vendor: StoreProfile | null;
  fulfillment: FulfillmentMode;
}

const MAX_PHOTOS = 10;

export function PrescriptionFlowScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const presetVendorId = route.params?.presetVendorId;
  const presetVendor = useMemo(
    () => presetVendorId ? pharmaStores.find((store) => store.id === presetVendorId) ?? null : null,
    [presetVendorId],
  );
  const [step, setStep] = useState<PrescriptionFlowStep>('CAPTURE');
  const [draft, setDraft] = useState<Draft>({
    photos: [],
    note: '',
    vendor: null,
    fulfillment: 'DELIVERY',
  });
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [confirmedFulfillment, setConfirmedFulfillment] = useState<FulfillmentMode>('DELIVERY');
  const [sheetVisible, setSheetVisible] = useState(false);

  const recordOrder = useOrdersStore((s) => s.recordOrder);

  const handleBack = useCallback(() => {
    if (step === 'CAPTURE') {
      navigation.goBack();
      return;
    }
    if (step === 'NOTE') {
      setStep('CAPTURE');
      return;
    }
    if (step === 'VENDORS') {
      setStep('NOTE');
      return;
    }
  }, [step, navigation]);

  const handleCaptureNext = useCallback((photos: string[]) => {
    setDraft((d) => ({ ...d, photos }));
    setStep('NOTE');
  }, []);

  const handleNoteNext = useCallback((note: string) => {
    if (presetVendor) {
      setDraft((d) => ({ ...d, note, vendor: presetVendor }));
      setSheetVisible(true);
      return;
    }
    setDraft((d) => ({ ...d, note }));
    setStep('VENDORS');
  }, [presetVendor]);

  const handleSelectVendor = useCallback((vendor: StoreProfile) => {
    setDraft((d) => ({ ...d, vendor }));
  }, []);

  const handleConfirm = useCallback(
    (fulfillment: FulfillmentMode) => {
      const vendor = draft.vendor;
      if (!vendor) return;
      const pages = draft.photos.length;
      const note = draft.note.trim() ? draft.note : undefined;
      const addressId =
        defaultAddresses.find((a) => a.isDefault === true)?.id ?? defaultAddresses[0]?.id;
      void (async () => {
        // 1. Upload each photo to the private bucket via a signed URL; keep the object KEYS
        //    (never URLs, never logged). Failures drop that photo but never block the Rx.
        const keys = (
          await Promise.all(draft.photos.map((uri) => gateway.uploadPrescriptionImage(uri)))
        ).filter((k): k is string => Boolean(k));
        // 2. Create the durable Rx — the SERVER owns the authoritative id (and the quote/reveal
        //    lifecycle). The local order is keyed by that id so MyOrders can poll it.
        const rx = await gateway.createPrescription({
          vendorId: vendor.id,
          fulfillment,
          pages,
          note,
          imagePaths: keys,
          ...(fulfillment === 'DELIVERY' && addressId ? { addressId } : {}),
        });
        recordOrder({
          orderId: rx.id,
          kind: 'prescription',
          fulfillment,
          vendorName: vendor.name,
          storeIds: [vendor.id],
          pickup: fulfillment === 'PICKUP' && vendor.address
            ? { name: vendor.name, address: vendor.address }
            : undefined,
          pages,
          note,
          total: 0,
        });
        setPlacedOrderId(rx.id);
        setConfirmedFulfillment(fulfillment);
        setStep('CONFIRMED');
      })();
    },
    [draft, recordOrder],
  );

  const handleDone = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {step === 'CAPTURE' && (
        <PrescriptionCameraStep
          onBack={handleBack}
          onNext={handleCaptureNext}
          maxPhotos={MAX_PHOTOS}
        />
      )}
      {step === 'NOTE' && (
        <PrescriptionNoteStep
          initialNote={draft.note}
          photos={draft.photos}
          onBack={handleBack}
          onNext={handleNoteNext}
        />
      )}
      {step === 'VENDORS' && (
        <PharmaVendorList
          selected={draft.vendor}
          photos={draft.photos}
          note={draft.note}
          onBack={handleBack}
          onSelect={handleSelectVendor}
          onConfirm={handleConfirm}
        />
      )}
      {step === 'CONFIRMED' && placedOrderId && (
        <PrescriptionOrderConfirmedView
          orderId={placedOrderId}
          vendor={draft.vendor}
          fulfillment={confirmedFulfillment}
          pages={draft.photos.length}
          note={draft.note}
          onTrack={() => navigation.navigate('MyOrders', { highlightOrderId: placedOrderId })}
          onDone={handleDone}
        />
      )}
      <PharmaFulfilmentSheet
        visible={sheetVisible}
        vendor={draft.vendor}
        onRequestClose={() => setSheetVisible(false)}
        onConfirm={(fulfillment) => {
          setSheetVisible(false);
          handleConfirm(fulfillment);
        }}
      />
    </View>
  );
}

export default PrescriptionFlowScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
