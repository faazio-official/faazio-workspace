import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { neutral } from '@/theme/brandTokens';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import type { StoreProfile } from '@data/types';
import type { FulfillmentMode } from '@data/types';
import { useOrdersStore } from '@/state/ordersStore';
import { gateway, GatewayHttpError } from '@/services/api/GatewayClient';
import { usePharmaStores } from '../hooks/usePharmaStores';
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
  const { stores } = usePharmaStores();
  const presetVendor = useMemo(
    () => presetVendorId ? stores.find((store) => store.id === presetVendorId) ?? null : null,
    [presetVendorId, stores],
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
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      if (!vendor || submitting) return;
      const pages = draft.photos.length;
      const note = draft.note.trim() ? draft.note : undefined;
      setSubmitting(true);
      setSubmitError(null);
      setUploadProgress(draft.photos.length > 0 ? { done: 0, total: draft.photos.length } : null);
      void (async () => {
        try {
          // Resolve the delivery address from the SERVER-owned list (auth-scoped) so the
          // prescription's address_id FK never points at a phantom @data fixture id. Falls back
          // to the fixture list only when the gateway is offline (mock mode).
          const addresses = await gateway.getAddresses();
          const addressId =
            addresses.find((a) => a.isDefault === true)?.id ?? addresses[0]?.id;
          // 1. Upload each photo sequentially to the private bucket via a signed URL; keep the
          //    object KEYS (never URLs, never logged). Progress is shown while this runs.
          const keys: string[] = [];
          for (let index = 0; index < draft.photos.length; index += 1) {
            const key = await gateway.uploadPrescriptionImage(draft.photos[index]);
            if (key) keys.push(key);
            setUploadProgress({ done: index + 1, total: draft.photos.length });
          }
          // A durable Rx must carry its scans: on a real server session any failed page is a hard
          // stop so the shopper can retry, not a silent partial upload. (Mock mode allows empty.)
          if (gateway.remoteEnabled && keys.length !== draft.photos.length) {
            const failed = draft.photos.length - keys.length;
            setSubmitError(
              `Couldn't upload ${failed} of ${draft.photos.length} page${draft.photos.length === 1 ? '' : 's'}. Check your connection and try again.`,
            );
            return;
          }
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
        } catch (err) {
          // A rejected/unknown pharmacy is a fixable choice, not a transient failure.
          if (err instanceof GatewayHttpError && (err.status === 404 || err.status === 422)) {
            setSubmitError('This pharmacy can no longer receive prescriptions. Please pick another.');
            return;
          }
          // Strict/remote failure (or a bad payload): keep the user on the current step and explain.
          setSubmitError("We couldn't submit your prescription. Please try again.");
        } finally {
          setUploadProgress(null);
          setSubmitting(false);
        }
      })();
    },
    [draft, recordOrder, submitting],
  );

  const handleDone = useCallback(() => navigation.goBack(), [navigation]);

  const stepNumber = step === 'NOTE' ? 2 : step === 'VENDORS' ? 3 : 1;
  const showStepper = step === 'NOTE' || step === 'VENDORS';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {showStepper ? (
        <View
          style={styles.stepper}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Prescription progress"
          accessibilityValue={{
            min: 1,
            max: 3,
            now: stepNumber,
            text: `Step ${stepNumber} of 3`,
          }}
        >
          <AppText style={styles.stepperText}>Step {stepNumber} of 3</AppText>
        </View>
      ) : null}

      {submitError ? (
        <View style={styles.errorBanner} accessibilityLiveRegion="polite">
          <AppText style={styles.errorText}>{submitError}</AppText>
          <TouchableOpacity
            onPress={() => setSubmitError(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
            style={styles.errorDismiss}
          >
            <AppText style={styles.errorDismissText}>Dismiss</AppText>
          </TouchableOpacity>
        </View>
      ) : null}

      {submitting ? (
        <View
          style={styles.submitOverlay}
          accessibilityViewIsModal
          accessible
          accessibilityLabel={
            uploadProgress
              ? `Uploading page ${uploadProgress.done} of ${uploadProgress.total}`
              : 'Submitting prescription'
          }
        >
          <View style={styles.submitCard}>
            <ActivityIndicator color={neutral.ink} />
            <AppText style={styles.submitText}>
              {uploadProgress
                ? `Uploading page ${uploadProgress.done} of ${uploadProgress.total}`
                : 'Submitting prescription'}
            </AppText>
          </View>
        </View>
      ) : null}

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
    backgroundColor: neutral.card,
  },
  stepper: {
    paddingHorizontal: hs(16),
    paddingVertical: vs(8),
    backgroundColor: neutral.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: neutral.border,
  },
  stepperText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: neutral.inkMuted,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    marginHorizontal: hs(16),
    marginTop: vs(8),
    paddingVertical: vs(10),
    paddingHorizontal: hs(12),
    borderRadius: ms(10),
    backgroundColor: '#FEF3C7',
  },
  errorText: {
    flex: 1,
    fontSize: ms(12),
    lineHeight: vs(17),
    color: '#854D0E',
  },
  errorDismiss: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: hs(8),
  },
  errorDismissText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#854D0E',
  },
  submitOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  submitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(20),
    paddingVertical: vs(16),
    borderRadius: ms(14),
    backgroundColor: neutral.card,
    marginHorizontal: SPACE.SECTION,
  },
  submitText: {
    fontSize: ms(13),
    fontWeight: '500',
    color: neutral.ink,
  },
});
