import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * "Fa"-first brand reveal for the cold-start splash (layer 2, JS only).
 *
 * Layer 1 (native) shows the square "Fa" mark centred on screen. Layer 2 must
 * start in exactly that state — the same "Fa" at the same size and position —
 * then move the "Fa" left into its place in the wordmark while "azio" is
 * revealed to its right:
 *
 *   0-420ms   "Fa" holds centred (matching the native handoff).
 *   420-1500ms "Fa" slides left to its wordmark position and "azio" fades in
 *              behind/to the right of it, forming "Faazio" centred at rest.
 *
 * The wordmark is drawn from the brand SVG glyph paths (not the flat raster) so
 * it can be split into the leading "Fa" (F + first "a") and the trailing "azio"
 * (a, z, i, o) and each group animated independently. The offset that centres
 * "Fa" is derived from the glyph geometry (the "Fa" ink centre sits left of the
 * 2171-unit box centre), scaled to the rendered box width. The a/o counters are
 * punched with `fillRule="evenodd"` so no background colour is baked into the mark.
 */
const VIEW_W = 2171;
const VIEW_H = 724;
const INK = '#FDFDFD';

/** Horizontal extent of the leading "Fa" ink inside the 2171-unit viewBox. */
const FA_LEFT = 23.24;
const FA_RIGHT = 766.0;
const FA_CENTER_X = (FA_LEFT + FA_RIGHT) / 2;

const F_PATH =
  'M206.588 70.3949C235.39 68.0797 282.149 69.6642 312.26 69.6634L509.593 69.6597C509.156 81.0066 508.324 91.6633 506.397 102.882C493.113 184.476 430.493 249.205 349.384 265.184C329.951 268.928 314.9 268.171 295.667 269.03C269.274 270.209 240.032 280.77 218.684 296.398C175.632 327.912 152.772 369.847 143.98 421.526C172.217 410.395 196.451 412.946 226.088 412.947L319.858 413.071C319.074 423.209 318.221 429.652 315.554 439.392C306.907 472.987 274.351 501.37 241.114 506.084C211.412 510.296 191.195 505.919 166.559 530.799C137.569 560.077 141.632 597.3 141.862 635.107L23.7365 635.202L23.4835 378.542L23.2422 305.602C23.1329 279.89 22.1135 255.817 27.1618 230.434C33.2818 198.888 47.0926 169.34 67.3692 144.411C103.203 100.026 150.444 76.4024 206.588 70.3949Z';
const A1_PATH = 'M558.06 269.373C578.995 268.013 609.933 268.896 631.681 268.898L765.848 268.932L765.935 461.708C765.977 481.905 767.963 534.107 765.037 551.215C762.426 566.377 755.84 580.576 745.949 592.361C724.374 618.505 696.557 628.75 663.916 631.887L663.951 594.63C649.246 606.406 640.571 612.002 623.965 620.564C607.242 627.245 597.223 630.536 579.02 632.359C533.567 637.092 488.12 623.349 452.907 594.222C416.716 564.533 393.941 521.572 389.68 474.956C384.757 425.528 399.825 376.185 431.522 337.941C463.933 298.67 507.249 274.199 558.06 269.373Z';
const A1_HOLE = 'M574.922 365.513C606.137 362.836 636.377 377.16 654.08 403.008C671.783 428.856 674.21 462.23 660.433 490.367C646.657 518.504 618.807 537.053 587.533 538.921C540.041 541.757 499.09 505.893 495.639 458.441C492.188 410.99 527.519 369.578 574.922 365.513Z';
const A2_PATH = 'M975.816 277.404C995.781 275.55 1031.99 276.605 1053.11 276.623L1186.97 276.799L1186.99 463.39C1187.04 482.887 1188.74 537.921 1185.81 554.315C1183.11 569.504 1176.27 583.656 1166.05 595.217C1145.38 618.906 1115.77 629.64 1085.1 631.644C1084.97 620.715 1085.02 609.784 1085.23 598.856C1073.43 607.927 1060.53 615.464 1046.83 621.288C1034.89 626.482 1020.37 629.774 1007.41 631.18C961.242 636.564 914.859 623.078 878.778 593.781C843.011 565.421 820.139 523.88 815.299 478.491C804.66 378.086 875.02 287.974 975.816 277.404Z';
const A2_HOLE = 'M992.361 373.183C1039.08 367.319 1081.66 400.588 1087.26 447.342C1092.87 494.097 1059.36 536.485 1012.58 541.829C966.157 547.132 924.172 513.946 918.612 467.557C913.051 421.169 946.004 379 992.361 373.183Z';
const Z_PATH = 'M1251.98 281.874L1527.25 281.838C1526.38 312.538 1515.45 361.81 1498.16 387.803C1464.4 438.55 1426.38 487.277 1391.92 537.698C1439.05 538.642 1488.7 537.863 1536.03 537.875L1536.16 599.685C1536.17 607.338 1536.58 624.872 1535.54 631.495C1439.69 632.752 1341.94 631.638 1245.89 631.851C1248.29 561.711 1272.4 534.546 1311.32 480.389L1382.12 381.838C1339.74 380.884 1294.56 381.598 1251.94 381.672C1252.54 349.086 1251.98 314.609 1251.98 281.874Z';
const I_PATH = 'M1652.95 281.419C1669.71 281.974 1681.02 285.854 1693.32 297.58C1712.75 316.113 1709.39 339.629 1709.34 364.126L1709.25 419.088L1709.08 631.549L1651.75 631.615L1596.94 631.618L1596.85 427.56L1596.86 368.368C1596.87 355.756 1596.34 343.273 1597.9 330.733C1601.59 301.13 1624.27 283.853 1652.95 281.419Z';
const I_DOT = 'M1645.19 120.379C1681.5 115.339 1714.97 140.825 1719.77 177.167C1724.57 213.509 1698.87 246.811 1662.49 251.371C1626.46 255.888 1593.53 230.472 1588.78 194.468C1584.02 158.464 1609.22 125.372 1645.19 120.379Z';
const O_PATH = 'M1931.6 279.024C2030.64 268.683 2119.18 340.898 2128.96 439.993C2138.75 539.088 2066.04 627.224 1966.89 636.451C1868.52 645.604 1781.24 573.593 1771.53 475.283C1761.83 376.973 1833.34 289.283 1931.6 279.024Z';
const O_HOLE = 'M1938.65 379.309C1983.48 372.733 2025.12 403.858 2031.5 448.719C2037.88 493.579 2006.57 535.077 1961.68 541.26C1917.07 547.404 1875.89 516.333 1869.55 471.749C1863.21 427.166 1894.1 385.844 1938.65 379.309Z';

