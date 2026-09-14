const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.watchFolders = [path.resolve(__dirname, '../../data')];

// NTFS3 mounts deadlock when multiple workers readdir concurrently, so the
// file-map crawl must be serial on this filesystem (see docs/RUNBOOKS/TROUBLESHOOTING.md).
config.maxWorkers = 1;

// Support importing .svg files as React components (react-native-svg-transformer).
const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

// Skip Gradle build artifacts inside node_modules/* — never imported, huge trees.
const gradleArtifactBlockList = /[/\\]node_modules[/\\].*[/\\]android[/\\]build[/\\]/;
const defaultBlockList = Array.isArray(resolver.blockList)
  ? resolver.blockList
  : resolver.blockList
    ? [resolver.blockList]
    : [];

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  blockList: [...defaultBlockList, gradleArtifactBlockList],
};

config.resolver.extraNodeModules = {
  '@data': path.resolve(__dirname, '../../data'),
};

// Defer module evaluation (inlineRequires) so cold start parses less JS.
// The two store modules are block-listed because they seed from @data at
// module load (side effects) — inlining them could break cart/favorites seeding.
config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: {
      blockList: {
        [require.resolve('./src/state/cartStore.ts')]: true,
        [require.resolve('./src/state/favoriteStore.ts')]: true,
      },
    },
  },
});

module.exports = config;
