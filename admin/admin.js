/* ═══════════════════════════════════════════════
   لوحة تحكم تمور القرشي — admin/admin.js
   ═══════════════════════════════════════════════ */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const STATUS = {
    new:      { ar: 'جديد',         cls: 'b-new' },
    reviewed: { ar: 'تمت المراجعة', cls: 'b-reviewed' },
    prepared: { ar: 'تم التجهيز',   cls: 'b-prepared' },
    delivered:{ ar: 'تم التسليم',   cls: 'b-delivered' },
    cancelled:{ ar: 'ملغي',         cls: 'b-cancelled' },
  };

  let orders = [];
  let seen = new Set();
  let firstLoad = true;
  let es = null;

  /* ─────────── تنبيه شاشة الكمبيوتر (Notification API) ─────────── */
  function notifState() {
    return (window.Notification && Notification.permission) || 'unsupported';
  }
  function updateNotifBtn() {
    const b = $('#notifBtn');
    if (!b) return;
    if (notifState() === 'unsupported') { b.style.display = 'none'; return; }
    if (notifState() === 'granted') {
      b.textContent = '🔔 التنبيه مفعّل';
      b.classList.add('on');
      b.disabled = true;
    } else {
      b.textContent = '🔔 تفعيل التنبيه';
      b.classList.remove('on');
      b.disabled = false;
    }
  }
  async function askNotifPermission() {
    if (notifState() === 'unsupported') return;
    const p = await Notification.requestPermission();
    updateNotifBtn();
    if (p === 'granted') {
      toast('تم تفعيل تنبيهات الطلبات على شاشة الكمبيوتر', '');
      new Notification('🔔 تمور القرشي — التنبيه مفعّل', { body: 'ستصلك إشعارات فور وصول أي طلب جديد.' });
    } else {
      toast('لم يُسمح بالتنبيهات — فعّلها من إعدادات المتصفح', 'err');
    }
  }
  function desktopNotify(order) {
    if (notifState() !== 'granted') return;
    try {
      const lines = order.items
        .map((i) => `• ${i.type_ar} ${i.size} ريال — الكمية: ${i.qty}`)
        .join('\n');
      const n = new Notification(`🌴 طلب جديد — ${order.shop_name}`, {
        body: `${lines}\nرقم الطلب: ${order.order_no}`,
        tag: 'quraishi-' + order.id,
        requireInteraction: true,
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* المتصفح قد يمنع الإشعارات المتكررة */ }
  }

  /* ─────────── أدوات ─────────── */
  function fmtDate(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} — ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg, type) {
    const w = $('#toastWrap');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    w.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 3500);
  }
  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const notes = [880, 1174, 1568];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = f;
        const t = ctx.currentTime + i * 0.16;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.start(t); o.stop(t + 0.3);
      });
    } catch (e) { /* الصوت غير متاح */ }
  }

  /* ─────────── جلب الطلبات ─────────── */
  async function loadOrders() {
    const q = $('#searchInput').value.trim();
    const status = $('#statusFilter').value;
    const url = `/api/admin/orders?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`;
    try {
      const res = await fetch(url);
      if (res.status === 401) { showLogin(); return; }
      const data = await res.json();
      orders = data.orders || [];

      if (firstLoad) {
        orders.forEach((o) => seen.add(o.id));
        firstLoad = false;
      } else {
        const fresh = orders.filter((o) => !seen.has(o.id));
        fresh.forEach((o) => {
          seen.add(o.id);
          toast(`🔔 طلب جديد — ${o.shop_name}`, 'info');
          desktopNotify(o);
        });
        if (fresh.length) beep();
      }

      renderStats(data.stats);
      renderOrders();
      updateTitle(data.stats);
    } catch (e) {
      toast('تعذّر تحميل الطلبات', 'err');
    }
  }

  /* ─────────── الإحصائيات ─────────── */
  function renderStats(stats) {
    if (!stats) return;
    const by = {};
    (stats.byStatus || []).forEach((s) => (by[s.status] = s.c));
    $('#stats').innerHTML = `
      <div class="stat s-total"><b>${stats.total || 0}</b><span>إجمالي الطلبات</span></div>
      <div class="stat s-new"><b>${by.new || 0}</b><span>طلبات جديدة</span></div>
      <div class="stat s-reviewed"><b>${by.reviewed || 0}</b><span>تمت المراجعة</span></div>
      <div class="stat s-prepared"><b>${by.prepared || 0}</b><span>تم التجهيز</span></div>`;
  }

  /* ─────────── عرض الطلبات ─────────── */
  function renderOrders() {
    const wrap = $('#orders');
    const empty = $('#emptyState');
    $('#ordersCount').textContent = orders.length;

    if (!orders.length) { wrap.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    wrap.innerHTML = orders.map((o) => {
      const st = STATUS[o.status] || { ar: o.status, cls: '' };
      const totalQty = o.items.reduce((s, i) => s + i.qty, 0);
      const items = o.items.map((i) => `
        <li>
          <span class="it-name">${esc(i.type_ar)}</span>
          <span class="it-en">${esc(i.type_en)}</span>
          <span class="it-size">${i.size} ريال</span>
          <span class="it-qty">الكمية: <b>${i.qty}</b></span>
        </li>`).join('');

      const btns = Object.entries(STATUS)
        .filter(([k]) => k !== 'cancelled')
        .map(([k, v]) => `<button class="sbtn${o.status === k ? ' active' : ''}" data-status="${k}" data-id="${o.id}">${v.ar}</button>`)
        .join('');

      return `
      <article class="order-card${o.status === 'new' ? ' fresh' : ''}" data-id="${o.id}">
        <div class="oc-top">
          <span class="oc-shop">🏪 ${esc(o.shop_name)}</span>
          <span class="oc-no">${esc(o.order_no)}</span>
          <span class="badge ${st.cls}">${st.ar}</span>
          <span class="oc-date">🕒 ${fmtDate(o.created_at)}</span>
        </div>
        <div class="oc-body">
          <ul class="items">${items}</ul>
          <p class="total-note">عدد الخيارات: ${o.items.length} — إجمالي الكميات: ${totalQty}</p>
        </div>
        <div class="oc-foot">
          <div class="status-btns">${btns}</div>
          <button class="del-btn" data-del="${o.id}">حذف الطلب</button>
        </div>
      </article>`;
    }).join('');
  }

  /* ─────────── تغيير الحالة ─────────── */
  async function setStatus(id, status) {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast('تم تحديث حالة الطلب', '');
      loadOrders();
    } catch (e) {
      toast('تعذّر تحديث الحالة', 'err');
    }
  }

  async function delOrder(id) {
    if (!confirm('هل تريد حذف هذا الطلب نهائيًا؟')) return;
    try {
      const res = await fetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      seen.delete(Number(id));
      toast('تم حذف الطلب', '');
      loadOrders();
    } catch (e) {
      toast('تعذّر حذف الطلب', 'err');
    }
  }

  /* ─────────── البث المباشر ─────────── */
  function connectStream() {
    if (es) es.close();
    es = new EventSource('/api/admin/stream');
    es.addEventListener('hello', () => {
      $('#liveDot').classList.remove('off');
      $('#liveDot').innerHTML = '<i></i> مباشر';
    });
    es.addEventListener('order', () => loadOrders());
    es.addEventListener('deleted', () => loadOrders());
    es.onerror = () => {
      $('#liveDot').classList.add('off');
      $('#liveDot').innerHTML = '<i></i> انقطع الاتصال';
    };
  }

  /* ─────────── عنوان التبويب + حالة الأزرار ─────────── */
  function updateTitle(stats) {
    const by = {};
    (stats && stats.byStatus ? stats.byStatus : []).forEach((s) => (by[s.status] = s.c));
    const n = by.new || 0;
    document.title = (n ? `(${n}) طلب جديد — ` : '') + 'لوحة التحكم — تمور القرشي';
    const badge = $('#newBadge');
    if (badge) {
      badge.textContent = n;
      badge.style.display = n ? 'inline-grid' : 'none';
    }
  }

  /* ─────────── تسجيل الدخول ─────────── */
  function showLogin() {
    $('#loginScreen').style.display = 'grid';
    $('#app').hidden = true;
  }
  function showApp() {
    $('#loginScreen').style.display = 'none';
    $('#app').hidden = false;
  }

  async function trySession() {
    const res = await fetch('/api/session');
    const d = await res.json();
    if (d.authenticated) { showApp(); firstLoad = true; loadOrders(); connectStream(); }
    else showLogin();
  }

  async function doLogin(e) {
    e.preventDefault();
    const err = $('#loginErr');
    err.hidden = true;
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('#passInput').value }),
    });
    const d = await res.json();
    if (!res.ok) { err.textContent = d.error || 'فشل تسجيل الدخول'; err.hidden = false; return; }
    $('#passInput').value = '';
    showApp();
    firstLoad = true;
    loadOrders();
    connectStream();
    toast('مرحبًا بك في لوحة التحكم', '');
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    if (es) es.close();
    showLogin();
  }

  /* ─────────── الأحداث ─────────── */
  function bind() {
    $('#loginForm').addEventListener('submit', doLogin);
    $('#logoutBtn').addEventListener('click', logout);
    $('#refreshBtn').addEventListener('click', loadOrders);
    const nb = $('#notifBtn');
    if (nb) nb.addEventListener('click', askNotifPermission);
    updateNotifBtn();

    let t;
    $('#searchInput').addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadOrders, 280); });
    $('#statusFilter').addEventListener('change', loadOrders);

    document.addEventListener('click', (e) => {
      const s = e.target.closest('[data-status]');
      if (s) { setStatus(s.dataset.id, s.dataset.status); return; }
      const d = e.target.closest('[data-del]');
      if (d) { delOrder(d.dataset.del); }
    });

    /* تحديث دوري احتياطي في حال انقطاع البث */
    setInterval(() => { if (!document.hidden) loadOrders(); }, 30000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    trySession();
  });
})();
