/**
 * كتالوج أصناف التمور — مصدر واحد للحقيقة يستخدمه الموقع ولوحة التحكم والخادم.
 * كل صنف × 3 خيارات (5 / 10 / 15 ريال) = منتج مستقل داخل السلة.
 */
(function (root, factory) {
  const data = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.QC_CATALOG = data;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

const SIZES = [6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 25, 30];

const VARIETIES = [
  { slug: 'ajwa', ar: 'تمر عجوة', sizes: [12, 15, 18, 22], en: 'Ajwa Dates', descAr: 'عجوة', descEn: 'Ajwa' },
  { slug: 'sukkari', ar: 'تمر سكري', sizes: [10, 12], en: 'Sukkari Dates', descAr: 'سكري', descEn: 'Sukkari' },
  { slug: 'sukkari-mufattal', ar: 'تمر سكري مفتل', sizes: [25, 30], en: 'Sukkari Mufattal Dates', descAr: 'سكري مفتل', descEn: 'Sukkari Mufattal' },
  { slug: 'medjool', ar: 'تمر مجدول', sizes: [12, 15, 20], en: 'Medjool Dates', descAr: 'مجدول', descEn: 'Medjool' },
  { slug: 'safawi', ar: 'تمر صفاوي', sizes: [10, 12, 14], en: 'Safawi Dates', descAr: 'صفاوي', descEn: 'Safawi' },
  { slug: 'anbara', ar: 'تمر عنبرة', sizes: [12, 16, 20], en: 'Anbara Dates', descAr: 'عنبرة', descEn: 'Anbara' },
  { slug: 'mabroom', ar: 'تمر مبروم', sizes: [14, 18, 22], en: 'Mabroom Dates', descAr: 'مبروم', descEn: 'Mabroom' },
  { slug: 'sagai', ar: 'تمر صقعي', sizes: [8, 10, 12, 14], en: 'Sagai Dates', descAr: 'صقعي', descEn: 'Sagai' },
  { slug: 'sufri', ar: 'تمر صفري', sizes: [10], en: 'Sufri Dates', descAr: 'صفري', descEn: 'Sufri' },
  { slug: 'shalabi', ar: 'تمر شلبي', sizes: [8, 12], en: 'Shalabi Dates', descAr: 'شلبي', descEn: 'Shalabi' },
  { slug: 'mashrouq', ar: 'تمر مشروق', sizes: [10, 12], en: 'Mashrouq Dates', descAr: 'مشروق', descEn: 'Mashrouq' },
  { slug: 'rashoudiya', ar: 'تمر رشودية', sizes: [8], en: 'Rashoudiya Dates', descAr: 'رشودية', descEn: 'Rashoudiya' },
  { slug: 'rabia', ar: 'تمر ربيعة', sizes: [8, 10], en: 'Rabia Dates', descAr: 'ربيعة', descEn: 'Rabia' },
  { slug: 'beidh', ar: 'تمر بيض', sizes: [6], en: 'Beidh Dates', descAr: 'بيض', descEn: 'Beidh' }
];

  /* بناء قائمة المنتجات: كل خيار (حجم) منتج مستقل بمعرّف فريد */
  const products = [];
  VARIETIES.forEach((v) => {
    (v.sizes || SIZES).forEach((size) => {
      products.push({
        id: `${v.slug}-${size}`,
        slug: v.slug,
        size,
        price: size,
        typeAr: v.ar,
        typeEn: v.en,
        descAr: v.descAr,
        descEn: v.descEn,
        origin: v.origin,
        image: `assets/dates/${v.slug}.svg`,
      });
    });
  });

  return { sizes: SIZES, varieties: VARIETIES, products };
});
