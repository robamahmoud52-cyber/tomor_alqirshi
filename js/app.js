/* ═══════════════════════════════════════════════
   تمور القرشي | Quraishi Dates — منطق الواجهة والسلة
   ملف مستقل: js/app.js
   ═══════════════════════════════════════════════ */
(function () {
  'use strict';

  const CATALOG = window.QC_CATALOG;
  const CART_KEY = 'quraishi_cart_v1';
  const LANG_KEY = 'quraishi_lang_v1';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ══════════ الاتصال بالخادم ══════════
     1) إن كان الموقع يعمل من نفس خادم الطلبات → نستخدم المسار النسبي.
        (هذا هو حال النشر على Cloudflare Worker: الموقع والـAPI نفس النطاق)
     2) إن كان العنوان محدّدًا في js/config.js → نستخدمه (نطاق منفصل).
     3) إن كان الموقع مفتوحًا كملف (file://) نجرّب الخادم المحلي تلقائيًا.
  */
  const API_FALLBACKS = ['http://localhost:3100', 'http://127.0.0.1:3100'];
  let apiBase = null;

  function apiCandidates() {
    const list = [];
    const configured = (window.QC_API_BASE || '').trim().replace(/\/+$/, '');
    if (configured) list.push(configured);
    else if (location.protocol !== 'file:') list.push(''); // نفس الأصل (Worker أو Node)
    list.push(...API_FALLBACKS);
    return [...new Set(list)];
  }

  async function resolveApiBase() {
    if (apiBase !== null) return apiBase;
    for (const base of apiCandidates()) {
      try {
        const res = await fetch(base + '/api/ping', { method: 'GET', cache: 'no-store' });
        if (res.ok) { apiBase = base; return apiBase; }
      } catch (e) { /* جرّب العنوان التالي */ }
    }
    apiBase = false; // تعذّر الاتصال
    return apiBase;
  }

  /* معرّف الطلب: يمنع تكرار نفس الطلب عند إعادة المحاولة */
  function newRequestId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'req-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }
  let pendingRequestId = null;

  /* ══════════ الحالة ══════════ */
  let lang = localStorage.getItem(LANG_KEY) || 'ar';
  let cart = loadCart();

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((i) => i && i.id && i.qty > 0) : [];
    } catch (e) {
      return [];
    }
  }
  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  /* ══════════ تبديل اللغة ══════════ */
  function applyLang(l) {
    lang = l;
    localStorage.setItem(LANG_KEY, l);
    const html = document.documentElement;
    html.lang = l;
    html.dir = l === 'ar' ? 'rtl' : 'ltr';

    $$('[data-ar]').forEach((el) => {
      const val = el.getAttribute(l === 'ar' ? 'data-ar' : 'data-en');
      if (val != null) el.textContent = val;
    });
    $$('[data-ar-placeholder]').forEach((el) => {
      const val = el.getAttribute(l === 'ar' ? 'data-ar-placeholder' : 'data-en-placeholder');
      if (val != null) el.placeholder = val;
    });

    const langBtn = $('#langBtn');
    if (langBtn) langBtn.innerHTML = l === 'ar' ? '<span class="lang-ar">EN</span>' : '<span class="lang-en">ع</span>';

    renderVarieties();
    renderCart();
  }

  /* ══════════ بناء بطاقات الأصناف ══════════ */
  function productById(id) {
    return CATALOG.products.find((p) => p.id === id) || null;
  }

  function cardMarkup(p) {
    const inCart = cart.find((i) => i.id === p.id);
    const qty = inCart ? inCart.qty : 0;
    const nameAr = p.typeAr;
    const nameEn = p.typeEn;
    const label = lang === 'ar' ? nameAr : nameEn;
    const sub = lang === 'ar' ? nameEn : nameAr;
    const curAr = 'ريال', curEn = 'SAR';

    return `
    <article class="option-card${qty ? ' in-cart' : ''}" data-id="${p.id}">
      <div class="option-media">
        <img src="${p.image}" alt="${label}" loading="lazy" width="400" height="250">
        <span class="size-chip">${p.size} ${lang === 'ar' ? curAr : curEn}</span>
      </div>
      <div class="option-body">
        <div class="option-title">
          <span class="ar">${nameAr}</span>
          <span class="en">${nameEn}</span>
        </div>
        <div class="price">
          <span class="amount">${p.price}</span>
          <span class="cur">${lang === 'ar' ? curAr : curEn}</span>
        </div>
        <div class="option-foot">
          <button class="btn ${qty ? 'btn-outline' : 'btn-gold'} add-btn" data-id="${p.id}" type="button">
            ${qty
              ? (lang === 'ar' ? 'تم الإضافة ✓' : 'Added ✓')
              : (lang === 'ar' ? 'اطلب الآن' : 'Order now')}
          </button>
          <div class="qty-row">
            <span class="in-cart-badge">✓ <span>${lang === 'ar' ? 'في السلة' : 'In basket'}: <b data-qty="${p.id}">${qty}</b></span></span>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderVarieties() {
    const wrap = $('#varieties');
    if (!wrap) return;
    wrap.innerHTML = CATALOG.varieties
      .map((v) => {
        const opts = CATALOG.products.filter((p) => p.slug === v.slug);
        return `
        <section class="variety" id="v-${v.slug}">
          <div class="variety-head">
            <h3>${v.ar}</h3>
            <span class="en">${v.en}</span>
            <span class="desc">${lang === 'ar' ? v.descAr : v.descEn}</span>
          </div>
          <div class="options">${opts.map(cardMarkup).join('')}</div>
        </section>`;
      })
      .join('');
    renderChips();
  }

  function renderChips() {
    const chips = $('#chips');
    if (!chips) return;
    chips.innerHTML =
      `<button class="chip active" data-slug="all">${lang === 'ar' ? 'كل الأصناف' : 'All varieties'}</button>` +
      CATALOG.varieties
        .map((v) => `<button class="chip" data-slug="${v.slug}">${lang === 'ar' ? v.ar : v.en}</button>`)
        .join('');
  }

  /* ══════════ عمليات السلة ══════════ */
  function addToCart(id) {
    const p = productById(id);
    if (!p) return;
    const found = cart.find((i) => i.id === id);
    if (found) {
      found.qty += 1; // نفس الخيار ⇒ زيادة الكمية بدل التكرار
    } else {
      cart.push({
        id: p.id, slug: p.slug, size: p.size, price: p.price,
        typeAr: p.typeAr, typeEn: p.typeEn, image: p.image, qty: 1,
      });
    }
    saveCart();
    renderCart();
    bumpCount();
    toast(lang === 'ar' ? `أُضيف ${p.typeAr} ${p.size} ريال إلى السلة` : `${p.typeEn} ${p.size} SAR added`, 'ok');
  }

  function setQty(id, qty) {
    const item = cart.find((i) => i.id === id);
    if (!item) return;
    if (qty <= 0) { removeItem(id); return; }
    item.qty = Math.min(qty, 9999);
    saveCart();
    renderCart();
  }

  function removeItem(id) {
    const item = cart.find((i) => i.id === id);
    cart = cart.filter((i) => i.id !== id);
    saveCart();
    renderCart();
    if (item) {
      toast(lang === 'ar' ? 'تم حذف الصنف من السلة' : 'Item removed from the basket', 'ok');
    }
  }

  function cartCount() {
    return cart.reduce((s, i) => s + i.qty, 0);
  }

  function bumpCount() {
    const el = $('#cartCount');
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /* ══════════ رسم السلة ══════════ */
  function renderCart() {
    const list = $('#cartItems');
    const empty = $('#cartEmpty');
    const count = cartCount();

    if ($('#cartCount')) $('#cartCount').textContent = count;
    if ($('#cartPill')) $('#cartPill').textContent = count;
    if ($('#cartItems')) $('#cartItems').innerHTML = '';
    if (!list || !empty) return;

    if (!cart.length) {
      empty.hidden = false;
      list.innerHTML = '';
      return;
    }
    empty.hidden = true;

    list.innerHTML = cart
      .map(
        (i) => `
      <li class="cart-item" data-id="${i.id}">
        <img class="ci-img" src="${i.image}" alt="" width="62" height="62">
        <div class="ci-info">
          <div class="ci-name">${lang === 'ar' ? i.typeAr : i.typeEn}</div>
          <div class="ci-en">${lang === 'ar' ? i.typeEn : i.typeAr}</div>
          <span class="ci-size">${i.size} ${lang === 'ar' ? 'ريال' : 'SAR'}</span>
        </div>
        <div class="ci-right">
          <div class="qty-ctrl sm">
            <button type="button" class="dec" data-id="${i.id}" aria-label="-">−</button>
            <span class="qty">${i.qty}</span>
            <button type="button" class="inc" data-id="${i.id}" aria-label="+">+</button>
          </div>
          <button type="button" class="ci-remove" data-remove="${i.id}">${lang === 'ar' ? 'إزالة' : 'Remove'}</button>
        </div>
      </li>`
      )
      .join('');

    /* تحديث البطاقات في الشبكة (علامة "في السلة") */
    $$('.option-card').forEach((card) => {
      const it = cart.find((i) => i.id === card.dataset.id);
      const qty = it ? it.qty : 0;
      card.classList.toggle('in-cart', qty > 0);
      const badge = card.querySelector(`[data-qty="${card.dataset.id}"]`);
      if (badge) badge.textContent = qty;
      const btn = card.querySelector('.add-btn');
      if (btn) {
        btn.textContent = qty
          ? (lang === 'ar' ? 'أضف مرة أخرى' : 'Add another')
          : (lang === 'ar' ? 'اطلب الآن' : 'Order now');
        btn.classList.toggle('btn-gold', qty === 0);
        btn.classList.toggle('btn-outline', qty > 0);
      }
    });
  }

  /* ══════════ فتح/إغلاق السلة ══════════ */
  function openCart() {
    $('#cartDrawer').classList.add('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'false');
    $('#overlay').hidden = false;
    document.body.classList.add('no-scroll');
  }
  function closeCart() {
    $('#cartDrawer').classList.remove('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'true');
    $('#overlay').hidden = true;
    document.body.classList.remove('no-scroll');
  }

  /* ══════════ تنبيهات ══════════ */
  function toast(msg, type) {
    const wrap = $('#toastWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'ok');
    el.innerHTML = `<span class="ti">${type === 'err' ? '⚠️' : '✅'}</span><span></span>`;
    el.querySelector('span:last-child').textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(() => el.remove(), 320);
    }, 3800);
  }

  /* ══════════ إرسال الطلب ══════════ */
  async function submitOrder() {
    const shopInput = $('#shopName');
    const shopName = shopInput.value.trim();
    const err = $('#shopError');

    if (!cart.length) {
      toast(lang === 'ar' ? 'السلة فارغة — أضف صنفًا واحدًا على الأقل' : 'Your basket is empty', 'err');
      return;
    }
    if (!shopName) {
      err.hidden = false;
      shopInput.closest('.shop-field').classList.add('invalid');
      shopInput.focus();
      toast(lang === 'ar' ? 'يرجى إدخال اسم المحل' : 'Please enter your shop name', 'err');
      return;
    }
    err.hidden = true;
    shopInput.closest('.shop-field').classList.remove('invalid');

    const btn = $('#submitOrder');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = lang === 'ar' ? 'جارٍ الإرسال…' : 'Sending…';

    const payload = {
      shopName,
      locale: lang,
      requestId: pendingRequestId || (pendingRequestId = newRequestId()),
      items: cart.map((i) => ({
        productId: i.id, slug: i.slug, size: i.size,
        typeAr: i.typeAr, typeEn: i.typeEn, qty: i.qty,
      })),
    };

    try {
      /* 1) تحديد عنوان الخادم (يعمل حتى عند فتح الموقع كملف) */
      const base = await resolveApiBase();
      if (base === false) {
        console.error('[Quraishi] تعذّر الوصول إلى خادم الطلبات. جرّب: start.bat ثم افتح http://localhost:' + (window.QC_API_PORT || '3100'));
        throw new Error('SERVER_UNREACHABLE');
      }

      /* 2) الإرسال */
      const res = await fetch(base + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = new Error(data.error || 'HTTP_' + res.status);
        err.status = res.status;
        err.serverMessage = data.error || '';
        throw err;
      }

      /* ✅ تم الحفظ بنجاح في قاعدة البيانات ⇒ الآن فقط نفرّغ السلة */
      pendingRequestId = null;
      cart = [];
      saveCart();
      renderCart();
      shopInput.value = '';
      closeCart();

      toast(
        lang === 'ar'
          ? 'تم إرسال طلبك بنجاح، شكرًا لثقتكم بتمور القرشي 🌴'
          : 'Your order was sent successfully — thank you for trusting Quraishi Dates 🌴',
        'ok'
      );
      if (data.orderNo) {
        setTimeout(() => toast(lang === 'ar' ? `رقم الطلب: ${data.orderNo}` : `Order reference: ${data.orderNo}`, 'ok'), 600);
      }
    } catch (e) {
      console.error('[Quraishi] فشل إرسال الطلب:', e);
      let msg;
      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(location.origin) || location.protocol === 'file:';
      if (e.message === 'SERVER_UNREACHABLE') {
        msg = isLocal
          ? (lang === 'ar'
              ? 'تعذّر الوصول إلى خادم الطلبات. شغّل ملف start.bat ثم افتح الموقع من http://localhost:3100'
              : 'Cannot reach the order server. Run start.bat and open http://localhost:3100')
          : (lang === 'ar'
              ? 'تعذّر الوصول إلى خادم الطلبات. نرجو المحاولة بعد قليل.'
              : 'Cannot reach the order server. Please try again shortly.');
      } else if (e.status === 400) {
        msg = e.serverMessage || (lang === 'ar' ? 'بيانات الطلب غير مكتملة' : 'Incomplete order data');
      } else if (e.status === 429) {
        msg = lang === 'ar' ? 'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة' : 'Too many attempts, please retry shortly';
      } else {
        msg = lang === 'ar'
          ? 'تعذّر إرسال الطلب. لم يتم حذف أصنافك من السلة — حاول مرة أخرى.'
          : 'Could not send the order. Your basket is unchanged — please try again.';
      }
      toast(msg, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  /* ══════════ الأحداث ══════════ */
  function bind() {
    document.addEventListener('click', (e) => {
      const add = e.target.closest('.add-btn');
      if (add) { addToCart(add.dataset.id); return; }

      const inc = e.target.closest('.inc');
      if (inc) {
        const it = cart.find((i) => i.id === inc.dataset.id);
        if (it) setQty(it.id, it.qty + 1);
        return;
      }
      const dec = e.target.closest('.dec');
      if (dec) {
        const it = cart.find((i) => i.id === dec.dataset.id);
        if (it) setQty(it.id, it.qty - 1);
        return;
      }
      const rm = e.target.closest('[data-remove]');
      if (rm) { removeItem(rm.dataset.remove); return; }

      const chip = e.target.closest('.chip');
      if (chip) {
        $$('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const slug = chip.dataset.slug;
        if (slug === 'all') {
          $$('.variety').forEach((v) => (v.style.display = ''));
        } else {
          $$('.variety').forEach((v) => (v.style.display = v.id === 'v-' + slug ? '' : 'none'));
        }
        return;
      }
    });

    $('#cartBtn').addEventListener('click', openCart);
    $('#closeCart').addEventListener('click', closeCart);
    $('#overlay').addEventListener('click', closeCart);
    $('#submitOrder').addEventListener('click', submitOrder);
    $('#goShop').addEventListener('click', closeCart);

    $('#langBtn').addEventListener('click', () => applyLang(lang === 'ar' ? 'en' : 'ar'));

    $('#shopName').addEventListener('input', (e) => {
      e.target.closest('.shop-field').classList.remove('invalid');
      $('#shopError').hidden = true;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCart();
    });
  }

  /* ══════════ التشغيل ══════════ */
  document.addEventListener('DOMContentLoaded', () => {
    const y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
    bind();
    applyLang(lang);
    renderCart();
  });
})();
