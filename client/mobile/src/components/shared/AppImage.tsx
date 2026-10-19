import React, { useCallback, useRef } from 'react';
import { Animated, Image } from 'react-native';
import type {
  ImageProps,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
} from 'react-native';

export type AppImageContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

export interface AppImageProps extends Omit<ImageProps, 'style' | 'source' | 'resizeMode'> {
  source: ImageSourcePropType | string;
  style?: StyleProp<ImageStyle>;
  /** Content-fit value; mapped onto the native `resizeMode`. */
  contentFit?: AppImageContentFit;
  /** Fade-in duration in ms (0 disables the animation). */
  transition?: number;
  /** Accepted for API compatibility; native Fresco/NSURLCache handles caching. */
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
}

function normalizeSource(source: ImageSourcePropType | string): ImageSourcePropType {
  return typeof source === 'string' ? { uri: source } : source;
}

function toResizeMode(
  contentFit: AppImageContentFit,
): 'cover' | 'contain' | 'stretch' | 'center' {
  switch (contentFit) {
    case 'fill':
      return 'stretch';
    case 'none':
      return 'center';
    case 'scale-down':
      return 'contain';
    default:
      return contentFit;
  }
}

/**
 * The single image primitive for the app, so caching/fit policy has one owner.
 */
export function AppImage({
  source,
  style,
  contentFit = 'cover',
  transition = 0,
  onLoad,
  ...rest
}: AppImageProps) {
  const opacity = useRef(new Animated.Value(transition > 0 ? 0 : 1)).current;

  const handleLoad = useCallback<NonNullable<ImageProps['onLoad']>>(
    (event) => {
      if (transition > 0) {
        Animated.timing(opacity, {
          toValue: 1,
          duration: transition,
          useNativeDriver: true,
        }).start();
      }
      onLoad?.(event);
    },
    [opacity, transition, onLoad],
  );

  return (
    <Animated.Image
      {...rest}
      source={normalizeSource(source)}
      resizeMode={toResizeMode(contentFit)}
      onLoad={handleLoad}
      style={[style, { opacity }]}
    />
  );
}

/** Warm the native image cache ahead of a render (fire-and-forget). */
AppImage.prefetch = async (urls: string | string[]): Promise<boolean> => {
  const list = Array.isArray(urls) ? urls : [urls];
  await Promise.all(list.map((url) => Image.prefetch(url).catch(() => false)));
  return true;
};

export default AppImage;
