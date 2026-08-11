module.exports = function (api) {
  api.cache(true);
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Strip console.* from release builds (JS-thread bottleneck in prod).
      // Kept before the reanimated plugin, which must remain last.
      ...(isDev ? [] : ['transform-remove-console']),
      'react-native-reanimated/plugin',
    ],
  };
};
