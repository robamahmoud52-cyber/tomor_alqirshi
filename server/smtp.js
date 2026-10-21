/**
 * ═══════════════════════════════════════════════════════════════
 *  عميل SMTP مصغّر — يرسل البريد من حساب Gmail (أو أي SMTP) بدون مكتبات.
 *  الملف: server/smtp.js
 *  يعمل مع: Gmail (المنفذ 465 + App Password) وأي مزوّد SMTP آخر.
 * ═══════════════════════════════════════════════════════════════
 */
'use strict';
const net = require('node:net');
const tls = require('node:tls');

const CRLF = '\r\n';

function encodeHeader(v) {
  return /^[\x20-\x7E]*$/.test(v) ? v : '=?UTF-8?B?' + Buffer.from(v, 'utf8').toString('base64') + '?=';
}

function buildMessage({ from, fromName, to, subject, text }) {
  const date = new Date().toUTCString();
  const messageId = `<${Date.now()}.${Math.random().toString(16).slice(2)}@quraishi-dates>`;
  return [
    `From: ${fromName ? encodeHeader(fromName) + ' ' : ''}<${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text.replace(/\r?\n/g, CRLF),
  ].join(CRLF);
}

/**
 * إرسال بريد عبر SMTP.
 * الإعدادات: { host, port, secure, user, pass, from, fromName, to, subject, text }
 */
function sendMail(opts) {
  const {
    host = 'smtp.gmail.com', port = 465, secure = true,
    user, pass, from, fromName, to, subject, text,
  } = opts;

  if (!host || !user || !pass || !from || !to) {
    return Promise.reject(new Error('إعدادات SMTP ناقصة (host/user/pass/from/to)'));
  }

  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host, rejectUnauthorized: false })
      : net.connect({ host, port });

    let stage = 'greeting';
    let buffer = '';
    let done = false;

    const fail = (msg) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch (e) {}
      reject(new Error(msg));
    };
    const succeed = (msg) => {
      if (done) return;
      done = true;
      try { socket.end(); } catch (e) {}
      resolve(msg);
    };
    const send = (line) => {
      if (process.env.QC_SMTP_DEBUG) console.log('[smtp] >>', JSON.stringify(line));
      if (socket.writable) socket.write(line + CRLF);
    };

    socket.setTimeout(30000, () => fail('انتهت مهلة الاتصال بخادم SMTP'));
    socket.on('error', (e) => fail('خطأ SMTP: ' + e.message));

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      /* معالجة الردود (قد تكون متعددة الأسطر) */
      while ((idx = buffer.indexOf(CRLF)) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (process.env.QC_SMTP_DEBUG) console.log('[smtp] <<', JSON.stringify(line), '| stage:', stage);

        if (/^\d{3}-/.test(line)) continue; // سطر Continuation — ننتظر السطر الأخير

        const code = parseInt(line.slice(0, 3), 10);
        const respText = line.slice(4);

        if (code >= 400 && code < 600) {
          const reason =
            code === 535 ? 'بيانات الدخول غير صحيحة (تأكد من App Password)'
            : code === 550 ? 'الخادم رفض العنوان أو الرسالة (تحقق من إعدادات Gmail)'
            : code === 421 ? 'الخادم أغلق الاتصال مؤقتًا — أعد المحاولة لاحقًا'
            : 'SMTP ' + code + ': ' + respText;
          return fail(reason);
        }

        switch (stage) {
          case 'greeting':
            if (code !== 220) return fail('رد غير متوقع من SMTP: ' + line);
            stage = 'ehlo';
            send('EHLO quraishi-dates.local');
            break;
          case 'ehlo':
            stage = 'auth';
            send('AUTH LOGIN');
            break;
          case 'auth': {
            if (code !== 334) return fail('تعذّر بدء المصادقة: ' + line);
            if (stage === 'auth') { stage = 'auth-user'; send(Buffer.from(user, 'utf8').toString('base64')); }
            break;
          }
          case 'auth-user':
            if (code !== 334) return fail('اسم المستخدم غير مقبول: ' + line);
            stage = 'auth-pass';
            send(Buffer.from(pass, 'utf8').toString('base64'));
            break;
          case 'auth-pass':
            if (code !== 235) return fail('فشل المصادقة على SMTP: ' + line);
            stage = 'mail';
            send(`MAIL FROM:<${from}>`);
            break;
          case 'mail':
            stage = 'rcpt';
            send(`RCPT TO:<${to}>`);
            break;
          case 'rcpt':
            stage = 'data';
            send('DATA');
            break;
          case 'data':
            if (code !== 354) return fail('لم يقبل الخادم البيانات: ' + line);
            stage = 'body';
            send(buildMessage({ from, fromName, to, subject, text }) + CRLF + '.');
            break;
          case 'body':
            if (code !== 250) return fail('لم يُرسل البريد: ' + line);
            stage = 'quit';
            send('QUIT');
            break;
          case 'quit':
            succeed('email ✓');
            break;
        }
      }
    });

    socket.on('close', () => { if (!done) fail('أُغلق اتصال SMTP قبل اكتمال الإرسال'); });
  });
}

module.exports = { sendMail, buildMessage };
