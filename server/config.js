/**
 * إعدادات المشروع — تُقرأ من server/config.json، ويمكن تجاوزها بمتغيرات البيئة.
 * الملف: server/config.js
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = {
  port: 3100,
  host: '0.0.0.0',
  adminPassword: 'quraishi2026',
  whatsapp: { enabled: false, phone: '', apiKey: '' },
  sms: { enabled: false, accountSid: '', authToken: '', from: '', to: '' },
  gateway: { enabled: false, url: '', phone: '', apiKey: '', apiKeyHeader: '' },
  telegram: { enabled: false, botToken: '', chatId: '' },
  discord: { enabled: false, webhookUrl: '' },
  webhook: { enabled: false, url: '' },
  email: { enabled: false, apiKey: '', from: 'orders@quraishidates.com', to: '' },
  smtp: { enabled: false, host: 'smtp.gmail.com', port: 465, secure: true, user: '', pass: '', from: '', fromName: 'تمور القرشي | Quraishi Dates', to: '' },
  brevo: { enabled: false, apiKey: '', from: 'orders@quraishidates.com', fromName: 'تمور القرشي', to: '' },
};

function loadConfig() {
  let cfg = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('⚠️  تعذّر قراءة server/config.json — سيتم استخدام الإعدادات الافتراضية:', e.message);
  }
  const merged = { ...DEFAULT_CONFIG, ...cfg };
  for (const k of Object.keys(DEFAULT_CONFIG)) {
    if (typeof DEFAULT_CONFIG[k] === 'object' && DEFAULT_CONFIG[k] !== null) {
      merged[k] = { ...DEFAULT_CONFIG[k], ...(cfg[k] || {}) };
    }
  }

  /* متغيرات البيئة تتغلّب على الملف (مفيدة عند النشر على Render/Railway) */
  if (process.env.ADMIN_PASSWORD) merged.adminPassword = process.env.ADMIN_PASSWORD;
  if (process.env.PORT) merged.port = Number(process.env.PORT);

  const envMap = {
    whatsapp: { enabled: 'WHATSAPP_ENABLED', phone: 'WHATSAPP_PHONE', apiKey: 'WHATSAPP_APIKEY' },
    sms: { enabled: 'SMS_ENABLED', accountSid: 'TWILIO_ACCOUNT_SID', authToken: 'TWILIO_AUTH_TOKEN', from: 'TWILIO_FROM', to: 'SMS_TO' },
    gateway: { enabled: 'GATEWAY_ENABLED', url: 'GATEWAY_URL', phone: 'GATEWAY_PHONE', apiKey: 'GATEWAY_API_KEY', apiKeyHeader: 'GATEWAY_API_KEY_HEADER' },
    telegram: { enabled: 'TELEGRAM_ENABLED', botToken: 'TELEGRAM_BOT_TOKEN', chatId: 'TELEGRAM_CHAT_ID' },
    discord: { enabled: 'DISCORD_ENABLED', webhookUrl: 'DISCORD_WEBHOOK_URL' },
    webhook: { enabled: 'WEBHOOK_ENABLED', url: 'WEBHOOK_URL' },
    email: { enabled: 'EMAIL_ENABLED', apiKey: 'RESEND_API_KEY', from: 'RESEND_FROM', to: 'RESEND_TO' },
    smtp: { enabled: 'SMTP_ENABLED', host: 'SMTP_HOST', port: 'SMTP_PORT', secure: 'SMTP_SECURE', user: 'SMTP_USER', pass: 'SMTP_PASS', from: 'SMTP_FROM', fromName: 'SMTP_FROM_NAME', to: 'SMTP_TO' },
    brevo: { enabled: 'BREVO_ENABLED', apiKey: 'BREVO_API_KEY', from: 'BREVO_FROM', fromName: 'BREVO_FROM_NAME', to: 'BREVO_TO' },
  };
  for (const [chan, keys] of Object.entries(envMap)) {
    for (const [field, envName] of Object.entries(keys)) {
      const v = process.env[envName];
      if (v === undefined) continue;
      merged[chan][field] = field === 'enabled' ? /^(1|true|yes|on)$/i.test(v) : v;
    }
  }
  return merged;
}

module.exports = { loadConfig, DEFAULT_CONFIG, CONFIG_PATH };
