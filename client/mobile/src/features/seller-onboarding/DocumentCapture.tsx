import React, { useCallback, useRef } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Camera as CameraIcon, ChevronLeft, X } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { parentRamp } from '@/theme/brandTokens';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onCaptured: (uri: string) => void;
}

/**
 * Full-screen document camera. KYC images are captured on-device, uploaded straight to the private
 * R2 bucket via a presigned PUT, and never logged. Mirrors the prescription camera consent flow.
 */
export default function DocumentCapture({ visible, title, onClose, onCaptured }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePhoto({ flash: 'off' });
    if (photo?.path) {
      onCaptured(`file://${photo.path}`);
    }
  }, [onCaptured]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
          >
            <ChevronLeft size={ms(24)} color="#ffffff" strokeWidth={2.2} />
          </TouchableOpacity>
          <AppText style={styles.title}>{title}</AppText>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <X size={ms(22)} color="#ffffff" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {!hasPermission ? (
          <View style={styles.consentWrap}>
            <View style={styles.consentCard}>
              <View style={styles.consentIcon}>
                <CameraIcon size={ms(28)} color={parentRamp.base} strokeWidth={2} />
              </View>
              <AppText style={styles.consentTitle}>Camera access</AppText>
              <AppText style={styles.consentText}>
                Faazio needs the camera to capture your KYC document. The image is uploaded to a
                private bucket and is only visible to you and the review team.
              </AppText>
              <TouchableOpacity style={styles.allowButton} onPress={requestPermission} activeOpacity={0.9}>
                <AppText style={styles.allowText}>Allow camera</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.8}>
                <AppText style={styles.cancelText}>Go back</AppText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            {device ? (
              <Camera ref={cameraRef} style={StyleSheet.absoluteFill} device={device} isActive photo />
            ) : null}
            <View style={styles.captureBar}>
              <TouchableOpacity
                style={styles.shutter}
                onPress={takePhoto}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Capture document"
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
            <AppText style={styles.hint}>
              Lay the document flat, fill the frame and avoid glare.
            </AppText>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(12),
    paddingTop: vs(48),
    paddingBottom: vs(12),
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 2,
  },
  iconButton: { width: ms(40), height: ms(40), alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: ms(14), fontWeight: '800', color: '#ffffff' },
  consentWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(24),
  },
  consentCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(20),
    padding: hs(20),
    alignItems: 'center',
  },
  consentIcon: {
    width: ms(54),
    height: ms(54),
    borderRadius: ms(27),
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  consentTitle: { fontSize: ms(16), fontWeight: '900', color: '#0f172a' },
  consentText: {
    fontSize: ms(12),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: ms(18),
    marginTop: vs(6),
    marginBottom: SPACE.SECTION,
  },
  allowButton: {
    alignSelf: 'stretch',
    height: Math.max(48, vs(48)),
    borderRadius: ms(12),
    backgroundColor: parentRamp.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allowText: { fontSize: ms(13), fontWeight: '800', color: '#ffffff', textTransform: 'uppercase' },
  cancelButton: { paddingVertical: vs(12) },
  cancelText: { fontSize: ms(12), fontWeight: '700', color: '#64748B' },
  cameraWrap: { flex: 1 },
  captureBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: vs(56),
    alignItems: 'center',
  },
  shutter: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: ms(56), height: ms(56), borderRadius: ms(28), backgroundColor: '#ffffff' },
  hint: {
    position: 'absolute',
    left: hs(24),
    right: hs(24),
    bottom: vs(24),
    textAlign: 'center',
    fontSize: ms(11),
    color: '#E2E8F0',
  },
});
