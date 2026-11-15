import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { X } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanned: (token: string) => void;
}

/**
 * Full-screen seller pickup-QR scanner. The scanned value is the HMAC-signed handover token minted
 * for this stop; the gateway verifies it before the PICKUP stop can complete.
 */
export function PickupScanModal({ visible, onClose, onScanned }: Props) {
  // Modals render in their own native window; a nested provider reports that window's
  // real insets instead of the app root's.
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <ScannerBody visible={visible} onClose={onClose} onScanned={onScanned} />
      </SafeAreaProvider>
    </Modal>
  );
}

function ScannerBody({ visible, onClose, onScanned }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const handled = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    handled.current = false;
    if (!hasPermission) void requestPermission();
  }, [visible, hasPermission, requestPermission]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (handled.current) return;
      const value = codes.find((c) => !!c.value)?.value;
      if (!value) return;
      handled.current = true;
      onScanned(value);
    },
  });

  return (
    <View style={styles.overlay}>
      {device && hasPermission ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          codeScanner={codeScanner}
        />
      ) : null}
      <View style={styles.frame} pointerEvents="none" />
      <View style={[styles.top, { top: insets.top + vs(16) }]}>
        <AppText style={styles.title}>Scan seller QR</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Close scanner" onPress={onClose} style={styles.close}>
          <X size={ms(20)} color={DELIVERY.onBrand} />
        </Pressable>
      </View>
      <View style={[styles.bottom, { bottom: insets.bottom + vs(24) }]}>
        <AppText style={styles.hint}>
          {!hasPermission
            ? 'Allow camera access to scan the pickup QR.'
            : 'Point the camera at the QR shown by the seller.'}
        </AppText>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancel}>
          <AppText style={styles.cancelText}>Cancel</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: DELIVERY.brandDark },
  top: {
    position: 'absolute',
    left: hs(20),
    right: hs(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { ...DP_TYPE.title, color: DELIVERY.onBrand },
  close: {
    width: ms(36),
    height: ms(36),
    borderRadius: DELIVERY.radius.pill,
    backgroundColor: DELIVERY.brandDeep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DELIVERY.onBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    position: 'absolute',
    width: '68%',
    aspectRatio: 1,
    alignSelf: 'center',
    top: '26%',
    borderWidth: 2,
    borderColor: DELIVERY.brand,
    borderRadius: DELIVERY.radius.lg,
  },
  bottom: { position: 'absolute', left: hs(24), right: hs(24) },
  hint: { ...DP_TYPE.body, color: DELIVERY.onBrand, textAlign: 'center', marginBottom: vs(16) },
  cancel: {
    alignSelf: 'center',
    paddingHorizontal: hs(24),
    paddingVertical: vs(12),
    borderRadius: DELIVERY.radius.pill,
    backgroundColor: DELIVERY.brandDeep,
  },
  cancelText: { ...DP_TYPE.label, color: DELIVERY.onBrand },
});