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

  const SIZES = [5, 10, 15];

  const VARIETIES = [
    { slug: 'ajwa',     ar: 'تمر عجوة',sizes: [9, 12, 20],   en: 'Ajwa Dates',     descAr: 'تمر داكن غني بنكهة حلوة زهرية مميزة، من أشهر تمور المدينة المنورة.', descEn: 'Dark, soft dates with a rich caramel note — a timeless favourite.', origin: 'Madinah' },
    { slug: 'sukkari',  ar: 'تمر سكري',sizes: [8, 13, 16],  en: 'Sukkari Dates',  descAr: 'تمر ذهبي ناعم بقوام كريمي وحلاوة عالية، يُفضّل تقديمه في المجالس.', descEn: 'Soft golden dates with a creamy texture and outstanding sweetness.', origin: 'Al-Qassim' },
    { slug: 'khalas',   ar: 'تمر خلاص',sizes: [7, 12, 15],   en: 'Khalas Dates',   descAr: 'تمر كهرماني متوسط الحلاوة بقوام مرن ومذاق متوازن وممتاز.', descEn: 'Amber dates with balanced sweetness and a beautifully firm bite.', origin: 'Al-Qassim' },
    { slug: 'sagai',    ar: 'تمر صقعي',sizes: [6, 10, 18],   en: 'Sagai Dates',    descAr: 'تمر فاتح اللون عالي الحلاوة خفيف اللب، من أنعم تمور المنطقة الشرقية.', descEn: 'Light-coloured, high-sugar dates with a delicate, melt-in-mouth texture.', origin: 'Eastern Province' },
    { slug: 'medjool',  ar: 'تمر مجدول',  en: 'Medjool Dates',  descAr: 'أكبر تمور العالم حجمًا، غني بنكهة الكراميل، خيار ممتاز للتجارة الفاخرة.', descEn: 'Large, premium-grade dates with deep caramel notes, a top pick for trade.', origin: 'Premium Import' },
    { slug: 'safawi',   ar: 'تمر صفاوي',  en: 'Safawi Dates',   descAr: 'تمر بني داكن متوسط الحلاوة، مناسب للسوق التجاري والأكل اليومي.', descEn: 'Dark brown dates, moderately sweet — a reliable commercial staple.', origin: 'Madinah' },
    { slug: 'barhi',    ar: 'تمر برحي',   en: 'Barhi Dates',    descAr: 'تمر أصفر ذهبي ناعم بقوام كريمي، من أجمل تمور الخليج.', descEn: 'Golden, tender dates with a buttery melt — a Gulf classic.', origin: 'Eastern Province' },
    { slug: 'ruthana',  ar: 'تمر روثانة',  en: 'Ruthana Dates',  descAr: 'تمر أصفر ذهبي متوسط الحلاوة بقوام مميز وتجارة توازن ممتاز.', descEn: 'Golden dates with a signature texture and superb value for trade.', origin: 'Al-Qassim' },
    { slug: 'anbara',   ar: 'تمر عنبرة',  en: 'Anbara Dates',   descAr: 'تمر أسود بلمعة داكنة وحلاوة قوية، يُستخدم في الأطباق والضيافة.', descEn: 'Glossy dark dates with intense sweetness, ideal for platters.', origin: 'Eastern Province' },
    { slug: 'mabroom',  ar: 'تمر مبروم',   en: 'Mabroom Dates',  descAr: 'تمر بني فاتح قليل الحلاوة بقوام صلب، مثالي للتعبئة والتخزين.', descEn: 'Light brown, low-moisture dates built for packing and storage.', origin: 'Al-Qassim' },
    { slug: 'khudri',   ar: 'تمر خضري',   en: 'Khudri Dates',   descAr: 'تمر أصفر ذهبي متوسط الحلاوة، طلب مرتفع في أسواق التجزئة.', descEn: 'Golden dates with medium sweetness — high demand in retail.', origin: 'Al-Qassim' },
    { slug: 'shishi',   ar: 'تمر شيشي',   en: 'Shishi Dates',   descAr: 'تمر فاتح مطاطي بحلاوة متوسطة، اقتصادي ومناسب للكمية.', descEn: 'Light, chewy dates with moderate sweetness — excellent value.', origin: 'Asir' },
    { slug: 'mutulawa', ar: 'تمر مطولا',  en: 'Mutulawa Dates', descAr: 'تمر فاتح ناعم مقاوم للكراميل، يحتفظ بشكله عند التحميص.', descEn: 'Pale, tender dates that keep their shape when roasted.', origin: 'Al-Qassim' },
    { slug: 'wargah',   ar: 'تمر ورقي',   en: 'Wargah Dates',   descAr: 'تمر ورقي ذهبي بقوام مطاطي خفيف الحلاوة، منتج تصنيعي ممتاز.', descEn: 'Golden, paper-thin dates with a light chew and low sweetness.', origin: 'Eastern Province' },
    { slug: 'rabi',     ar: 'تمر الربيع',  en: 'Rabi Dates',     descAr: 'تمر برتقالي ذهبي متوسط الحجم، جودة ثابتة وطعم لذيذ.', descEn: 'Golden-orange dates of consistent quality with a clean taste.', origin: 'Al-Qassim' },
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
