const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

const root = path.resolve(__dirname);
const port = process.env.PORT ? Number(process.env.PORT) : 8080;
let sseClients = [];
let building = false;
let pendingBuild = false;
let debounceTimer = null;
let lastChangeAt = 0;
const DEBOUNCE_MS = process.env.DEBOUNCE_MS ? Number(process.env.DEBOUNCE_MS) : 3000;

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

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/octet-stream',
  '.php': 'text/plain; charset=utf-8',
};

function send(res, status, headers, content) {
  res.writeHead(status, headers);
  res.end(content);
}

function safeResolve(p) {
  const resolved = path.resolve(root, p);
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname === '/') {
    pathname = '/index.html';
  }

  if (pathname === '/__dev_events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');
    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(r => r !== res);
    });
    return;
  }

  const filePath = safeResolve(pathname.slice(1));
  if (!filePath) {
    return send(res, 403, { 'Content-Type': 'text/plain' }, 'Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err) {
      return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
    }
    if (stat.isDirectory()) {
      const indexFile = path.join(filePath, 'index.html');
      fs.readFile(indexFile, (err2, data2) => {
        if (err2) return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
        return send(res, 200, { 'Content-Type': mime['.html'] || 'text/html' }, data2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err3, data3) => {
      if (err3) return send(res, 500, { 'Content-Type': 'text/plain' }, 'Internal Server Error');
      if (ext === '.html') {
        let html = data3.toString('utf-8');
        const inject = "<script>try{var es=new EventSource('/__dev_events');es.onmessage=function(e){if(e.data==='reload'){location.reload()}}}catch(e){}</script>";
        const idx = html.lastIndexOf('</body>');
        if (idx !== -1) html = html.slice(0, idx) + inject + html.slice(idx);
        else html += inject;
        return send(res, 200, {
          'Content-Type': type,
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        }, html);
      }
      send(res, 200, {
        'Content-Type': type,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      }, data3);
    });
  });
});

server.listen(port, () => {
  // 输出预览地址，便于 IDE 捕获
  console.log(`Server running at http://localhost:${port}/`);
});

function broadcastReload() {
  const msg = 'data: reload\n\n';
  for (const r of sseClients) {
    try { r.write(msg); } catch {}
  }
}

function runBuild() {
  if (building) { pendingBuild = true; return; }
  building = true;
  const clean = spawn(process.execPath, [path.join(__dirname, 'clean-bundles.js')], { stdio: 'inherit' });
  clean.on('exit', () => {
    const child = spawn(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });
    child.on('exit', (code) => {
      building = false;
      if (code === 0) broadcastReload();
      if (pendingBuild) {
        pendingBuild = false;
        const elapsed = Date.now() - lastChangeAt;
        const wait = Math.max(0, DEBOUNCE_MS - elapsed);
        console.log(`编译完成，检测到期间有更新，${Math.ceil(wait/1000)}s后再次编译`);
        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
        debounceTimer = setTimeout(() => { debounceTimer = null; runBuild(); }, wait);
      }
    });
  });
}

function scheduleBuild() {
  lastChangeAt = Date.now();
  if (building) {
    pendingBuild = true;
    console.log('检测到变更，当前正在编译，将在编译结束后按延时策略继续');
    return;
  }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
  console.log(`检测到变更，${Math.ceil(DEBOUNCE_MS/1000)}s内无其它更新则编译`);
  debounceTimer = setTimeout(() => { debounceTimer = null; console.log('静默期结束，开始编译'); runBuild(); }, DEBOUNCE_MS);
}

function shouldTrigger(file) {
  const ext = path.extname(file).toLowerCase();
  return ext === '.html' || ext === '.php' || ext === '.js' || ext === '.css';
}

try {
  const devDir = path.join(__dirname, 'dev');
  if (fs.existsSync(devDir)) {
    runBuild();
    fs.watch(devDir, { recursive: true }, (event, filename) => {
      if (!filename) return;
      const full = path.join(devDir, filename);
      if (shouldTrigger(full)) scheduleBuild();
    });
  }
} catch {}
