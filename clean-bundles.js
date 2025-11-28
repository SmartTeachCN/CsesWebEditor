const fs = require('fs');
const path = require('path');
const glob = require('glob');

function ts() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
const _log = console.log.bind(console);
const _warn = console.warn.bind(console);
const _error = console.error.bind(console);
console.log = (...args) => _log(`[${ts()}]`, ...args);
console.warn = (...args) => _warn(`[${ts()}]`, ...args);
console.error = (...args) => _error(`[${ts()}]`, ...args);

const ROOT = __dirname;
const patterns = [
  // 根目录 bundle
  'bundle-*.min.js',
  'bundle-*.min.js.map',
  'bundle-*.min.css',
  'bundle-*.min.css.map',
  // pages 下的 bundle
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
