/**
 * ═══════════════════════════════════════════════════════════════
 *  تمور القرشي | Quraishi Dates — خادم الموقع
 *  • تقديم الملفات الثابتة (الموقع + لوحة التحكم)
 *  • API لاستقبال الطلبات وحفظها في SQLite
 *  • إشعارات فورية (تيليجرام / واتساب / Discord / Webhook / بريد)
 *  • بث مباشر (SSE) للوحة التحكم
 *  الملف: server/server.js   — التشغيل: node server/server.js
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

const db = require('./db');
const { notifyAll } = require('./notify');
const { loadConfig } = require('./config');
const CATALOG = require('../js/catalog.js');

const ROOT = path.join(__dirname, '..');

const CONFIG = loadConfig();

/* ─────────── أدوات HTTP ─────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJSON(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function clientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

/**
 * دعم CORS: يسمح بنشر ملفات الموقع (مثلاً GitHub Pages) على نطاق منفصل
 * وإرسال الطلبات إلى خادم قاعدة البيانات.
 */
function corsHeaders(req) {
  const origin = req.headers.origin;
  const h = {
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (!origin) return h;
  h['Access-Control-Allow-Origin'] = origin;
  h['Vary'] = 'Origin';
  /* لا نسمح بإرسال الكوكيز إلا لنفس الأصل (لحماية لوحة التحكم) */
  const sameOrigin = origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
  if (sameOrigin) h['Access-Control-Allow-Credentials'] = 'true';
  return h;
}

/* ─────────── حماية بسيطة من الإفراط في الطلبات ─────────── */
const rate = new Map();
function allow(key, max, windowMs) {
  const now = Date.now();
  const rec = rate.get(key);
  if (!rec || now > rec.until) {
    rate.set(key, { count: 1, until: now + windowMs });
    return true;
  }
  rec.count++;
  if (rec.count > max) return false;
  return true;
}

/* ─────────── الجلسات ─────────── */
const COOKIE = 'qd_session';
function isAuthed(req) {
  const token = parseCookies(req)[COOKIE];
  return !!token && db.sessionExists(token);
}
function passwordOk(input) {
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(String(CONFIG.adminPassword)).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ─────────── بث مباشر SSE ─────────── */
const sseClients = new Set();
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (e) { sseClients.delete(res); }
  }
}

/* ─────────── الملفات الثابتة ─────────── */
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel.endsWith('/')) rel += 'index.html';

  const filePath = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  if (path.basename(filePath).startsWith('.')) { res.writeHead(403); return res.end('Forbidden'); }
  // منع الوصول لمجلد الخادم وقاعدة البيانات من المتصفح
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (relPath.startsWith('server/') || relPath.startsWith('data/') || relPath.startsWith('tools/')) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>404</h1><p>الملف غير موجود</p>'); }
    const ext = path.extname(filePath).toLowerCase();
    const etag = `W/"${st.size}-${Math.floor(st.mtimeMs)}"`;

    /* الملفات النصية تُعاد التحقق منها دائمًا حتى تظهر أي تعديلات فورًا */
    const isCode = ext === '.html' || ext === '.js' || ext === '.css' || ext === '.json';
    const cacheControl = isCode ? 'no-cache' : 'public, max-age=3600';

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl });
      return res.end();
    }

    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cacheControl,
      ETag: etag,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ─────────── إنشاء الطلب ─────────── */
function validateOrder(payload) {
  const shopName = String(payload.shopName || '').trim();
  if (!shopName) return { error: 'اسم المحل مطلوب' };
  if (shopName.length > 120) return { error: 'اسم المحل طويل جدًا' };

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (!rawItems.length) return { error: 'السلة فارغة' };
  if (rawItems.length > 200) return { error: 'عدد الأصناف كبير جدًا' };

  const items = [];
  for (const raw of rawItems) {
    const product = CATALOG.products.find((p) => p.id === raw.productId);
    if (!product) return { error: `صنف غير معروف: ${raw.productId}` };
    const qty = Number(raw.qty);
    if (!Number.isFinite(qty) || qty < 1 || qty > 9999) return { error: 'كمية غير صالحة' };
    items.push({
      productId: product.id, slug: product.slug, size: product.size,
      typeAr: product.typeAr, typeEn: product.typeEn, price: product.price, qty: Math.floor(qty),
    });
  }
  return { shopName, items, locale: payload.locale === 'en' ? 'en' : 'ar' };
}

