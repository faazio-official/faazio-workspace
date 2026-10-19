const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Bare-RN Metro config. Keeps the @data SDUI alias, the NTFS serialization fix,
 * the SVG transformer and the Gradle-artifact blocklist.
 */
const config = {
  watchFolders: [path.resolve(__dirname, '../../data')],

  // NTFS3 mounts deadlock when multiple workers readdir concurrently, so the
  // file-map crawl must be serial on this filesystem (see docs/RUNBOOKS/TROUBLESHOOTING.md).
  maxWorkers: 1,

  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },

  resolver: {
    assetExts: defaultConfig.resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
    // The @data source tree lives outside the project root; resolve its bare
    // imports (and app imports) from client/mobile/node_modules.
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // Skip Gradle build artifacts inside node_modules/* — never imported, huge trees.
    blockList: [
      ...(Array.isArray(defaultConfig.resolver.blockList)
        ? defaultConfig.resolver.blockList
        : []),
      /[/\\]node_modules[/\\].*[/\\]android[/\\]build[/\\]/,
    ],
    extraNodeModules: {
      '@': path.resolve(__dirname, 'src'),
      '@data': path.resolve(__dirname, '../../data'),
    },
  },
};

const merged = mergeConfig(defaultConfig, config);

// Defer module evaluation (inlineRequires) so cold start parses less JS.
// The two store modules are block-listed because they seed from @data at
// module load (side effects) — inlining them could break cart/favorites seeding.
merged.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: {
      blockList: {
        [require.resolve('./src/state/cartStore.ts')]: true,
        [require.resolve('./src/state/favoriteStore.ts')]: true,
      },
    },
  },
});

module.exports = merged;
