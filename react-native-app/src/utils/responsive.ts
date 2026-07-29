import { Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');

const BASELINE_W = 375;
const BASELINE_H = 812;

export { SCREEN_W, SCREEN_H };

export function hs(n: number): number {
  return (n * SCREEN_W) / BASELINE_W;
}

export function vs(n: number): number {
  return (n * SCREEN_H) / BASELINE_H;
}

export function ms(n: number, factor = 0.5): number {
  return n + (hs(n) - n) * factor;
}

export function wp(pct: number): number {
  return (SCREEN_W * pct) / 100;
}

export function hp(pct: number): number {
  return (SCREEN_H * pct) / 100;
}

export const DOME_RADIUS = ms(44);
