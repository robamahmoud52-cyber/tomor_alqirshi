/**
 * ═══════════════════════════════════════════════════════════════
 *  نظام الإشعارات — كيف تصلك رسالة الطلب على جوّالك؟
 *  القنوات المدعومة:
 *    1) واتساب (CallMeBot)  — مجاني، يصل إلى رقم جوّالك مباشرة
 *    2) رسالة SMS (Twilio)   — رسالة نصية حقيقية لأي رقم
 *    3) واتساب/SMS عبر بوابتك (Webhook مخصّص)
 *    4) تيليجرام — إشعار فوري داخل التطبيق
 *    5) بريد إلكتروني (Resend)
 *  الملف: server/notify.js
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';

const AR_CUR = 'ريال';
const AR_STATUS = {
  new: 'جديد', reviewed: 'تمت المراجعة', prepared: 'تم التجهيز',
  delivered: 'تم التسليم', cancelled: 'ملغي',
};

function fmtDate(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** نص الإشعار الكامل (كما في المطلوب) */
function buildMessage(order) {
  const lines = [];
  lines.push('🌴 طلب جديد — تمور القرشي');
  lines.push('');
  lines.push(`🏪 اسم المحل: ${order.shop_name}`);
  lines.push('');
  lines.push('📦 تفاصيل الطلب:');
  for (const it of order.items) {
    lines.push(`- ${it.type_ar} ${it.size} ${AR_CUR} — الكمية: ${it.qty}`);
  }
  lines.push('');
  lines.push(`🕒 تاريخ ووقت الطلب: ${fmtDate(order.created_at)}`);
  lines.push(`🔢 رقم الطلب: ${order.order_no}`);
  lines.push(`🔔 حالة الطلب: ${AR_STATUS[order.status] || order.status}`);
  return lines.join('\n');
}

/** نسخة إنجليزية */
function buildMessageEn(order) {
  const lines = [];
  lines.push('🌴 New order — Quraishi Dates');
  lines.push('');
  lines.push(`🏪 Shop name: ${order.shop_name}`);
  lines.push('');
  lines.push('📦 Order details:');
  for (const it of order.items) {
    lines.push(`- ${it.type_en} ${it.size} SAR — Qty: ${it.qty}`);
  }
  lines.push('');
  lines.push(`🕒 Date & time: ${fmtDate(order.created_at)}`);
  lines.push(`🔢 Order No: ${order.order_no}`);
  lines.push(`🔔 Status: ${order.status}`);
  return lines.join('\n');
}

/** نسخة مختصرة مناسبة لرسائل SMS (تتجاوز 160 حرفًا في العادة) */
function buildMessageSms(order) {
  const head = `🌴 طلب جديد — تمور القرشي\n🏪 ${order.shop_name}\n`;
  const body = order.items.map((i) => `• ${i.type_ar} ${i.size} ${AR_CUR} × ${i.qty}`).join('\n');
  const tail = `\n🕒 ${fmtDate(order.created_at)}\n🔢 ${order.order_no}`;
  return (head + body + tail).slice(0, 900);
}

/** رسالة التوصيل على واتساب (تُحوّل إلى نص عادي) */
function buildWhatsAppText(order) {
  return buildMessage(order) + '\n\n' + '— تمور القرشي | Quraishi Dates';
}

async function post(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

/* ─────────── واتساب عبر CallMeBot (مجاني) ─────────── */
async function sendWhatsApp(cfg, order) {
  const text = encodeURIComponent(buildWhatsAppText(order));
  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cfg.phone)}` +
    `&text=${text}&apikey=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetch(url);
  const body = await res.text();
  const plain = body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

  if (/APIKey is invalid/i.test(plain)) {
    throw new Error('مفتاح CallMeBot غير صحيح — فعّل الرقم من جديد واحصل على مفتاح جديد');
  }
  if (/not activated/i.test(plain)) {
    throw new Error('الرقم غير مفعّل — أرسل رسالة التفعيل من رقمك إلى 34634');
  }
  if (/blocked|blacklist/i.test(plain)) {
    throw new Error('CallMeBot يحظر هذا الرقم مؤقتًا — جرّب لاحقًا أو استخدم قناة SMS');
  }
  if (/quota|limit/i.test(plain)) {
    throw new Error('تجاوزت الحد المجاني لرسائل CallMeBot');
  }
  if (/too many requests|oops/i.test(plain)) {
    throw new Error('CallMeBot: طلبات كثيرة جدًا — انتظر بضع دقائق ثم أعد المحاولة');
  }
  if (!/sent/i.test(plain)) {
    throw new Error(`CallMeBot: ${plain.slice(0, 140)}`);
  }
  if (!res.ok) throw new Error(`CallMeBot ${res.status}: ${plain.slice(0, 140)}`);
  return 'whatsapp ✓';
}

