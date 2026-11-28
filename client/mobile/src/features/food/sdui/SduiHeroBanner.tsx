import React, { memo, useMemo } from 'react';
import { ImageBackground, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { hs, ms, vs } from '@/utils/responsive';
import AppText from '@/components/AppText';
import type { SduiWidget } from '@/services/api/sduiLayout';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

interface Props {
  widget: SduiWidget;
  /** Server-adjusted epoch millis — never the raw device clock. */
  now: number;
  onPress: (widget: SduiWidget) => void;
}

/** A hero is tappable only when it carries a deep link the app can resolve; anything else
 * renders as a static banner with no CTA instead of a dead button. */
function isInteractive(widget: SduiWidget): boolean {
  return widget.action?.type === 'DEEP_LINK' && !!widget.action.route;
}

function mmss(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * SDUI hero banner (schema 1.2, type HERO_PROMO_BANNER).
 *
 * The expiry state is derived from `now` (server-corrected) on every tick: the exact millisecond the
 * window closes the banner either locks with an "Offer ended" overlay or the caller swaps in the
 * pre-fetched fallback widget — no network call at the expiry second.
 */
const SduiHeroBanner = memo(function SduiHeroBanner({ widget, now, onPress }: Props) {
  const copy = widget.copy ?? {};
  const schedule = widget.schedule;
  const startMs = schedule ? Date.parse(schedule.starts_at_utc) : NaN;
  const endMs = schedule ? Date.parse(schedule.expires_at_utc) : NaN;

  const phase = useMemo<'scheduled' | 'live' | 'locked'>(() => {
    if (!schedule) return 'live';
    if (!Number.isNaN(startMs) && now < startMs) return 'scheduled';
    if (!Number.isNaN(endMs) && now >= endMs) {
      return schedule.on_expire_action === 'LOCK_OVERLAY' ? 'locked' : 'live';
    }
    return 'live';
  }, [schedule, now, startMs, endMs]);

  const remaining = Number.isNaN(endMs) ? 0 : endMs - now;
  const headline = copy.headline ?? '';
  const accent = copy.accent_headline;
  const [before, after] = accent && headline.includes(accent) ? headline.split(accent) : [headline, ''];

  const body = (
    <View style={styles.content}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 340 220" pointerEvents="none">
        <Circle cx="300" cy="26" r="74" stroke="#F2A63B" strokeOpacity={0.14} strokeWidth="1" fill="none" />
        <Circle cx="300" cy="26" r="54" stroke="#F2A63B" strokeOpacity={0.1} strokeWidth="1" fill="none" />
        <Circle cx="34" cy="196" r="58" stroke="#F2A63B" strokeOpacity={0.12} strokeWidth="1" fill="none" />
        <Path d="M12 96 H92" stroke="#F2A63B" strokeOpacity={0.22} strokeWidth="1" />
      </Svg>

      {copy.eyebrow ? (
        <AppText style={styles.eyebrow} numberOfLines={2}>
          {copy.eyebrow}
        </AppText>
      ) : null}
      {headline ? (
        <AppText style={styles.headline}>
          {before}
          {accent ? <Text style={styles.accent}>{accent}</Text> : null}
          {after}
        </AppText>
      ) : null}
      {copy.body ? <AppText style={styles.body}>{copy.body}</AppText> : null}
      {copy.code ? (
        <View style={styles.codePill}>
          {copy.code_label ? <AppText style={styles.codeLabel}>{copy.code_label}</AppText> : null}
          <AppText style={styles.code}>{copy.code}</AppText>
        </View>
      ) : null}

      {isInteractive(widget) ? (
        <View style={styles.cta}>
          <AppText style={styles.ctaLabel}>{copy.cta ?? 'Order Now'}</AppText>
          <ChevronRight size={ms(14)} color="#2B0909" strokeWidth={3} />
        </View>
      ) : null}

      {schedule && phase === 'live' ? (
        <View style={styles.timer}>
          <View style={styles.timerDot} />
          <AppText style={styles.timerText}>ENDS {mmss(remaining)}</AppText>
        </View>
      ) : null}

      {phase === 'locked' ? (
        <View style={styles.overlay}>
          <AppText style={styles.overlayText}>Offer ended</AppText>
        </View>
      ) : null}
      {phase === 'scheduled' ? (
        <View style={styles.overlay}>
          <AppText style={styles.overlayText}>
            Starts {new Date(startMs).toISOString().slice(11, 16)}Z
          </AppText>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onPress(widget)}
        disabled={phase !== 'live' || !isInteractive(widget)}
        accessibilityRole="button"
        accessibilityLabel={`${copy.eyebrow ?? 'Offer'}: ${headline}${copy.code ? `, code ${copy.code}` : ''}`}
        accessibilityState={{ disabled: phase !== 'live' || !isInteractive(widget) }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {widget.media?.url ? (
          <ImageBackground
            source={{ uri: widget.media.url }}
            style={styles.card}
            imageStyle={styles.cardImage}
            resizeMode="cover"
          >
            <View style={styles.scrim}>{body}</View>
          </ImageBackground>
        ) : (
          body
        )}
      </Pressable>
    </View>
  );
});

export default SduiHeroBanner;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: hs(16),
    paddingTop: vs(6),
  },
  card: {
    borderRadius: ms(18),
    overflow: 'hidden',
    backgroundColor: '#4A1010',
  },
  cardPressed: {
    opacity: 0.94,
  },
  cardImage: {
    borderRadius: ms(18),
  },
  scrim: {
    backgroundColor: 'rgba(43, 9, 9, 0.62)',
  },
  content: {
    minHeight: vs(214),
    paddingVertical: vs(18),
    paddingHorizontal: hs(18),
    justifyContent: 'center',
    gap: vs(4),
  },
  eyebrow: {
    fontFamily: SERIF,
    fontSize: ms(30),
    lineHeight: vs(31),
    letterSpacing: ms(0.5),
    color: '#E9C375',
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: ms(17),
    lineHeight: vs(23),
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: vs(4),
  },
  accent: {
    color: '#F6C453',
    fontWeight: '700',
  },
  body: {
    fontSize: ms(12),
    color: 'rgba(255,255,255,0.82)',
  },
  codePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
    marginTop: vs(8),
    paddingHorizontal: hs(11),
    paddingVertical: vs(4),
    borderRadius: ms(999),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(233,195,117,0.9)',
  },
  codeLabel: {
    fontSize: ms(10),
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.86)',
  },
  code: {
    fontSize: ms(10),
    letterSpacing: 0.8,
    fontWeight: '700',
    color: '#F6C453',
  },
  cta: {
    marginTop: vs(10),
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    backgroundColor: '#F6C453',
    paddingHorizontal: hs(16),
    paddingVertical: vs(9),
    borderRadius: ms(999),
    minHeight: vs(38),
  },
  ctaLabel: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#2B0909',
  },
  timer: {
    position: 'absolute',
    top: vs(12),
    right: hs(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(5),
    backgroundColor: 'rgba(10,13,17,0.72)',
    paddingHorizontal: hs(9),
    paddingVertical: vs(3),
    borderRadius: ms(999),
  },
  timerDot: {
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: '#F6C453',
  },
  timerText: {
    fontSize: ms(9),
    letterSpacing: 0.7,
    color: '#F6C453',
    fontVariant: ['tabular-nums'],
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,13,17,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: ms(12),
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});
