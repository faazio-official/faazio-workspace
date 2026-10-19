module.exports = function (api) {
  api.cache(true);
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      // Strip console.* from release builds (JS-thread bottleneck in prod).
      // Kept before the reanimated plugin, which must remain last.
      ...(isDev ? [] : ['transform-remove-console']),
      [
        'module-resolver',
        {
          alias: { '@': './src', '@data': '../../data' },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
