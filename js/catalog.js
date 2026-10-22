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

const أنواع_ثابت = [
  { slug:'ajwa', ar:'تمر عجوة', sizes:[12, 15, 18, 22], img:'assets/ajwa.jpg' },
  { slug:'sukari', ar:'تمر سكري', sizes:[10, 12], img:'assets/sukari.jpg' },
  { slug:'sukari-mufattal', ar:'تمر سكري مفتل', sizes:[25, 30], img:'assets/sukari-mufattal.jpg' },
  { slug:'majdool', ar:'تمر مجدول', sizes:[12, 15, 20], img:'assets/majdool.jpg' },
  { slug:'safawi', ar:'تمر صفاوي', sizes:[10, 12, 14], img:'assets/safawi.jpg' },
  { slug:'anbar', ar:'تمر عنبرا', sizes:[12, 16, 20], img:'assets/anbar.jpg' },
  { slug:'mabroom', ar:'تمر مبروم', sizes:[14, 18, 22], img:'assets/mabroom.jpg' },
  { slug:'sagai', ar:'تمر صقعي', sizes:[8, 10, 12, 14], img:'assets/sagai.jpg' },
  { slug:'sufri', ar:'تمر صفري', sizes:[10], img:'assets/sufri.jpg' },
  { slug:'shishi', ar:'تمر شيشي', sizes:[8, 12], img:'assets/shishi.jpg' },
  { slug:'mashrook', ar:'تمر مشروك', sizes:[10, 12], img:'assets/mashrook.jpg' },
  { slug:'ruthob', ar:'تمر رطيب', sizes:[8], img:'assets/ruthob.jpg' },
  { slug:'rabia', ar:'تمر ربيعة', sizes:[8, 10], img:'assets/rabia.jpg' },
  { slug:'beidh', ar:'تمر بيض', sizes:[6], img:'assets/beidh.jpg' },
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
