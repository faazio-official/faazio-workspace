import React, { memo, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Tag, ArrowRight } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import type { AdSlide } from '@data/types';
import AppText from '@/components/AppText';
import AdLabelBadge from './AdLabelBadge';

const SWIPE_INTERVAL = 4500;

interface AdBannerCarouselProps {
  slides: AdSlide[];
  onSlidePress?: (slide: AdSlide) => void;
  /** Overlay the shared "AD" disclosure pill (for genuinely paid placements). */
  showAdLabel?: boolean;
  /** Stable React key per slide. Defaults to `slide.title` (callers with duplicate titles pass one). */
  slideKey?: (slide: AdSlide, index: number) => string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Auto-playing paged ad-banner carousel (16:9 full-width rounded card, expo-image bg +
 * overlay + badge + title/tagline). Presentation-only: the caller owns spacing
 * via `style` and optional tap handling via `onSlidePress` (no handler → tap is
 * a no-op). Extracted from the Home hub's `AdBannerSection` so Food can reuse it
 * without crossing the food→home boundary. Optional `showAdLabel` adds the AD pill.
 */
const AdBannerCarousel = memo(function AdBannerCarousel({
  slides,
  onSlidePress,
  showAdLabel = false,
  slideKey,
  style,
}: AdBannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % slides.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, SWIPE_INTERVAL);
    return () => clearInterval(timer);
  }, [width, slides.length]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    setIndex(Math.min(Math.max(next, 0), slides.length - 1));
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
            style={styles.scroll}
          >
            {slides.map((slide, i) => (
              <TouchableOpacity
                key={slideKey ? slideKey(slide, i) : slide.title}
                style={[styles.slide, { width }]}
                activeOpacity={0.9}
                onPress={() => onSlidePress?.(slide)}
              >
                <ExpoImage
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
                  <View style={styles.adLabelWrap}>
                    <AdLabelBadge />
                  </View>
                )}
                <View style={styles.content}>
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
          <View style={styles.dots}>
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
    fontSize: ms(8),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: hs(4),
  },
  adLabelWrap: {
    position: 'absolute',
    top: vs(14),
    right: hs(14),
  },
  content: {
    position: 'absolute',
    bottom: vs(16),
    left: hs(16),
    right: hs(16),
  },
  title: {
    color: '#ffffff',
    fontSize: ms(14),
    fontWeight: '900',
    lineHeight: ms(18),
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(4),
    gap: hs(4),
  },
  tagline: {
    color: '#cbd5e1',
    fontSize: ms(10),
    fontWeight: '600',
    flex: 1,
  },
  dots: {
    position: 'absolute',
    bottom: vs(10),
    right: hs(14),
    flexDirection: 'row',
    gap: hs(4),
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
