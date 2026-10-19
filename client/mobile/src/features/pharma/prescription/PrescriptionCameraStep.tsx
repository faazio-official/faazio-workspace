import React, { memo, useCallback, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { ChevronLeft, Zap, ZapOff, Camera as CameraIcon, Trash2 } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { PHARMA_TEAL, PHARMA_INK } from '../mocks/pharmaHomeFeed';

interface PrescriptionCameraStepProps {
  onBack: () => void;
  onNext: (photos: string[]) => void;
  maxPhotos: number;
}

const PrescriptionCameraStep = memo(function PrescriptionCameraStep({
  onBack,
  onNext,
  maxPhotos,
}: PrescriptionCameraStepProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [photos, setPhotos] = useState<string[]>([]);
  const cameraRef = useRef<Camera>(null);

  const handleConsentGrant = useCallback(async () => {
    if (hasPermission) return;
    await requestPermission();
  }, [hasPermission, requestPermission]);

  const takePhoto = useCallback(async () => {
    if (photos.length >= maxPhotos || !cameraRef.current) return;
    const photo = await cameraRef.current.takePhoto({
      flash,
      enableAutoRedEyeReduction: true,
    });
    if (photo?.path) {
      setPhotos((prev) => [...prev, `file://${photo.path}`]);
    }
  }, [photos.length, maxPhotos, flash]);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <View style={styles.root}>
      {!hasPermission ? (
        <View style={styles.consentWrap}>
          <View style={styles.consentCard}>
            <View style={styles.consentIcon}>
              <CameraIcon size={ms(28)} color={PHARMA_TEAL} strokeWidth={2} />
            </View>
            <AppText style={styles.consentTitle}>Camera Access</AppText>
            <AppText style={styles.consentText}>
              Faazio needs camera access to capture your prescription pages. Photos stay on your
              device and are only shared with the pharmacy when you place the order.
            </AppText>
            <TouchableOpacity
              style={styles.consentAllowBtn}
              onPress={handleConsentGrant}
              activeOpacity={0.9}
            >
              <AppText style={styles.consentAllowText}>Allow Camera</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.consentBackBtn}
              onPress={onBack}
              activeOpacity={0.8}
            >
              <AppText style={styles.consentBackText}>Go Back</AppText>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          {device ? (
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive
              photo
            />
          ) : (
            <View style={styles.noCamera}>
              <AppText style={styles.noCameraText}>No back camera available</AppText>
            </View>
          )}

          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.roundBtn}
              onPress={onBack}
              activeOpacity={0.8}
              accessibilityLabel="Back"
            >
              <ChevronLeft size={ms(20)} color="#FFFFFF" strokeWidth={2.6} />
            </TouchableOpacity>
            <AppText style={styles.topTitle}>Upload Prescription</AppText>
            <TouchableOpacity
              style={styles.roundBtn}
              onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
              activeOpacity={0.8}
              accessibilityLabel="Toggle flash"
            >
              {flash === 'off' ? (
                <ZapOff size={ms(18)} color="#FFFFFF" strokeWidth={2.2} />
              ) : (
                <Zap size={ms(18)} color="#FFD54F" strokeWidth={2.2} />
              )}
            </TouchableOpacity>
          </View>

          {/* Counter */}
          <View style={styles.counterBadge}>
            <AppText style={styles.counterText}>
              {photos.length}/{maxPhotos} pages
            </AppText>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomArea}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbStrip}
            >
              {photos.map((uri, idx) => (
                <View key={`${uri}-${idx}`} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumb} />
                  <TouchableOpacity
                    style={styles.thumbDelete}
                    onPress={() => removePhoto(idx)}
                    activeOpacity={0.8}
                    accessibilityLabel={`Delete photo ${idx + 1}`}
                  >
                    <Trash2 size={ms(12)} color="#FFFFFF" strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.controlRow}>
              <TouchableOpacity
                style={styles.shutterBtn}
                onPress={takePhoto}
                activeOpacity={0.85}
                disabled={photos.length >= maxPhotos}
                accessibilityLabel="Take photo"
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, photos.length === 0 && styles.confirmBtnDisabled]}
              onPress={() => onNext(photos)}
              disabled={photos.length === 0}
              activeOpacity={0.9}
            >
              <AppText style={styles.confirmText}>
                {photos.length > 0 ? `Confirm (${photos.length})` : 'Add a page to continue'}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
});

export default PrescriptionCameraStep;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  consentWrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(24),
  },
  consentCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: ms(24),
    borderWidth: 1,
    borderColor: '#EEEEEE',
    padding: hs(24),
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  consentIcon: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    backgroundColor: '#E0F2F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  consentTitle: {
    fontSize: ms(18),
    fontWeight: '900',
    color: PHARMA_INK,
    marginBottom: vs(8),
  },
  consentText: {
    fontSize: ms(12),
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: vs(18),
    marginBottom: SPACE.SECTION,
  },
  consentAllowBtn: {
    width: '100%',
    height: vs(48),
    borderRadius: ms(12),
    backgroundColor: PHARMA_TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(10),
  },
  consentAllowText: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#FFFFFF',
  },
  consentBackBtn: {
    width: '100%',
    height: vs(44),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentBackText: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#64748B',
  },
  cameraWrap: {
    flex: 1,
    position: 'relative',
  },
  noCamera: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCameraText: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topBar: {
    position: 'absolute',
    top: vs(12),
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
  },
  roundBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  counterBadge: {
    position: 'absolute',
    top: vs(64),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: ms(14),
    paddingHorizontal: hs(14),
    paddingVertical: vs(4),
  },
  counterText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: vs(24),
    paddingTop: SPACE.BLOCK,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
  },
  thumbStrip: {
    paddingHorizontal: hs(16),
    gap: hs(10),
    marginBottom: SPACE.BLOCK,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(10),
    backgroundColor: '#FFFFFF',
  },
  thumbDelete: {
    position: 'absolute',
    top: vs(-6),
    right: hs(-6),
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  controlRow: {
    alignItems: 'center',
    marginBottom: SPACE.BLOCK,
  },
  shutterBtn: {
    width: ms(68),
    height: ms(68),
    borderRadius: ms(34),
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    backgroundColor: '#FFFFFF',
  },
  confirmBtn: {
    marginHorizontal: hs(16),
    height: vs(48),
    borderRadius: ms(12),
    backgroundColor: PHARMA_TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#9E9E9E',
  },
  confirmText: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
