import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, ScrollView, Platform, KeyboardAvoidingView, Animated, Easing } from 'react-native';
import { hs, vs, ms, wp, hp, STATUS_BAR_INSET } from '@/utils/responsive';
import { Screen } from '@/components/shared';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/AppNavigator';
import {
  ChevronLeft,
  ArrowRight,
  Navigation as NavigationIcon,
  Search,
  X,
} from 'lucide-react-native';
import Svg, {
  Path,
  Circle,
  Line,
  G,
  Rect,
} from 'react-native-svg';
import locationAccessPageImg from '@/assets/location_access_page.webp';
import AppTextInput from '@/components/AppTextInput';
import AppText from '@/components/AppText';

type Props = NativeStackScreenProps<RootStackParamList, 'Location'>;

function StreetMapSVG() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 500 700">
      <Rect width="100%" height="100%" fill="#FDFBF7" />
      <Path d="M -20,100 C 100,120 180,60 300,110 L 500,150 L 500,-50 L -20,-50 Z" fill="#EBF3FC" />
      <Rect x={250} y={30} width={120} height={80} rx={16} fill="#E6F4EA" opacity={0.8} />
      <Rect x={-40} y={480} width={180} height={150} rx={24} fill="#E6F4EA" opacity={0.6} />
      <Rect x={280} y={550} width={200} height={180} rx={24} fill="#E6F4EA" opacity={0.6} />
      <G stroke="#F2E6D0" strokeWidth={6} strokeLinecap="round">
        <Line x1={-50} y1={200} x2={500} y2={200} />
        <Line x1={-50} y1={360} x2={500} y2={360} stroke="#FCECD4" strokeWidth={12} />
        <Line x1={-50} y1={520} x2={500} y2={520} />
        <Line x1={80} y1={-50} x2={80} y2={900} />
        <Line x1={240} y1={-50} x2={240} y2={900} stroke="#FCECD4" strokeWidth={10} />
        <Line x1={400} y1={-50} x2={400} y2={900} />
      </G>
      <G stroke="#F4ECE1" strokeWidth={3} strokeLinecap="round">
        <Line x1={-50} y1={120} x2={500} y2={120} />
        <Line x1={-50} y1={280} x2={500} y2={280} />
        <Line x1={-50} y1={440} x2={500} y2={440} />
        <Line x1={-50} y1={600} x2={500} y2={600} />
        <Line x1={160} y1={-50} x2={160} y2={900} />
        <Line x1={320} y1={-50} x2={320} y2={900} />
        <Line x1={460} y1={-50} x2={460} y2={900} />
      </G>
      <Path d="M -50,60 Q 180,320 500,480" fill="none" stroke="#F5EDE4" strokeWidth={6} />
      <Path d="M -50,300 C 150,150 350,450 500,280" fill="none" stroke="#F2E6D0" strokeWidth={5} />
    </Svg>
  );
}

function PulsingLocator() {
  const ring1Anim = useRef(new Animated.Value(0)).current;
  const ring2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.timing(ring1Anim, { toValue: 1, duration: 2200, useNativeDriver: true })
    );
    const loop2 = Animated.loop(
      Animated.timing(ring2Anim, { toValue: 1, duration: 2200, useNativeDriver: true })
    );
    loop1.start();
    const delay = setTimeout(() => loop2.start(), 700);
    return () => { loop1.stop(); loop2.stop(); clearTimeout(delay); };
  }, [ring1Anim, ring2Anim]);

  const ring1Scale = ring1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] });
  const ring1Opacity = ring1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });
  const ring2Scale = ring2Anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.1] });
  const ring2Opacity = ring2Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
      <View style={{ width: ms(224), height: ms(224), alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: ms(112),
            height: ms(112),
            borderRadius: ms(56),
            borderWidth: 4,
            borderColor: 'rgba(16,185,129,0.3)',
            backgroundColor: 'rgba(16,185,129,0.05)',
            transform: [{ scale: ring1Scale }],
            opacity: ring1Opacity,
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            width: ms(112),
            height: ms(112),
            borderRadius: ms(56),
            borderWidth: 2,
            borderColor: 'rgba(52,211,153,0.4)',
            transform: [{ scale: ring2Scale }],
            opacity: ring2Opacity,
          }}
        />
        <View
          style={{
            width: ms(48),
            height: ms(48),
            borderRadius: ms(24),
            backgroundColor: 'rgba(16,185,129,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#10B981',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View
            style={{
              width: ms(24),
              height: ms(24),
              borderRadius: ms(12),
              backgroundColor: '#10B981',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: ms(10), height: ms(10), borderRadius: ms(5), backgroundColor: '#ffffff' }} />
          </View>
        </View>
      </View>
  );
}

