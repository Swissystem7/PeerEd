// PeerEd — i18n Internationalization Strings Module (Refs #325)
// Supports Hebrew (default, RTL), Arabic (RTL), and Russian (LTR).
// Translations in Arabic and Russian are marked as needing native-speaker review.
// Zero dependencies, deterministic, 100% key parity required.

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PeerEdI18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEFAULT_LANGUAGE = 'he';
  var SUPPORTED_LANGUAGES = ['he', 'ar', 'ru'];

  var LANG_META = {
    he: { code: 'he', dir: 'rtl', label: 'עברית', needsNativeReview: false },
    ar: { code: 'ar', dir: 'rtl', label: 'العربية', needsNativeReview: true },
    ru: { code: 'ru', dir: 'ltr', label: 'Русский', needsNativeReview: true }
  };

  var STRINGS = {
    he: {
      appName: 'PeerEd',
      tagline: 'שידוך סטודנטים לתלמידים לפי אזור, זמינות ומקצוע. בלי פרטים אישיים, בלי שרת.',
      tabPeople: 'אנשים',
      tabMatch: 'שידוך',
      tabPrivacy: 'פרטיות',
      tabUnits: 'יחידות',
      tabSessions: 'שיעורים',
      addPerson: 'הוספת משתתף',
      role: 'תפקיד',
      roleStudent: 'סטודנט חונך',
      rolePupil: 'תלמיד',
      region: 'אזור',
      subjects: 'מקצועות',
      hours: 'שעות פנויות',
      runMatch: 'הפעל שידוך',
      clearForm: 'נקה',
      save: 'שמור',
      cancel: 'ביטול',
      delete: 'מחק',
      exportCsv: 'ייצוא CSV',
      wipeData: 'מחק את כל הנתונים'
    },
    ar: {
      appName: 'PeerEd',
      tagline: 'مطابقة الطلاب مع التلاميذ حسب المنطقة والتوفر والموضوع. بدون بيانات شخصية، بدون خادم.',
      tabPeople: 'الأشخاص',
      tabMatch: 'المطابقة',
      tabPrivacy: 'الخصوصية',
      tabUnits: 'الوحدات',
      tabSessions: 'الجلسات',
      addPerson: 'إضافة مشارك',
      role: 'الدور',
      roleStudent: 'طالب مرشد',
      rolePupil: 'تلميذ',
      region: 'المنطقة',
      subjects: 'المواضيع',
      hours: 'الأوقات المتاحة',
      runMatch: 'بدء المطابقة',
      clearForm: 'مسح',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      exportCsv: 'تصدير CSV',
      wipeData: 'مسح كافة البيانات'
    },
    ru: {
      appName: 'PeerEd',
      tagline: 'Подбор студентов для школьников по региону, доступности и предмету. Без личных данных, без сервера.',
      tabPeople: 'Люди',
      tabMatch: 'Подбор',
      tabPrivacy: 'Приватность',
      tabUnits: 'Уроки',
      tabSessions: 'Сессии',
      addPerson: 'Добавить участника',
      role: 'Роль',
      roleStudent: 'Студент-наставник',
      rolePupil: 'Ученик',
      region: 'Регион',
      subjects: 'Предметы',
      hours: 'Доступные часы',
      runMatch: 'Запустить подбор',
      clearForm: 'Очистить',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      exportCsv: 'Экспорт CSV',
      wipeData: 'Удалить все данные'
    }
  };

  function getLanguageMeta(code) {
    return LANG_META[code] || LANG_META[DEFAULT_LANGUAGE];
  }

  function t(key, lang) {
    var l = lang && STRINGS[lang] ? lang : DEFAULT_LANGUAGE;
    if (STRINGS[l] && typeof STRINGS[l][key] === 'string') {
      return STRINGS[l][key];
    }
    return STRINGS[DEFAULT_LANGUAGE][key] || key;
  }

  function getAllKeys() {
    return Object.keys(STRINGS[DEFAULT_LANGUAGE]);
  }

  function verifyLanguageParity() {
    var baseKeys = getAllKeys();
    var missing = {};
    var isOk = true;

    SUPPORTED_LANGUAGES.forEach(function (lang) {
      if (lang === DEFAULT_LANGUAGE) return;
      var langMissing = [];
      baseKeys.forEach(function (k) {
        if (!STRINGS[lang] || typeof STRINGS[lang][k] !== 'string' || STRINGS[lang][k].trim() === '') {
          langMissing.push(k);
        }
      });
      if (langMissing.length > 0) {
        missing[lang] = langMissing;
        isOk = false;
      }
    });

    return {
      ok: isOk,
      missingKeys: missing
    };
  }

  return {
    DEFAULT_LANGUAGE: DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES: SUPPORTED_LANGUAGES,
    LANG_META: LANG_META,
    STRINGS: STRINGS,
    getLanguageMeta: getLanguageMeta,
    t: t,
    getAllKeys: getAllKeys,
    verifyLanguageParity: verifyLanguageParity
  };
});
