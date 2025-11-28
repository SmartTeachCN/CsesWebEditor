/*
 Build script: merge & minify HTML's JS/CSS
 - Dev source: ./dev/**
 - Output: same relative path in root (./)
 - JS: merge external + inline (skip vendor: assets/ or *.min.js), Terser minify, sourcemap
 - CSS: merge external + inline (skip vendor: assets/ or *.min.css), CleanCSS minify + rebase URLs to output dir, sourcemap
 - HTML: minify (without inlining JS/CSS)
 - Timestamp: Date.now()
 - No backups retained
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const glob = require('glob');
const cheerio = require('cheerio');
const terser = require('terser');
const CleanCSS = require('clean-css');
const htmlMinifier = require('html-minifier-terser');

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

const DEV_ROOT = path.join(__dirname, 'dev');
const OUT_ROOT = path.join(__dirname);

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function stripQueryHash(u) {
  if (!u) return u;
  const q = u.indexOf('?');
  const h = u.indexOf('#');
  let end = u.length;
  if (q !== -1) end = Math.min(end, q);
  if (h !== -1) end = Math.min(end, h);
  return u.slice(0, end);
}
function isExternalUrl(u) {
  return /^(https?:)?\/\//i.test(u);
}
function isVendorJS(src) {
  const p = stripQueryHash(src || '');
  const norm = p.replace(/\\/g, '/');
  return isExternalUrl(norm) || /(^|\/)assets\//.test(norm) || norm.endsWith('.min.js');
}
function isVendorCSS(href) {
  const p = stripQueryHash(href || '');
  const norm = p.replace(/\\/g, '/');
  return isExternalUrl(norm) || /(^|\/)assets\//.test(norm) || norm.endsWith('.min.css');
}
function relToHtmlAbs(htmlRelPath, resourcePath) {
  const htmlAbsDir = path.dirname(path.join(DEV_ROOT, htmlRelPath));
  const clean = stripQueryHash(resourcePath);
  const try1 = path.resolve(htmlAbsDir, clean);
  if (fs.existsSync(try1)) return try1;
  const try2 = path.resolve(DEV_ROOT, clean);
  return try2;
}
function randName(prefix, ext) {
  const hex = crypto.randomBytes(6).toString('hex');
  return `${prefix}-${hex}.min.${ext}`;
}
function publicBundleUrl(relHtmlPath, fileName) {
  const dirPosix = require('path').posix.dirname(relHtmlPath.replace(/\\/g, '/'));
  const base = path.basename(fileName);
  return '/' + (dirPosix === '.' ? '' : dirPosix + '/') + base;
}

async function processHtml(relHtmlPath) {
  const absHtmlPath = path.join(DEV_ROOT, relHtmlPath);
  const outHtmlPath = path.join(OUT_ROOT, relHtmlPath);
  ensureDir(path.dirname(outHtmlPath));

  const html = fs.readFileSync(absHtmlPath, 'utf-8');
  const ext = path.extname(relHtmlPath).toLowerCase();
  if (ext === '.php') {
    const minHtml = await htmlMinifier.minify(html, {
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      minifyCSS: false,
      minifyJS: false,
      keepClosingSlash: true,
      ignoreCustomFragments: [/<\?[\s\S]*?\?>/],
    });
    fs.writeFileSync(outHtmlPath, minHtml, 'utf-8');
    return;
  }
  const $ = cheerio.load(html, { decodeEntities: false });

  // Rewrite vendor asset paths to site-root absolute to avoid relative path issues
  $('link[rel="stylesheet"]').each((i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const clean = stripQueryHash(href);
    const norm = clean.replace(/\\/g, '/');
    if (isVendorCSS(href) && /(^|\/)assets\//.test(norm)) {
      const rest = norm.replace(/^.*assets\//, '');
      const qh = href.slice(clean.length);
      $(el).attr('href', '/assets/' + rest + qh);
    }
  });
  $('script[src]').each((i, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    const clean = stripQueryHash(src);
    const norm = clean.replace(/\\/g, '/');
    if (isVendorJS(src) && /(^|\/)assets\//.test(norm)) {
      const rest = norm.replace(/^.*assets\//, '');
      const qh = src.slice(clean.length);
      $(el).attr('src', '/assets/' + rest + qh);
    }
  });

  const includedScriptNodes = [];
  let needDefer = false;
  $('script').each((i, el) => {
    const type = (($(el).attr('type')) || '').toLowerCase();
    const isJs = !type || type === 'text/javascript' || type === 'application/javascript';
    if (!isJs) return;
    const src = $(el).attr('src');
    if (src) {
      if (!isVendorJS(src)) {
        includedScriptNodes.push(el);
        if ($(el).attr('defer') != null) needDefer = true;
      }
    } else {
      const code = $(el).html() || '';
      if (/<\?php|<\?=|<\?/.test(code)) return;
      includedScriptNodes.push(el);
      if ($(el).attr('defer') != null) needDefer = true;
    }
  });

  const includedCssLinkNodes = [];
  $('link[rel="stylesheet"]').each((i, el) => {
    const href = $(el).attr('href');
    if (href && !isVendorCSS(href)) includedCssLinkNodes.push(el);
  });
  const includedStyleNodes = [];
  $('style').each((i, el) => {
    // inline style
    includedStyleNodes.push(el);
  });

  // JS merge & minify
  if (includedScriptNodes.length > 0) {
    const jsParts = [];
    for (const node of includedScriptNodes) {
      const src = $(node).attr('src');
      if (src && !isVendorJS(src)) {
        const abs = relToHtmlAbs(relHtmlPath, src);
        if (fs.existsSync(abs)) {
          const code = fs.readFileSync(abs, 'utf-8');
          jsParts.push(`\n/* ${src} */\n` + code);
        }
      } else {
        const code = $(node).html() || '';
        if (code.trim()) jsParts.push(`\n/* inline */\n` + code);
      }
    }
    if (jsParts.length > 0) {
      const concat = jsParts.join('\n;\n');
      const outDir = path.dirname(outHtmlPath);
      ensureDir(outDir);
      const jsName = randName('bundle', 'js');
      const ts = Date.now();
      const minified = await terser.minify(concat, {
        sourceMap: { filename: jsName, url: `${jsName}.map` },
        ecma: 2019,
        compress: { passes: 2 },
        mangle: true,
      });
      fs.writeFileSync(path.join(outDir, jsName), minified.code, 'utf-8');
      if (minified.map) fs.writeFileSync(path.join(outDir, `${jsName}.map`), minified.map, 'utf-8');

      // replace first included node and remove the rest
      const first = includedScriptNodes[0];
      const deferAttr = needDefer ? ' defer' : '';
      const jsUrl = publicBundleUrl(relHtmlPath, jsName);
      $(first).replaceWith(`<script src="${jsUrl}?time=${ts}"${deferAttr}></script>`);
      for (let i = 1; i < includedScriptNodes.length; i++) $(includedScriptNodes[i]).remove();
    }
  }

  // CSS merge & minify
  if (includedCssLinkNodes.length > 0 || includedStyleNodes.length > 0) {
    const outDir = path.dirname(outHtmlPath);
    ensureDir(outDir);
    const cssName = randName('bundle', 'css');
    const ts = Date.now();

    // external CSS with rebase
    const externalCssPaths = [];
    for (const node of includedCssLinkNodes) {
      const href = $(node).attr('href');
      if (href && !isVendorCSS(href)) {
        const abs = relToHtmlAbs(relHtmlPath, href);
        if (fs.existsSync(abs)) externalCssPaths.push(abs);
      }
    }
    let cssCombined = '';
    let sourceMapWritten = false;
    if (externalCssPaths.length > 0) {
      const cleaner = new CleanCSS({ rebase: true, rebaseTo: outDir, sourceMap: true });
      const out = cleaner.minify(externalCssPaths);
      cssCombined += out.styles || '';
      if (out.sourceMap) {
        fs.writeFileSync(path.join(outDir, `${cssName}.map`), out.sourceMap.toString(), 'utf-8');
        sourceMapWritten = true;
      }
    }
    // append inline styles then final minify without rebase
    for (const node of includedStyleNodes) {
      const css = $(node).html() || '';
      if (css.trim()) cssCombined += `\n/* inline */\n` + css;
    }
    if (cssCombined) {
      const out2 = new CleanCSS({ rebase: false }).minify(cssCombined);
      cssCombined = out2.styles || cssCombined;
      if (sourceMapWritten && !/sourceMappingURL/.test(cssCombined)) {
        cssCombined += `\n/*# sourceMappingURL=${cssName}.map */`;
      }
      fs.writeFileSync(path.join(outDir, cssName), cssCombined, 'utf-8');

      const cssUrl = publicBundleUrl(relHtmlPath, cssName);
      if (includedCssLinkNodes.length > 0) {
        const first = includedCssLinkNodes[0];
        $(first).replaceWith(`<link rel="stylesheet" href="${cssUrl}?time=${ts}">`);
        for (let i = 1; i < includedCssLinkNodes.length; i++) $(includedCssLinkNodes[i]).remove();
      } else {
        // only inline styles originally; add link to head and remove inline style nodes
        $('head').append(`<link rel="stylesheet" href="${cssUrl}?time=${ts}">`);
        includedStyleNodes.forEach(n => $(n).remove());
      }
    }
  }

  // HTML minify
  const minHtml = await htmlMinifier.minify($.html(), {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    minifyCSS: false,
    minifyJS: false,
    keepClosingSlash: true,
    ignoreCustomFragments: [/<\?[\s\S]*?\?>/],
  });
  fs.writeFileSync(outHtmlPath, minHtml, 'utf-8');
}

async function main() {
  if (!fs.existsSync(DEV_ROOT)) {
    console.error('dev 目录不存在，请将开发文件移动到 ./dev');
    process.exit(1);
  }
  const files = glob.sync('**/*.{html,php}', { cwd: DEV_ROOT, nodir: true });
  const esFiltered = files.filter(f => !f.startsWith('es/'));
  console.log(`Found ${esFiltered.length} HTML files in dev`);
  for (const rel of esFiltered) {
    console.log('Building', rel);
    await processHtml(rel);
  }
  console.log('Build completed.');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
