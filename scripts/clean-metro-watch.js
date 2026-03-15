/**
 * Remove native build dirs that cause Metro's watcher to throw ENOENT
 * when they are missing (e.g. react-native-quick-sqlite android/.cxx).
 */
const fs = require('fs');
const path = require('path');

const dirs = [
  path.join(__dirname, '..', 'node_modules', 'react-native-quick-sqlite', 'android', '.cxx'),
];

for (const dir of dirs) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
      console.log('Removed', dir);
    }
  } catch (_) {}
}
