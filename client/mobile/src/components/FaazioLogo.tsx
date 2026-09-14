import React from 'react';
import Logo from '@/assets/logo.svg';

const SVG_VIEWBOX_WIDTH = 2171;
const SVG_VIEWBOX_HEIGHT = 724;
const ASPECT_RATIO = SVG_VIEWBOX_WIDTH / SVG_VIEWBOX_HEIGHT;

interface FaazioLogoProps {
  size?: number;
}

export function FaazioLogo({ size = 36 }: FaazioLogoProps) {
  const width = size * ASPECT_RATIO;
  return <Logo width={width} height={size} />;
}
