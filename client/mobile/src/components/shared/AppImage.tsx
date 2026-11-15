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
  /**
   * Upper bound for the image's laid-out width in dp. Pair with {@link maxHeight} (or an explicit
   * `width`/`height`) so Android's Fresco decoder sizes the bitmap to the viewport instead of the
   * full source resolution — the client lever for Play Console's "bitmap downsampling" finding.
   * This bounds layout; explicit `width`/`height` is still the strongest decode-size signal.
   */
  maxWidth?: number;
  /** Upper bound for the image's laid-out height in dp. See {@link maxWidth}. */
  maxHeight?: number;
  /**
   * Android bitmap sizing when source dimensions differ from the view (RN `Image.resizeMethod`).
   * `'resize'` downsamples a large image *before* decode (lower peak memory — use this for
   * full-resolution network photos); `'scale'` decodes at full size and only makes sense for
   * images already smaller than the view; `'auto'` (default) picks per image; `'none'` is passed
   * through unchanged.
   */
  resizeMethod?: 'auto' | 'resize' | 'scale' | 'none';
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
  maxWidth,
  maxHeight,
  resizeMethod = 'auto',
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
      resizeMethod={resizeMethod}
      onLoad={handleLoad}
      style={[
        style,
        maxWidth != null ? { maxWidth } : null,
        maxHeight != null ? { maxHeight } : null,
        { opacity },
      ]}
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