interface SplashWordmarkRevealProps {
  /** Rendered wordmark box width in dp (from `SplashFallback`). */
  width: number;
  /** Rendered wordmark box height in dp (from `SplashFallback`). */
  height: number;
}

export const SplashWordmarkReveal = React.memo(function SplashWordmarkReveal({
  width,
}: SplashWordmarkRevealProps) {
  // One native-driven clock drives the reveal: "Fa" holds centred, then slides
  // left while "azio" fades in. A single Animated.Value keeps the timeline
  // continuous and hands the native driver one value to schedule, so the 60 fps
  // curve is immune to the JS-thread bus (busy hydrating stores on cold start).
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Advance on the next frame so the SVG layers are laid out and rasterized
    // before the clock starts; starting synchronously on mount stalls the first
    // few frames.
    const frame = requestAnimationFrame(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: 1500,
        // Material standard ease: gentle in, confident middle, soft settle.
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: true,
      }).start();
    });
    return () => cancelAnimationFrame(frame);
  }, [progress]);

  // Offset (dp) that moves the box right so the leading "Fa" ink centre lands on
  // the box/screen centre — the state shown by the native layer-1 mark.
  const faCenterOffset = ((VIEW_W / 2 - FA_CENTER_X) / VIEW_W) * width;

  // Hold "Fa" centred for the first ~28% of the eased clock, then slide the
  // whole wordmark left to its resting (centred) position.
  const slideX = progress.interpolate({
    inputRange: [0, 0.28, 0.9, 1],
    outputRange: [faCenterOffset, faCenterOffset, 0, 0],
  });
  // "azio" stays hidden behind the held "Fa" and fades in as it slides in.
  const azioOpacity = progress.interpolate({
    inputRange: [0, 0.34, 0.8, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[styles.layer, { opacity: azioOpacity, transform: [{ translateX: slideX }] }]}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Path d={`${A2_PATH} ${A2_HOLE}`} fill={INK} fillRule="evenodd" />
          <Path d={Z_PATH} fill={INK} />
          <Path d={I_PATH} fill={INK} />
          <Path d={I_DOT} fill={INK} />
          <Path d={`${O_PATH} ${O_HOLE}`} fill={INK} fillRule="evenodd" />
        </Svg>
      </Animated.View>

      <Animated.View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[styles.layer, { transform: [{ translateX: slideX }] }]}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Path d={F_PATH} fill={INK} />
          <Path d={`${A1_PATH} ${A1_HOLE}`} fill={INK} fillRule="evenodd" />
        </Svg>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