function BouncingPin() {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounceAnim]);

  const translateY = bounceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, -28],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: vs(-10),
        transform: [{ translateY }],
      }}
    >
      <Svg viewBox="0 0 100 120" width={ms(56)} height={ms(64)}>
        <Path
          d="M 50,115 C 50,115 20,75 12,58 C 4,40 10,12 40,4 C 70,-4 92,10 92,34 C 92,54 75,75 50,115 Z"
          fill="#111111"
        />
        <Circle cx="50" cy="38" r="14" fill="#FFFFFF" />
        <Circle cx="50" cy="38" r="7" fill="#10B981" />
      </Svg>
    </Animated.View>
  );
}

export function LocationScreen({ navigation }: Props) {
  const [step, setStep] = useState<'request' | 'manual' | 'loader'>('request');
  const [selectedLocation, setSelectedLocation] = useState(
    'Sunnambukkara Street, Karaikal'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const illustScale = useRef(new Animated.Value(0.95)).current;
  const illustTranslateY = useRef(new Animated.Value(10)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const loaderFade = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 'loader') {
      const timer = setTimeout(() => {
        navigation.navigate('MainTabs');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, navigation]);

  // Request step entry animations
  useEffect(() => {
    if (step === 'request') {
      fadeAnim.setValue(0);
      illustScale.setValue(0.95);
      illustTranslateY.setValue(10);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.spring(illustScale, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(illustTranslateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [step, fadeAnim, illustScale, illustTranslateY]);

  // Manual step slide-in animation
  useEffect(() => {
    if (step === 'manual') {
      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [step, slideAnim]);

  // Loader step fade + card entry animations
  useEffect(() => {
    if (step === 'loader') {
      loaderFade.setValue(0);
      cardAnim.setValue(0);
      Animated.parallel([
        Animated.timing(loaderFade, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(cardAnim, {
          toValue: 1,
          duration: 400,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [step, loaderFade, cardAnim]);

  const slideOpacity = slideAnim;
  const slideTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const cardOpacity = cardAnim;
  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const searchResults = [
    { title: 'Karaikal Beach', subtitle: 'Karaikal, Puducherry' },
    { title: 'Karaikal Bus Stand', subtitle: 'Karaikal, Puducherry' },
    {
      title: 'Karaikal Railway Station (KIK)',
      subtitle: 'Karaikal, Puducherry, India',
    },
    {
      title: 'Karaikal Ammaiyar Temple',
      subtitle: 'Bharathiyar Street, Karaikal, Puducherry',
    },
  ].filter(
    (item) =>
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Screen>
      {step === 'request' && (
        <Animated.View style={[styles.requestContainer, { opacity: fadeAnim }]}>

          <View style={styles.topTextContent}>
            <View style={styles.titleWrapper}>
              <AppText style={styles.titleText}>
                What is{' '}
                <AppText style={styles.titleTextAccent}>your</AppText> location?
              </AppText>
            </View>
          </View>

          <Animated.View
            style={[
              styles.graphicContainer,
              {
                transform: [{ scale: illustScale }, { translateY: illustTranslateY }],
              },
            ]}
          >
            <Image
              source={locationAccessPageImg}
              style={styles.graphicImage}
              resizeMode="contain"
            />
          </Animated.View>

          <View style={styles.bottomCTAs}>
            <Pressable
              style={({ pressed }) => [
                styles.allowBtn,
                { transform: [{ scale: pressed ? 0.95 : 1 }] },
              ]}
              onPress={() => {
                setSelectedLocation('Sunnambukkara Street, Karaikal');
                setStep('loader');
              }}
            >
              <AppText style={styles.allowBtnText}>ALLOW LOCATION ACCESS</AppText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.manualBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setStep('manual')}
            >
              <AppText style={styles.manualBtnText}>
                Enter Location Manually
              </AppText>
              <ArrowRight size={ms(11)} color="#1e293b" />
            </Pressable>
          </View>
        </Animated.View>
      )}

      {step === 'manual' && (
        <Animated.View
          style={[
            styles.manualContainer,
            { opacity: slideOpacity, transform: [{ translateX: slideTranslateX }] },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.manualHeader}>
              <Pressable
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
                onPress={() => setStep('request')}
              >
                <ChevronLeft size={ms(20)} color="#334155" />
              </Pressable>
              <AppText style={styles.manualHeaderTitle}>
                Enter your area or apartment name
              </AppText>
            </View>

            <View style={styles.searchSection}>
              <View
                style={[
                  styles.searchInputContainer,
                  isSearchFocused && styles.searchInputContainerFocused,
                ]}
              >
                <Search size={ms(16)} color="#94a3b8" style={styles.searchIcon} />
                <AppTextInput
                  style={styles.searchInput}
                  placeholder="Try Golden Nagar, Church Street, etc."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.clearBtn,
                      pressed && { backgroundColor: '#cbd5e1' },
                    ]}
                    onPress={() => setSearchQuery('')}
                  >
                    <X size={ms(10)} color="#64748b" />
                  </Pressable>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.currentLocationBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  setSelectedLocation('Sunnambukkara Street, Karaikal');
                  setStep('loader');
                }}
              >
                <View style={styles.currentLocationLeft}>
                  <View style={styles.currentLocationIconBg}>
                    <NavigationIcon
                      size={ms(14)}
                      color="#3D8CF2"
                      style={{ transform: [{ rotate: '135deg' }] }}
                    />
                  </View>
                  <AppText style={styles.currentLocationText}>
                    Use my current location
                  </AppText>
                </View>
                <ChevronLeft size={ms(14)} color="#3D8CF2" style={{ transform: [{ rotate: '180deg' }] }} />
              </Pressable>
            </View>

            <View style={styles.separator} />

            <ScrollView style={styles.resultsList}>
              <AppText style={styles.resultsHeader}>SEARCH RESULTS</AppText>
              {searchResults.length > 0 ? (
                searchResults.map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={({ pressed }) => [
                      styles.resultItem,
                      { backgroundColor: pressed ? '#f1f5f9' : 'transparent' },
                    ]}
                    onPress={() => {
                      setSelectedLocation(
                        `${item.title}, ${item.subtitle.split(',')[0]}`
                      );
                      setStep('loader');
                    }}
                  >
                    <View style={styles.resultIconBg}>
                      <NavigationIcon
                        size={ms(13)}
                        color="#94a3b8"
                        style={{ transform: [{ rotate: '135deg' }] }}
                      />
                    </View>
                    <View style={styles.resultTextContainer}>
                      <AppText style={styles.resultTitle}>{item.title}</AppText>
                      <AppText style={styles.resultSubtitle}>
                        {item.subtitle}
                      </AppText>
                    </View>
                  </Pressable>
                ))
              ) : (
                <View style={styles.noResultsContainer}>
                  <AppText style={styles.noResultsText}>
                    No locations found matching your search
                  </AppText>
                  <Pressable
                    style={({ pressed }) => [
                      styles.useAnywayBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => {
                      setSelectedLocation(`${searchQuery}, Karaikal`);
                      setStep('loader');
                    }}
                  >
                    <AppText style={styles.useAnywayText}>
                      USE "{searchQuery}" ANYWAY
                    </AppText>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      )}

      {step === 'loader' && (
        <Animated.View style={[styles.loaderContainer, { opacity: loaderFade }]}>
          <StreetMapSVG />

          <View style={styles.loaderLocatorArea}>
            <View style={styles.locatorBox}>
              <PulsingLocator />
              <BouncingPin />
            </View>
          </View>

          <View style={styles.loaderCardArea}>
            <Animated.View
              style={[
                styles.deliveringCard,
                {
                  opacity: cardOpacity,
                  transform: [{ translateY: cardTranslateY }],
                },
              ]}
            >
              <AppText style={styles.deliveringLabel}>DELIVERING TO</AppText>
              <View style={styles.deliveringLocationRow}>
                <View style={styles.greenDot} />
                <AppText style={styles.deliveringTitle} numberOfLines={1}>
                  {selectedLocation.split(',')[0]}
                </AppText>
              </View>
              <AppText
                style={styles.deliveringAddress}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {selectedLocation}
              </AppText>
            </Animated.View>
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  requestContainer: {
    flex: 1,
    paddingHorizontal: hs(24),
    paddingVertical: vs(24),
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  topTextContent: { alignItems: 'center', paddingTop: vs(16), zIndex: 10 },
  titleWrapper: { alignItems: 'center' },
  titleText: {
    fontWeight: '900',
    color: '#0f172a',
    fontSize: ms(24),
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: vs(16),
  },
  titleTextAccent: {
    color: '#7C3AED',
  },
  graphicContainer: {
    flex: 1,
    width: '100%',
    maxWidth: hs(340),
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: vs(16),
  },
  graphicImage: { width: '100%', height: '100%' },
  bottomCTAs: { width: '100%', paddingBottom: vs(24), zIndex: 10 },
  allowBtn: {
    width: '100%',
    height: Math.max(44, vs(44)),
    borderRadius: ms(12),
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  allowBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: ms(12),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    marginTop: vs(18),
  },
  manualBtnText: { fontSize: ms(11), fontWeight: '900', color: '#1e293b' },
  manualContainer: { flex: 1, backgroundColor: '#ffffff' },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingTop: Platform.OS === 'ios' ? vs(56) : STATUS_BAR_INSET + vs(8),
    paddingBottom: vs(12),
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    gap: hs(12),
  },
  backBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualHeaderTitle: { fontWeight: '900', fontSize: ms(14), color: '#0f172a' },
  searchSection: { paddingHorizontal: hs(16), paddingVertical: vs(16) },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: ms(12),
    height: Math.max(44, vs(44)),
    paddingHorizontal: hs(14),
  },
  searchInputContainerFocused: {
    borderColor: '#3D8CF2',
    backgroundColor: '#ffffff',
  },
  searchIcon: { marginRight: hs(10) },
  searchInput: { flex: 1, fontSize: ms(12), fontWeight: '600', color: '#0f172a' },
  clearBtn: {
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(14),
    marginTop: vs(8),
  },
  currentLocationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
  },
  currentLocationIconBg: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationText: { fontSize: ms(12), fontWeight: '900', color: '#3D8CF2' },
  separator: {
    height: vs(8),
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: hs(16),
    paddingTop: vs(16),
  },
  resultsHeader: {
    fontSize: ms(10),
    letterSpacing: 1,
    color: '#94a3b8',
    fontWeight: '700',
    marginBottom: vs(12),
    paddingHorizontal: hs(4),
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: hs(14),
    paddingVertical: vs(12),
    paddingHorizontal: hs(8),
    borderRadius: ms(12),
  },
  resultIconBg: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(2),
  },
  resultTextContainer: { flex: 1 },
  resultTitle: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: vs(2),
  },
  resultSubtitle: { fontSize: ms(10), color: '#94a3b8', fontWeight: '600' },
  noResultsContainer: { alignItems: 'center', paddingVertical: vs(32) },
  noResultsText: { fontSize: ms(12), fontWeight: '600', color: '#94a3b8' },
  useAnywayBtn: {
    marginTop: vs(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(6),
    backgroundColor: '#3D8CF2',
    borderRadius: ms(8),
  },
  useAnywayText: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: '#F9F6F0',
    position: 'relative',
  },
  loaderLocatorArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: vs(64),
    zIndex: 10,
  },
  locatorBox: {
    width: ms(224),
    height: ms(224),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  loaderCardArea: {
    width: '100%',
    paddingHorizontal: hs(20),
    paddingBottom: vs(48),
    zIndex: 10,
  },
  deliveringCard: {
    backgroundColor: '#ffffff',
    paddingHorizontal: hs(20),
    paddingVertical: vs(20),
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    maxWidth: hs(340),
    alignSelf: 'center',
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 36,
    elevation: 12,
  },
  deliveringLabel: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  deliveringLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    marginTop: vs(10),
  },
  greenDot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: '#10B981',
  },
  deliveringTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
    maxWidth: hs(240),
  },
  deliveringAddress: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: vs(4),
  },
});
