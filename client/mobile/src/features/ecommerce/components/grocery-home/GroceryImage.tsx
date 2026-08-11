import React, { memo, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import type { ImageStyle } from 'expo-image';

interface GroceryImageProps {
  uri: string;
  style?: ImageStyle | ImageStyle[];
  contentFit?: 'cover' | 'contain' | 'fill';
  fallback?: string;
}

const DEFAULT_FALLBACK =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?fm=jpg&fit=crop&q=80&w=500&h=500';

const GroceryImage = memo(function GroceryImage({
  uri,
  style,
  contentFit = 'cover',
  fallback = DEFAULT_FALLBACK,
}: GroceryImageProps) {
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

export default GroceryImage;
