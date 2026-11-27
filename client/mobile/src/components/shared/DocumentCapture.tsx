import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import { Camera as CameraIcon, ChevronLeft, RefreshCw, X } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { parentRamp, neutral, semanticTint } from '@/theme/brandTokens';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onCaptured: (uri: string) => void;
}

/**
 * Full-screen document camera. KYC images are captured on-device, uploaded straight to the private
 * R2 bucket via a presigned PUT, and never logged. Mirrors the prescription camera consent flow.
 *
 * A capture is reviewed before it is used: Retake throws the shot away and starts a fresh camera
 * session, so a bad frame never reaches the upload or the form.
 */
export default function DocumentCapture({ visible, title, onClose, onCaptured }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  // Cap the capture at 1280px on the long edge — the exact size the gateway downscales to before its
  // AVIF encode — so the JPEG written at shutter time is already the file that gets stored. A
  // full-sensor 12–50MP capture only burns upload time (ReadTimeout is 15s) and encode CPU.
  const format = useCameraFormat(device, [
    { photoResolution: { width: 1280, height: 1280 } },
  ]);
  const cameraRef = useRef<Camera>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  // Remount key: bumping it tears the camera session down and starts a new one for the retake.
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => {
    if (!visible) {
      setShot(null);
      setCapturing(false);
    }
  }, [visible]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      if (photo?.path) setShot(`file://${photo.path}`);
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  const retake = useCallback(() => {
    setShot(null);
    setSessionKey((key) => key + 1);
  }, []);

  const useShot = useCallback(() => {
    if (!shot) return;
    const uri = shot;
    setShot(null);
    onCaptured(uri);
  }, [onCaptured, shot]);

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
            <ChevronLeft size={ms(24)} color={neutral.card} strokeWidth={2.2} />
          </TouchableOpacity>
          <AppText style={styles.title}>{title}</AppText>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <X size={ms(22)} color={neutral.card} strokeWidth={2.2} />
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
              <Camera
                key={sessionKey}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                format={format}
                isActive={!shot}
                photo
                photoHdr={false}
                photoQualityBalance="speed"
              />
            ) : null}
            {shot ? (
              <View style={styles.reviewWrap}>
                <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={styles.reviewBar}>
                  <TouchableOpacity
                    style={[styles.reviewButton, styles.retakeButton]}
                    onPress={retake}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Retake photo"
                  >
                    <RefreshCw size={ms(15)} color={neutral.card} strokeWidth={2.4} />
                    <AppText style={styles.retakeText}>Retake</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reviewButton, styles.useButton]}
                    onPress={useShot}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Use this photo"
                  >
                    <AppText style={styles.useText}>Use photo</AppText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.captureBar}>
                  <TouchableOpacity
                    style={[styles.shutter, capturing && styles.shutterBusy]}
                    onPress={takePhoto}
                    disabled={capturing}
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
              </>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
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
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: ms(14), fontWeight: '800', color: neutral.card },
  consentWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(24),
  },
  consentCard: {
    backgroundColor: neutral.card,
    borderRadius: ms(20),
    padding: hs(20),
    alignItems: 'center',
  },
  consentIcon: {
    width: ms(54),
    height: ms(54),
    borderRadius: ms(27),
    backgroundColor: semanticTint.info,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  consentTitle: { fontSize: ms(16), fontWeight: '900', color: neutral.ink },
  consentText: {
    fontSize: ms(12),
    color: neutral.inkMuted,
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
  allowText: { fontSize: ms(13), fontWeight: '800', color: neutral.card, textTransform: 'uppercase' },
  cancelButton: { paddingVertical: vs(12) },
  cancelText: { fontSize: ms(12), fontWeight: '700', color: neutral.inkMuted },
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
    borderColor: neutral.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: ms(56), height: ms(56), borderRadius: ms(28), backgroundColor: neutral.card },
  shutterBusy: { opacity: 0.5 },
  reviewWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'black' },
  reviewBar: {
    position: 'absolute',
    left: hs(16),
    right: hs(16),
    bottom: vs(40),
    flexDirection: 'row',
    gap: hs(12),
  },
  reviewButton: {
    flex: 1,
    minHeight: Math.max(48, vs(48)),
    borderRadius: ms(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
  },
  retakeButton: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  retakeText: { fontSize: ms(13), fontWeight: '800', color: neutral.card },
  useButton: { backgroundColor: parentRamp.base },
  useText: { fontSize: ms(13), fontWeight: '800', color: parentRamp.onBase },
  hint: {
    position: 'absolute',
    left: hs(24),
    right: hs(24),
    bottom: vs(24),
    textAlign: 'center',
    fontSize: ms(11),
    color: neutral.border,
  },
});
