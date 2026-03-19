const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-vlc-media-player',
  'VLCPlayer.js',
);

const oldSnippet = `    const source = resolveAssetSource(this.props.source) || {};
`;

const newSnippet = `    const resolvedSource = resolveAssetSource(this.props.source) || {};
    const source = {
      ...resolvedSource,
      initOptions: Array.isArray(resolvedSource.initOptions)
        ? [...resolvedSource.initOptions]
        : [],
    };
`;

const oldInitOptionsLine = `    source.initOptions = source.initOptions || [];
`;

try {
  if (!fs.existsSync(filePath)) {
    console.warn('[patch-vlc-player] VLCPlayer.js not found, skipping');
    process.exit(0);
  }

  const current = fs.readFileSync(filePath, 'utf8');

  if (current.includes('const resolvedSource = resolveAssetSource(this.props.source) || {};')) {
    console.log('[patch-vlc-player] VLC player already patched');
    process.exit(0);
  }

  if (!current.includes(oldSnippet) || !current.includes(oldInitOptionsLine)) {
    console.warn('[patch-vlc-player] Expected VLC source block not found, skipping');
    process.exit(0);
  }

  const patched = current
    .replace(oldSnippet, newSnippet)
    .replace(oldInitOptionsLine, '');

  fs.writeFileSync(filePath, patched, 'utf8');
  console.log('[patch-vlc-player] Patched VLC player immutable source fix');
} catch (error) {
  console.error('[patch-vlc-player] Failed:', error);
  process.exit(1);
}
