const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const root = path.resolve(__dirname);
const port = process.env.PORT ? Number(process.env.PORT) : 8080;

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
    pathname = '/pages/dev-preview.html';
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