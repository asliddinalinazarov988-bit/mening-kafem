// cPanel hosting (Node.js, Phusion Passenger) uchun server. Faqat Node'ning o'z modullari.
//  - statik fayllar: / -> index.html, privacy.html va boshqalar;
//  - /.netlify/functions/<nom> -> netlify/functions/<nom>.js dagi exports.handler (Netlify formatida).
// Netlify'da bu fayl ishlatilmaydi — u yerda funksiyalar avvalgidek ishlaydi.
// Port: process.env.PORT (Passenger beradi), bo'lmasa 3000.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const FUNCTIONS = new Set(['order', 'telegram', 'telegram-setup']);
const MAX_BODY = 1024 * 1024; // 1 MB

// Hech qachon berilmaydigan papka va fayllar.
const HIDDEN_DIRS = new Set(['netlify', 'supabase', 'node_modules', 'tmp']);
const HIDDEN_FILES = new Set(['server.js', 'package.json', 'package-lock.json', 'netlify.toml']);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
};

function send(res, statusCode, body, headers) {
  res.writeHead(statusCode, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, headers));
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function runFunction(name, req, res, url) {
  // Node sarlavhalarni allaqachon kichik harfda beradi; x-forwarded-for ham shu yerda qoladi.
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    send(res, err.status || 400, 'Bad request');
    return;
  }

  const queryStringParameters = {};
  for (const [k, v] of url.searchParams) queryStringParameters[k] = v;

  // Passenger ortida protokol sarlavhada kelmasa, https deb olinadi (hosting SSL bilan ishlaydi).
  const proto = (headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = headers['x-forwarded-host'] || headers.host || 'localhost';

  const event = {
    httpMethod: req.method,
    headers,
    body,
    isBase64Encoded: false,
    queryStringParameters,
    path: url.pathname,
    rawUrl: `${proto}://${host}${url.pathname}${url.search}`,
  };

  let result;
  try {
    const mod = require(path.join(ROOT, 'netlify', 'functions', `${name}.js`));
    result = await mod.handler(event, {});
  } catch (err) {
    console.error(`[${name}]`, err);
    send(res, 500, 'Internal Server Error');
    return;
  }

  result = result || {};
  const outHeaders = Object.assign({}, result.headers);
  let out = result.body == null ? '' : String(result.body);
  if (result.isBase64Encoded) out = Buffer.from(out, 'base64');
  res.writeHead(result.statusCode || 200, outHeaders);
  res.end(req.method === 'HEAD' ? undefined : out);
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, 'Bad request');
    return;
  }
  if (rel.includes('\0')) {
    send(res, 400, 'Bad request');
    return;
  }
  if (rel.endsWith('/')) rel += 'index.html';

  const file = path.resolve(ROOT, '.' + rel);
  const parts = path.relative(ROOT, file).split(path.sep);
  const hidden =
    (file !== ROOT && !file.startsWith(ROOT + path.sep)) ||
    parts.some((p) => p.startsWith('.') && p !== '.well-known') ||
    HIDDEN_DIRS.has(parts[0]) ||
    (parts.length === 1 && HIDDEN_FILES.has(parts[0]));
  if (hidden) {
    send(res, 404, 'Not Found');
    return;
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      send(res, 404, 'Not Found');
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  const m = url.pathname.match(/^\/\.netlify\/functions\/([^/]+)\/?$/);
  if (m) {
    if (!FUNCTIONS.has(m[1])) {
      send(res, 404, 'Not Found');
      return;
    }
    runFunction(m[1], req, res, url).catch((err) => {
      console.error(err);
      if (!res.headersSent) send(res, 500, 'Internal Server Error');
      else res.end();
    });
    return;
  }
  if (url.pathname.startsWith('/.netlify/')) {
    send(res, 404, 'Not Found');
    return;
  }

  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishlayapti`);
});