/* ─────────── موجّه المسارات ─────────── */
async function handleApi(req, res, url) {
  const p = url.pathname;

  /* طلبات OPTIONS preconflight */
  if (req.method === 'OPTIONS') {
    const h = corsHeaders(req);
    res.writeHead(204, h);
    return res.end();
  }
  for (const [k, v] of Object.entries(corsHeaders(req))) res.setHeader(k, v);

  /* ── فحص الاتصال السريع (تستخدمه الواجهة قبل الإرسال) ── */
  if (p === '/api/ping' && req.method === 'GET') {
    return sendJSON(res, 200, { ok: true, service: 'quraishi-dates', time: new Date().toISOString() });
  }

  /* ── إنشاء طلب جديد ── */
  if (p === '/api/orders' && req.method === 'POST') {
    if (!allow('order:' + clientIP(req), 60, 60 * 1000)) {
      return sendJSON(res, 429, { error: 'محاولات كثيرة، حاول بعد قليل' });
    }
    let payload;
    try { payload = await readBody(req); }
    catch (e) { return sendJSON(res, 400, { error: 'طلب غير صالح' }); }

    const v = validateOrder(payload);
    if (v.error) return sendJSON(res, 400, { error: v.error });

    /* منع تكرار الطلب نفسه عند إعادة المحاولة */
    const requestId = String(payload.requestId || '').slice(0, 64) || null;
    if (requestId) {
      const existing = db.findByRequestId(requestId);
      if (existing) {
        console.log(`♻️  تكرار محتمل — إعادة إرسال الطلب ${existing.order_no}`);
        return sendJSON(res, 200, { ok: true, orderNo: existing.order_no, id: existing.id, duplicate: true });
      }
    }

    let order;
    try {
      order = db.createOrder({ shopName: v.shopName, locale: v.locale, items: v.items, requestId });
    } catch (e) {
      console.error('❌ خطأ في حفظ الطلب:', e);
      return sendJSON(res, 500, { error: 'تعذّر حفظ الطلب، حاول مرة أخرى' });
    }

    console.log(`\n📥 طلب جديد ${order.order_no} — ${order.shop_name}`);
    for (const it of order.items) console.log(`   • ${it.type_ar} ${it.size} ريال — الكمية: ${it.qty}`);

    notifyAll(CONFIG, order).then((r) => broadcast('notify', { orderNo: order.order_no, results: r }));
    broadcast('order', order);

    return sendJSON(res, 201, { ok: true, orderNo: order.order_no, id: order.id });
  }

  /* ── تسجيل الدخول ── */
  if (p === '/api/login' && req.method === 'POST') {
    if (!allow('login:' + clientIP(req), 8, 10 * 60 * 1000)) {
      return sendJSON(res, 429, { error: 'محاولات دخول كثيرة. حاول بعد 10 دقائق.' });
    }
    let payload;
    try { payload = await readBody(req); } catch (e) { return sendJSON(res, 400, { error: 'طلب غير صالح' }); }
    if (!passwordOk(payload.password || '')) {
      return sendJSON(res, 401, { error: 'كلمة المرور غير صحيحة' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    db.createSession(token);
    res.setHeader('Set-Cookie',
      `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 12}`);
    return sendJSON(res, 200, { ok: true });
  }

  if (p === '/api/logout' && req.method === 'POST') {
    const token = parseCookies(req)[COOKIE];
    if (token) db.deleteSession(token);
    res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
    return sendJSON(res, 200, { ok: true });
  }

  if (p === '/api/session' && req.method === 'GET') {
    return sendJSON(res, 200, { authenticated: isAuthed(req) });
  }

  /* ── بيانات لوحة التحكم (محمية) ── */
  if (p.startsWith('/api/admin/')) {
    if (!isAuthed(req)) return sendJSON(res, 401, { error: 'غير مصرّح' });

    if (p === '/api/admin/orders' && req.method === 'GET') {
      const orders = db.listOrders({
        status: url.searchParams.get('status') || 'all',
        q: (url.searchParams.get('q') || '').trim(),
      });
      return sendJSON(res, 200, { orders, stats: db.stats() });
    }

    const m = p.match(/^\/api\/admin\/orders\/(\d+)$/);
    if (m) {
      const id = Number(m[1]);
      if (req.method === 'GET') {
        const o = db.getOrder(id);
        return o ? sendJSON(res, 200, { order: o }) : sendJSON(res, 404, { error: 'غير موجود' });
      }
      if (req.method === 'PATCH') {
        let payload; try { payload = await readBody(req); } catch (e) { return sendJSON(res, 400, { error: 'طلب غير صالح' }); }
        const allowed = ['new', 'reviewed', 'prepared', 'delivered', 'cancelled'];
        if (!allowed.includes(payload.status)) return sendJSON(res, 400, { error: 'حالة غير صالحة' });
        const o = db.updateStatus(id, payload.status, payload.note);
        if (!o) return sendJSON(res, 404, { error: 'غير موجود' });
        broadcast('order', o);
        return sendJSON(res, 200, { order: o });
      }
      if (req.method === 'DELETE') {
        const ok = db.deleteOrder(id);
        broadcast('deleted', { id });
        return sendJSON(res, ok ? 200 : 404, { ok });
      }
    }

    if (p === '/api/admin/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 5000\n\n');
      res.write('event: hello\ndata: {"ok":true}\n\n');
      sseClients.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);
      req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
      return;
    }

    return sendJSON(res, 404, { error: 'مسار غير معروف' });
  }

  if (p === '/api/health' && req.method === 'GET') {
    return sendJSON(res, 200, { ok: true, db: db.DB_FILE, stats: db.stats() });
  }

  return sendJSON(res, 404, { error: 'API غير موجود' });
}

/* ─────────── الخادم ─────────── */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url.pathname);
  } catch (e) {
    console.error('❌ خطأ في الخادم:', e);
    if (!res.headersSent) sendJSON(res, 500, { error: 'خطأ داخلي في الخادم' });
    else res.end();
  }
});

function lanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) return n.address;
    }
  }
  return 'localhost';
}

db.init();
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ❌ المنفذ ${CONFIG.port} مشغول بالفعل.`);
    console.error('     • إن كان الخادم يعمل، فهو جاهز — افتح http://localhost:' + CONFIG.port);
    console.error('     • أو غيّر "port" في server/config.json ثم أعد التشغيل.');
  } else {
    console.error('\n  ❌ خطأ في تشغيل الخادم:', e.message);
  }
  process.exit(1);
});
server.listen(CONFIG.port, CONFIG.host, () => {
  const ip = lanIP();
  console.log('');
  console.log('  🌴  تمور القرشي | Quraishi Dates');
  console.log('  ─────────────────────────────────────────');
  console.log(`  ▸ الموقع       : http://localhost:${CONFIG.port}`);
  console.log(`  ▸ لوحة التحكم  : http://localhost:${CONFIG.port}/admin/`);
  console.log(`  ▸ من الجوال     : http://${ip}:${CONFIG.port}`);
  console.log(`  ▸ قاعدة البيانات: ${db.DB_FILE}`);
  console.log(`  ▸ كلمة المرور  : ${CONFIG.adminPassword}`);
  console.log('  ─────────────────────────────────────────');
  console.log('  للتلقي الفوري: عدّل server/config.json (تيليجرام / واتساب / Discord)');
  console.log('');
});