/* ─────────── رسالة SMS عبر Twilio ─────────── */
async function sendTwilioSms(cfg, order) {
  const to = cfg.to && cfg.to.startsWith('+') ? cfg.to : '+' + String(cfg.to || '').replace(/[^0-9]/g, '');
  const from = cfg.from && cfg.from.startsWith('+') ? cfg.from : '+' + String(cfg.from || '').replace(/[^0-9]/g, '');
  const body = new URLSearchParams({
    To: to, From: from,
    Body: buildMessageSms(order),
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(cfg.accountSid + ':' + cfg.authToken).toString('base64'),
      },
      body: body.toString(),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data.message || 'send failed'}`);
  return 'sms ✓';
}

/* ─────────── بوابة SMS / واتساب مخصّصة (مع متغيرات {{phone}} و{{message}}) ─────────── */
async function sendGateway(cfg, order) {
  let url = cfg.url
    .replace(/\{\{phone\}\}/g, encodeURIComponent(cfg.phone || ''))
    .replace(/\{\{message\}\}/g, encodeURIComponent(buildMessage(order)));
  const headers = {};
  if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;
  if (cfg.apiKeyHeader && cfg.apiKey) headers[cfg.apiKeyHeader] = cfg.apiKey;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({
    phone: cfg.phone, message: buildMessage(order), orderNo: order.order_no, shopName: order.shop_name,
  })});
  const text = await res.text();
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${text.slice(0, 160)}`);
  return 'gateway ✓';
}

/* ─────────── تيليجرام ─────────── */
async function sendTelegram(cfg, order) {
  const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: cfg.chatId,
      text: buildMessage(order),
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(`Telegram: ${data.description || res.status}`);
  return 'telegram ✓';
}

/* ─────────── Discord ─────────── */
async function sendDiscord(cfg, order) {
  await post(cfg.webhookUrl, { content: '```\n' + buildMessage(order) + '\n```' });
  return 'discord ✓';
}

/* ─────────── Webhook عام (Zapier / Make / سكربتك) ─────────── */
async function sendWebhook(cfg, order) {
  await post(cfg.url, {
    type: 'new_order',
    shopName: order.shop_name,
    orderNo: order.order_no,
    status: order.status,
    createdAt: order.created_at,
    items: order.items.map((i) => ({
      productId: i.product_id, nameAr: i.type_ar, nameEn: i.type_en,
      size: i.size, price: i.price, qty: i.qty,
    })),
    message: buildMessage(order),
  });
  return 'webhook ✓';
}

/* ─────────── بريد عبر Gmail (SMTP مباشر) ─────────── */
async function sendSmtpMail(cfg, order) {
  const { sendMail } = require('./smtp');
  const subject = `🌴 طلب جديد — ${order.shop_name} — ${order.order_no}`;
  const body = buildMessage(order) + '\n\n' + buildMessageEn(order);
  await sendMail({
    host: cfg.host || 'smtp.gmail.com',
    port: Number(cfg.port) || 465,
    secure: cfg.secure !== false,
    user: cfg.user,
    pass: cfg.pass,
    from: cfg.from || cfg.user,
    fromName: cfg.fromName || 'تمور القرشي | Quraishi Dates',
    to: cfg.to,
    subject,
    text: body,
  });
  return 'email(smtp) ✓';
}

/* ─────────── بريد عبر Resend (HTTP — يعمل داخل Cloudflare Worker) ─────────── */
async function sendEmail(cfg, order) {
  const subject = `🌴 طلب جديد — ${order.shop_name} — ${order.order_no}`;
  const body = buildMessage(order) + '\n\n' + buildMessageEn(order);
  await post('https://api.resend.com/emails', {
    from: cfg.from,
    to: [cfg.to],
    subject,
    text: body,
  }, { Authorization: 'Bearer ' + cfg.apiKey });
  return 'email(resend) ✓';
}

