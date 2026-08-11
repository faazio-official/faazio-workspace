const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.watchFolders = [path.resolve(__dirname, '../../data')];

config.resolver.extraNodeModules = {
  '@data': path.resolve(__dirname, '../../data'),
};

// Support importing .svg files as React components (react-native-svg-transformer).
const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
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
