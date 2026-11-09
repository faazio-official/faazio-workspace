import React, { memo, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  AppState,
  NativeSyntheticEvent,
  NativeScrollEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppImage } from './AppImage';
import { Tag, ArrowRight } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import type { AdSlide } from '@data/types';
import AppText from '@/components/AppText';
import AdLabelBadge from './AdLabelBadge';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SWIPE_INTERVAL = 4500;

interface AdBannerCarouselProps {
  slides: AdSlide[];
  onSlidePress?: (slide: AdSlide) => void;
  /** Overlay the shared "AD" disclosure pill (for genuinely paid placements). */
  showAdLabel?: boolean;
  /** Corner for the "AD" pill. Default `top-right`. */
  adLabelPosition?: 'top-right' | 'bottom-right';
  /** Pill styling: `dark` (default) or `light` (gray pill + black "Ad"). */
  adLabelTone?: 'dark' | 'light';
  /** Screen-reader label for each slide (e.g. "Sponsored" on paid placements). */
  accessibilityLabel?: string;
  /** Stable React key per slide. Defaults to `slide.title` (callers with duplicate titles pass one). */
  slideKey?: (slide: AdSlide, index: number) => string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Auto-playing paged ad-banner carousel (16:9 full-width rounded card, image bg +
 * overlay + badge + title/tagline). Presentation-only: the caller owns spacing
 * via `style` and optional tap handling via `onSlidePress` (no handler → tap is
 * a no-op). Extracted from the Home hub's `AdBannerSection` so Food can reuse it
 * without crossing the food→home boundary. Optional `showAdLabel` adds the AD pill.
 */
const AdBannerCarousel = memo(function AdBannerCarousel({
  slides,
  onSlidePress,
  showAdLabel = false,
  adLabelPosition = 'top-right',
  adLabelTone = 'dark',
  accessibilityLabel,
  slideKey,
  style,
}: AdBannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const reduceMotion = useReducedMotion();

  // Auto-advance only when it is safe: more than one slide, motion allowed,
  // the user has not interacted, and the app is foregrounded.
  useEffect(() => {
    if (slides.length < 2 || reduceMotion || paused || !appActive) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % slides.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: !reduceMotion });
        return next;
      });
    }, SWIPE_INTERVAL);
    return () => clearInterval(timer);
  }, [width, slides.length, reduceMotion, paused, appActive]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) =>
      setAppActive(state === 'active'),
    );
    return () => sub.remove();
  }, []);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    setIndex(Math.min(Math.max(next, 0), slides.length - 1));
    // Interaction pauses autoplay; resume once the gesture settles.
    setPaused(false);
  };

  return (
    <View style={style}>
      <View
        style={styles.viewport}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScrollBeginDrag={() => setPaused(true)}
            onScrollEndDrag={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
            style={styles.scroll}
          >
            {slides.map((slide, i) => (
              <TouchableOpacity
                key={slideKey ? slideKey(slide, i) : slide.title}
                style={[styles.slide, { width }]}
                activeOpacity={0.9}
                accessibilityRole={onSlidePress ? 'button' : 'image'}
                accessibilityLabel={accessibilityLabel ? `${accessibilityLabel}. ${slide.title}` : slide.title}
                accessibilityHint={onSlidePress ? 'Opens the advertised offer' : undefined}
                onPress={() => onSlidePress?.(slide)}
              >
                <AppImage
                  source={{ uri: slide.imageUrl }}
                  style={styles.bg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={120}
                />
                <View style={styles.overlay} />
                {slide.badge && (
                  <View style={styles.badge}>
                    <Tag size={ms(9)} color="#fbbf24" fill="#fbbf24" />
                    <AppText style={styles.badgeText}>{slide.badge}</AppText>
                  </View>
                )}
                {showAdLabel && (
                  <View
                    style={
                      adLabelPosition === 'bottom-right'
                        ? styles.adLabelWrapBottom
                        : styles.adLabelWrap
                    }
                  >
                    <AdLabelBadge tone={adLabelTone} />
                  </View>
                )}
                <View
                  style={[
                    styles.content,
                    adLabelPosition === 'bottom-right' && styles.contentRaised,
                  ]}
                >
                  <AppText style={styles.title}>{slide.title}</AppText>
                  <View style={styles.taglineRow}>
                    <AppText style={styles.tagline} numberOfLines={1}>{slide.tagline}</AppText>
                    <ArrowRight size={ms(10)} color="#cbd5e1" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {width > 0 && slides.length > 1 && (
          <View
            style={[styles.dots, adLabelPosition === 'bottom-right' && styles.dotsBottomLeft]}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Advertisement carousel"
            accessibilityValue={{
              min: 1,
              max: slides.length,
              now: index + 1,
              text: `Slide ${index + 1} of ${slides.length}`,
            }}
          >
            {slides.map((slide, i) => (
              <View key={slideKey ? slideKey(slide, i) : slide.title} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

export default AdBannerCarousel;

const styles = StyleSheet.create({
  viewport: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: ms(24),
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  slide: {
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  bg: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  badge: {
    position: 'absolute',
    top: vs(14),
    left: hs(14),
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: vs(4),
    paddingHorizontal: hs(8),
    borderRadius: ms(6),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: ms(11),
    fontWeight: '600',
    letterSpacing: 0.2,
    marginLeft: hs(4),
  },
  adLabelWrap: {
    position: 'absolute',
    top: vs(14),
    right: hs(14),
  },
  adLabelWrapBottom: {
    position: 'absolute',
    bottom: vs(10),
    right: hs(12),
  },
  content: {
    position: 'absolute',
    bottom: vs(16),
    left: hs(16),
    right: hs(16),
  },
  contentRaised: {
    bottom: vs(38),
  },
  title: {
    color: '#ffffff',
    fontSize: ms(15),
    fontWeight: '600',
    lineHeight: ms(19),
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(4),
    gap: hs(4),
  },
  tagline: {
    color: '#cbd5e1',
    fontSize: ms(11),
    fontWeight: '500',
    flex: 1,
  },
  dots: {
    position: 'absolute',
    bottom: vs(10),
    right: hs(14),
    flexDirection: 'row',
    gap: hs(4),
  },
  dotsBottomLeft: {
    right: undefined,
    left: hs(14),
  },
  dot: {
    width: hs(5),
    height: vs(5),
    borderRadius: ms(3),
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: hs(12),
    backgroundColor: '#ffffff',
  },
});