/* ─────────── بريد عبر Brevo (HTTP — بديل مجاني لـ Resend) ─────────── */
async function sendBrevo(cfg, order) {
  const subject = `🌴 طلب جديد — ${order.shop_name} — ${order.order_no}`;
  const html = '<pre style="white-space:pre-wrap;font-family:sans-serif">' +
    buildMessage(order).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</pre>';
  await post('https://api.brevo.com/v3/smtp/email', {
    sender: { name: cfg.fromName || 'تمور القرشي', email: cfg.from },
    to: [{ email: cfg.to }],
    subject,
    htmlContent: html,
    textContent: buildMessage(order),
  }, { 'api-key': cfg.apiKey });
  return 'email(brevo) ✓';
}

const CHANNELS = [
  { key: 'whatsapp', fn: sendWhatsApp },
  { key: 'sms', fn: sendTwilioSms },
  { key: 'gateway', fn: sendGateway },
  { key: 'telegram', fn: sendTelegram },
  { key: 'discord', fn: sendDiscord },
  { key: 'webhook', fn: sendWebhook },
  { key: 'email', fn: sendEmail },
  { key: 'smtp', fn: sendSmtpMail },
  { key: 'brevo', fn: sendBrevo },
];

function isReal(v) {
  if (!v || typeof v !== 'string') return false;
  return !/ضع_|ضع |your_|changeme|xxxx|example/i.test(v.trim());
}

function channelReady(key, cfg) {
  if (!cfg || !cfg.enabled) return false;
  switch (key) {
    case 'whatsapp': return isReal(cfg.phone) && isReal(cfg.apiKey);
    case 'sms': return isReal(cfg.accountSid) && isReal(cfg.authToken) && isReal(cfg.from) && isReal(cfg.to);
    case 'gateway': return isReal(cfg.url) && isReal(cfg.phone);
    case 'telegram': return isReal(cfg.botToken) && isReal(cfg.chatId);
    case 'discord': return isReal(cfg.webhookUrl);
    case 'webhook': return isReal(cfg.url);
    case 'email': return isReal(cfg.apiKey) && isReal(cfg.to);
    case 'smtp': return isReal(cfg.user) && isReal(cfg.pass) && isReal(cfg.to);
    case 'brevo': return isReal(cfg.apiKey) && isReal(cfg.to) && isReal(cfg.from);
    default: return false;
  }
}

/** إعادة محاولة واحدة عند فشل الإرسال */
async function withRetry(fn, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw lastErr;
}

/**
 * إرسال الطلب لكل القنوات المفعّلة.
 * فشل الإشعار لا يُفشل حفظ الطلب — يُسجَّل فقط.
 */
async function notifyAll(config, order) {
  const results = [];
  const enabled = CHANNELS.filter((c) => channelReady(c.key, config[c.key]));

  if (!enabled.length) {
    console.log('ℹ️  لم تُفعَّل قنوات إشعار — الطلب محفوظ في قاعدة البيانات فقط.');
    for (const c of CHANNELS) {
      const cfg = config[c.key];
      if (cfg && cfg.enabled && !channelReady(c.key, cfg)) {
        console.log(`    ↳ قناة ${c.key} مفعّلة لكنها ناقصة البيانات — راجع server/config.json`);
      }
    }
    console.log('    لتفعيل الإشعارات: عدّل server/config.json ثم شغّل:  node tools/test-notify.js');
  }

  for (const ch of enabled) {
    try {
      const r = await withRetry(() => ch.fn(config[ch.key], order));
      results.push({ channel: ch.key, ok: true, detail: r });
      console.log(`✅ إشعار ${ch.key} أُرسل للطلب ${order.order_no}`);
    } catch (e) {
      results.push({ channel: ch.key, ok: false, detail: e.message });
      console.error(`❌ فشل إشعار ${ch.key}: ${e.message}`);
    }
  }
  return results;
}

module.exports = {
  notifyAll, buildMessage, buildMessageEn, buildMessageSms, buildWhatsAppText,
  AR_STATUS, fmtDate,
};
