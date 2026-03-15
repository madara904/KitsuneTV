const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const defaultConfig = getDefaultConfig(__dirname);
// Exclude native build dirs so Metro's watcher doesn't hit ENOENT on .cxx/build (react-native-quick-sqlite etc.)
const existingBlockList = defaultConfig.resolver.blockList;
const nativeBuildDirs = /[\/\\]\.cxx[\/\\]|[\/\\]android[\/\\]build[\/\\]|[\/\\]ios[\/\\]build[\/\\]/;
const blockList = existingBlockList instanceof RegExp
  ? new RegExp(`(${existingBlockList.source})|(${nativeBuildDirs.source})`)
  : [existingBlockList, nativeBuildDirs];

const config = mergeConfig(defaultConfig, {
  resolver: { blockList },
});

module.exports = withNativeWind(config, { input: './global.css' });
