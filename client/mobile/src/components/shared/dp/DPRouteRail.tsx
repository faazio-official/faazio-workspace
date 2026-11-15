import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

export interface DPRouteRailStop {
  /** Short place label shown under the node, e.g. "Store" or "Customer". */
  label: string;
  /** Force-complete a node regardless of `activeIndex`. */
  done?: boolean;
}

interface DPRouteRailProps {
  stops: DPRouteRailStop[];
  /** 0-based index of the stop in progress; stops before it read as done. */
  activeIndex?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The delivery app's signature: one dotted pickup → drop → …N route line with a
 * live position dot, reused on the offer card, the active-route card and the
 * Route screen. Brand fills completed legs; a tinted ring marks the current stop.
 */
export function DPRouteRail({ stops, activeIndex = 0, style }: DPRouteRailProps) {
  if (stops.length === 0) return null;
  return (
    <View
      style={[styles.rail, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Route: ${stops.map((stop) => stop.label).join(' to ')}`}
    >
      {stops.map((stop, index) => {
        const isDone = stop.done ?? index < activeIndex;
        const isCurrent = !isDone && index === activeIndex;
        const reached = isDone || isCurrent;
        const leftDone = isDone || index <= activeIndex;
        const rightDone = isDone || index < activeIndex;
        return (
          <View key={`${stop.label}-${index}`} style={styles.cell}>
            <View style={styles.dotRow}>
              <View
                style={[
                  styles.halfLine,
                  { backgroundColor: leftDone ? DELIVERY.brand : DELIVERY.border },
                  index === 0 && styles.hidden,
                ]}
              />
              <View
                style={[
                  styles.dot,
                  reached
                    ? { backgroundColor: DELIVERY.brand, borderColor: DELIVERY.brand }
                    : { backgroundColor: DELIVERY.surfaceAlt, borderColor: DELIVERY.border },
                  isCurrent && styles.dotCurrent,
                ]}
              />
              <View
                style={[
                  styles.halfLine,
                  { backgroundColor: rightDone ? DELIVERY.brand : DELIVERY.border },
                  index === stops.length - 1 && styles.hidden,
                ]}
              />
            </View>
            <AppText style={[styles.label, reached && styles.labelActive]} numberOfLines={1}>
              {stop.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const DOT = ms(12);
const LINE = Math.max(2, vs(2));

const styles = StyleSheet.create({
  rail: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { flex: 1 },
  dotRow: { flexDirection: 'row', alignItems: 'center' },
  halfLine: { flex: 1, height: LINE, borderRadius: LINE / 2, marginHorizontal: hs(2) },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCurrent: { borderWidth: ms(3), borderColor: DELIVERY.brandTint },
  hidden: { opacity: 0 },
  label: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(6), textAlign: 'center' },
  labelActive: { color: DELIVERY.ink },
});
