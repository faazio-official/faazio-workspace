import React, { memo, useState } from 'react';
import type { ImageStyle } from 'react-native';
import { AppImage } from '@/components/shared/AppImage';

interface MartImageProps {
  uri: string;
  style?: ImageStyle | ImageStyle[];
  contentFit?: 'cover' | 'contain' | 'fill';
  fallback?: string;
}

const DEFAULT_FALLBACK =
  'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?fm=jpg&fit=crop&q=80&w=500&h=500';

const MartImage = memo(function MartImage({
  uri,
  style,
  contentFit = 'cover',
  fallback = DEFAULT_FALLBACK,
}: MartImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <AppImage
      source={{ uri: failed ? fallback : uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={180}
      onError={() => setFailed(true)}
    />
  );
});

export default MartImage;
