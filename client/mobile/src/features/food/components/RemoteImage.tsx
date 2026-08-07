import React, { memo, useState } from 'react';
import { Image as ExpoImage, type ImageProps } from 'expo-image';
import { FALLBACK_DISH_IMAGE, FALLBACK_RESTAURANT_IMAGE } from '../constants/assets';

type RemoteImageProps = Omit<ImageProps, 'source'> & {
  uri: string;
  variant?: 'dish' | 'restaurant';
};

/**
 * High-performance cached image (expo-image) with a graceful network fallback
 * so a stale mock URL never renders a broken card.
 */
const RemoteImage = memo(function RemoteImage({ uri, variant = 'dish', style, ...rest }: RemoteImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <ExpoImage
      source={{ uri: failed ? (variant === 'restaurant' ? FALLBACK_RESTAURANT_IMAGE : FALLBACK_DISH_IMAGE) : uri }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={180}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
});

export default RemoteImage;
