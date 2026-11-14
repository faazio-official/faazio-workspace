import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { X } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DELIVERY } from '@/theme/deliveryTokens';
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
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const handled = useRef(false);

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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
        <View style={styles.top}>
          <AppText style={styles.title}>Scan seller QR</AppText>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <X size={ms(20)} color="#ffffff" />
          </Pressable>
        </View>
        <View style={styles.bottom}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000' },
  top: {
    position: 'absolute',
    top: vs(48),
    left: hs(20),
    right: hs(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#ffffff', fontSize: ms(18), fontWeight: '900' },
  close: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(999),
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    borderRadius: ms(20),
  },
  bottom: { position: 'absolute', bottom: vs(48), left: hs(24), right: hs(24) },
  hint: { color: '#ffffff', fontSize: ms(13), textAlign: 'center', marginBottom: vs(16) },
  cancel: {
    alignSelf: 'center',
    paddingHorizontal: hs(24),
    paddingVertical: vs(12),
    borderRadius: ms(999),
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  cancelText: { color: '#ffffff', fontSize: ms(13), fontWeight: '800' },
});
