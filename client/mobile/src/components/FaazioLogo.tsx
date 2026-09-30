import React from 'react';
import { Image } from 'react-native';
import Logo from '@/assets/logo.svg';
import welcomeLogo from '@/assets/logo-welcomepage.png';

/**
 * Brand mark geometry, measured from the assets (no guessing):
 *  - default: 2171×724 vector badge, artwork is full-bleed → visible == canvas.
 *  - welcome: 855×292 raster wordmark on a transparent canvas; the visible
 *    glyph box is 829×227 @ (15,34), i.e. the canvas is 1.286× taller than the
 *    mark. `size` is therefore applied to the *visible* mark so both variants
 *    share one optical scale.
 */
const VARIANTS = {
  default: { canvasW: 2171, canvasH: 724, contentH: 724 },
  welcome: { canvasW: 855, canvasH: 292, contentH: 227 },
} as const;

export type FaazioLogoVariant = keyof typeof VARIANTS;

interface FaazioLogoProps {
  /** Height of the visible brand mark (both variants). */
  size?: number;
  variant?: FaazioLogoVariant;
}

export function FaazioLogo({ size = 36, variant = 'default' }: FaazioLogoProps) {
  const { canvasW, canvasH, contentH } = VARIANTS[variant];
  const height = size * (canvasH / contentH);
  const width = height * (canvasW / canvasH);

  if (variant === 'welcome') {
    return <Image source={welcomeLogo} style={{ width, height }} resizeMode="contain" />;
  }
  return <Logo width={width} height={height} />;
}
