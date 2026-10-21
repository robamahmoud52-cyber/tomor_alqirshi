/**
 * طبقة قاعدة البيانات — SQLite مدمجة في Node (node:sqlite) بدون أي مكتبات خارجية.
 * الملف: server/db.js
 */
'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATABASE_DIR
  ? path.resolve(process.env.DATABASE_DIR)
  : path.join(__dirname, '..', 'data');
const DB_FILE = process.env.DATABASE_FILE
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(DATA_DIR, 'orders.db');

let db;

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no    TEXT    NOT NULL UNIQUE,
      shop_name   TEXT    NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'new',
      locale      TEXT    NOT NULL DEFAULT 'ar',
      created_at  TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL,
      request_id  TEXT,
      note        TEXT    DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id  TEXT    NOT NULL,
      slug        TEXT    NOT NULL,
      size        INTEGER NOT NULL,
      type_ar     TEXT    NOT NULL,
      type_en     TEXT    NOT NULL,
      price       REAL    NOT NULL,
      qty         INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_items_order    ON order_items(order_id);
  `);

  /* ترقية القاعدة القديمة بإضافة عمود منع التكرار */
  const cols = db.prepare(`PRAGMA table_info(orders)`).all().map((c) => c.name);
  if (!cols.includes('request_id')) {
    db.exec(`ALTER TABLE orders ADD COLUMN request_id TEXT`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_request
           ON orders(request_id) WHERE request_id IS NOT NULL`);

  return db;
}

function nowISO() {
  return new Date().toISOString();
}

/** توليد رقم طلب مميز: QD-YYYYMMDD-0001 */
function nextOrderNo() {
  const d = new Date();
  const stamp =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM orders WHERE order_no LIKE ?`)
    .get(`QD-${stamp}-%`);
  const seq = String((row ? row.c : 0) + 1).padStart(4, '0');
  return `QD-${stamp}-${seq}`;
}

/** إنشاء طلب + أصنافه داخل معاملة واحدة */
function createOrder({ shopName, locale, items, note, requestId }) {
  const created = nowISO();
  const orderNo = nextOrderNo();
  const insertOrder = db.prepare(
    `INSERT INTO orders (order_no, shop_name, status, locale, created_at, updated_at, request_id, note)
     VALUES (?, ?, 'new', ?, ?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, slug, size, type_ar, type_en, price, qty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let orderId = null;
  db.exec('BEGIN');
  try {
    const res = insertOrder.run(orderNo, shopName, locale || 'ar', created, created, requestId || null, note || '');
    orderId = Number(res.lastInsertRowid);
    for (const it of items) {
      insertItem.run(orderId, it.productId, it.slug, it.size, it.typeAr, it.typeEn, it.price, it.qty);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    /* تكرار في معرّف الطلب ⇒ أعد الطلب الموجود بدل إنشاء طلب جديد */
    if (requestId && /UNIQUE|constraint/i.test(String(e.message))) {
      const existing = findByRequestId(requestId);
      if (existing) return existing;
    }
    throw e;
  }
  return getOrder(orderId);
}

/** البحث عن طلب سابق بنفس معرّف الطلب (لمنع التكرار) */
function findByRequestId(requestId) {
  if (!requestId) return null;
  const row = db.prepare(`SELECT * FROM orders WHERE request_id = ?`).get(requestId);
  if (!row) return null;
  row.items = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id`).all(row.id);
  return row;
}

function attachItems(orders) {
  if (!orders.length) return orders;
  const stmt = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id`);
  for (const o of orders) o.items = stmt.all(o.id);
  return orders;
}

/** قائمة الطلبات مع بحث وتصفية */
function listOrders({ status, q, limit = 200 } = {}) {
  const where = [];
  const params = [];
  if (status && status !== 'all') { where.push('o.status = ?'); params.push(status); }
  if (q) {
    where.push(`(
      o.shop_name LIKE ? OR o.order_no LIKE ?
      OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND (i.type_ar LIKE ? OR i.type_en LIKE ?))
    )`);
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const sql =
    `SELECT o.* FROM orders o ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY o.created_at DESC, o.id DESC LIMIT ?`;
  const rows = db.prepare(sql).all(...params, limit);
  return attachItems(rows);
}

function getOrder(id) {
  const row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
  if (!row) return null;
  row.items = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id`).all(row.id);
  return row;
}

function updateStatus(id, status, note) {
  const cur = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
  if (!cur) return null;
  db.prepare(`UPDATE orders SET status = ?, updated_at = ?, note = COALESCE(?, note) WHERE id = ?`)
    .run(status, nowISO(), note === undefined ? null : note, id);
  return getOrder(id);
}

function deleteOrder(id) {
  const r = db.prepare(`DELETE FROM orders WHERE id = ?`).run(id);
  return r.changes > 0;
}

function stats() {
  const total = db.prepare(`SELECT COUNT(*) AS c FROM orders`).get().c;
  const byStatus = db.prepare(`SELECT status, COUNT(*) AS c FROM orders GROUP BY status`).all();
  return { total, byStatus };
}

/* ── الجلسات ── */
function createSession(token) {
  db.prepare(`INSERT INTO sessions (token, created_at) VALUES (?, ?)`).run(token, nowISO());
}
function sessionExists(token) {
  return !!db.prepare(`SELECT token FROM sessions WHERE token = ?`).get(token);
}
function deleteSession(token) {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

module.exports = {
  init, createOrder, listOrders, getOrder, updateStatus, deleteOrder,
  stats, createSession, sessionExists, deleteSession, findByRequestId, DB_FILE,
};
