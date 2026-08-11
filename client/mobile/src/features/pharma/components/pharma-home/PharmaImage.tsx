import React, { memo, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import type { ImageStyle } from 'expo-image';

interface PharmaImageProps {
  uri: string;
  style?: ImageStyle | ImageStyle[];
  contentFit?: 'cover' | 'contain' | 'fill';
  fallback?: string;
}

const DEFAULT_FALLBACK =
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=500&h=500';

const PharmaImage = memo(function PharmaImage({
  uri,
  style,
  contentFit = 'cover',
  fallback = DEFAULT_FALLBACK,
}: PharmaImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <ExpoImage
      source={{ uri: failed ? fallback : uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={180}
      onError={() => setFailed(true)}
    />
  );
});

export default PharmaImage;
