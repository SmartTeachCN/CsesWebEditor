const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = __dirname;
const patterns = [
  'pages/**/bundle-*.min.js',
  'pages/**/bundle-*.min.js.map',
  'pages/**/bundle-*.min.css',
  'pages/**/bundle-*.min.css.map'
];

let removed = 0;
for (const pattern of patterns) {
  const files = glob.sync(pattern, { cwd: ROOT, nodir: true });
  for (const f of files) {
    const abs = path.join(ROOT, f);
    try {
      fs.unlinkSync(abs);
      removed++;
      console.log('Deleted', f);
    } catch (e) {
      console.warn('Failed to delete', f, e.message);
    }
  }
}
console.log(`Cleanup done. Removed ${removed} bundle files.`);