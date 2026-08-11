import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Image, ScrollView, TouchableOpacity, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Tag, ArrowRight } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { topAdSlides } from '@data/home/rails';
import { subAppIdFor } from './common';
import type { SectionProps } from './common';
import AppText from '@/components/AppText';

const SWIPE_INTERVAL = 4500;

function AdBannerSection({ onLaunchSubApp }: SectionProps) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % topAdSlides.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, SWIPE_INTERVAL);
    return () => clearInterval(timer);
  }, [width]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    setIndex(Math.min(Math.max(next, 0), topAdSlides.length - 1));
  };

  return (
    <View style={styles.wrap}>
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
          >
            {topAdSlides.map((slide) => (
              <TouchableOpacity
                key={slide.title}
                style={[styles.slide, { width }]}
                activeOpacity={0.9}
                onPress={() => slide.targetApp && onLaunchSubApp(subAppIdFor(slide.targetApp))}
              >
                <Image source={{ uri: slide.imageUrl }} style={styles.bg} />
                <View style={styles.overlay} />
                {slide.badge && (
                  <View style={styles.badge}>
                    <Tag size={ms(9)} color="#fbbf24" fill="#fbbf24" />
                    <AppText style={styles.badgeText}>{slide.badge}</AppText>
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
        {width > 0 && (
          <View style={styles.dots}>
            {topAdSlides.map((slide, i) => (
              <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default memo(AdBannerSection);

const styles = StyleSheet.create({
  wrap: {
    marginTop: vs(4),
    marginBottom: vs(12),
  },
  viewport: {
    height: vs(156),
    borderRadius: ms(24),
    overflow: 'hidden',
    marginHorizontal: hs(16),
    backgroundColor: '#0f172a',
    position: 'relative',
  },
  slide: {
    height: vs(156),
    position: 'relative',
    overflow: 'hidden',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
