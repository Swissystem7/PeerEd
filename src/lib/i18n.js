// PeerEd — i18n Internationalization Strings Module (Refs #325, PE-410)
// Supports Hebrew (default, RTL), Arabic (RTL), and Russian (LTR).
// Translations in Arabic and Russian are marked as needing native-speaker review.
// Zero dependencies, deterministic, 100% key parity required.
//
// PE-410: full ar/ru string sets for every UI string in this table, language
// selector support (he/ar/ru), RTL for Arabic, LTR for Russian, Hebrew default.
// TODO(native-review): ar/ru phrasing for consent, matching and privacy terms
// is natural but awaits a native-speaker pass — see PR body for the list.

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
      headerTagline: 'מחבר סטודנטים לתלמידי תיכון לפי אזור, זמינות ומקצוע. בלי שם, בלי טלפון, בלי מייל.',
      langLabel: 'שפה',
      tabPeople: 'אנשים',
      tabMatch: 'שידוך',
      tabPrivacy: 'פרטיות',
      tabUnits: 'יחידות',
      tabSessions: 'שיעורים',
      addPerson: 'הוספת משתתף',
      addBtn: 'הוסף',
      demoBtn: 'טען דוגמה',
      participantsHeading: 'המשתתפים',
      wipeHeading: 'מחיקה מהמכשיר הזה',
      wipeBtn: 'מחק הכול מהמכשיר הזה',
      wipeConfirmBtn: 'כן, מחק הכול',
      cancelBtn: 'ביטול',
      role: 'תפקיד',
      roleStudent: 'סטודנט מלמד',
      rolePupil: 'תלמיד',
      region: 'אזור',
      subjects: 'מקצועות',
      hours: 'שעות פנויות',
      hoursHint: 'לוחצים על משבצת יום ושעה. אפשר לבחור כמה שרוצים.',
      consentLabel: 'התקבל אישור הורה לשידוך',
      runMatch: 'הפעל שידוך',
      runMatchBtn: 'חשב שידוך',
      clearForm: 'נקה',
      save: 'שמור',
      cancel: 'ביטול',
      delete: 'מחק',
      exportCsv: 'ייצוא CSV',
      exportPairsBtn: 'הורד זוגות (CSV)',
      exportSummaryBtn: 'הורד סיכום לרשות (CSV)',
      wipeData: 'מחק את כל הנתונים',
      matchHeading: 'שידוך',
      summaryHeading: 'סיכום לרשות',
      pairsHeading: 'הזוגות',
      unmatchedHeading: 'מי נשאר בלי זוג',
      acrossHeading: 'שידוך בין אזורים (חירום)',
      textDemoHeading: 'הדגמה: שער הטקסט',
      checkTextLabel: 'טקסט לבדיקה',
      checkBtn: 'בדוק',
      loadPersonalDemo: 'טען דוגמה עם פרטים אישיים',
      loadRudeDemo: 'טען דוגמה עם שפה פוגענית',
      clearTextBtn: 'נקה טקסט',
      gateDemoHeading: 'הדגמה: שדה אסור נדחה',
      gateBtn: 'נסה לשמור עם טלפון',
      submitUnitHeading: 'הגשת יחידה (מורה)',
      unitTitleLabel: 'כותרת (שורה אחת)',
      unitBodyLabel: 'תוכן היחידה',
      unitDurationLabel: 'משך בדקות (5–60)',
      submitUnitBtn: 'הגש לאישור',
      clearUnitBtn: 'נקה טופס',
      pendingHeading: 'ממתינות לאישור',
      approvedHeading: 'מאושרות — מה שתלמיד רואה',
      rejectedHeading: 'נדחו',
      logSessionHeading: 'רישום שיעור',
      pairLabel: 'זוג',
      slotLabel: 'שעה',
      approvedUnitLabel: 'יחידה מאושרת',
      outcomeLabel: 'איך הסתיים',
      logSessionBtn: 'רשום שיעור',
      sessionSummaryHeading: 'סיכום לרשות — ספירות בלבד',
      exportReportBtn: 'ייצא דוח CSV',
      logHeading: 'היומן',
      contactHeading: 'רוצים לנסות בסבב השיבוץ שלכם?',
      approveBtn: 'אשר',
      rejectBtn: 'דחה',
      reviseBtn: 'טען לטופס לעריכה',
      emptyAfterMatch: 'מופיע אחרי חישוב שידוך.',
      minutesUnit: 'דקות',
      versionLabel: 'גרסה',
      noPairs: 'לא נוצר אף זוג.',
      allMatched: 'כולם שובצו.',
      matchAiOnlyFilter: 'התאמת AI בלבד',
      matchAiOnlyEmpty: 'אין שידוכים עם חפיפת AI',
      'match.aiOnlyFilter': 'התאמת AI בלבד',
      'match.aiOnlyEmpty': 'אין שידוכים עם חפיפת AI',
      peopleMissingAiFilter: 'ללא נושאי AI',
      'people.missingAiFilter': 'ללא נושאי AI',
      sharedSubjects: 'מקצועות משותפים',
      sharedHours: 'שעות משותפות',
      outcomeHeld: 'התקיים',
      outcomeMissed: 'לא התקיים',
      outcomeCutShort: 'נקטע באמצע',
      regionNORTH: 'צפון',
      regionHAIFA: 'חיפה',
      regionCENTER: 'מרכז',
      regionTEL_AVIV: 'תל אביב',
      regionJERUSALEM: 'ירושלים',
      regionSOUTH: 'דרום',
      subjectMATH: 'מתמטיקה',
      subjectPHYSICS: 'פיזיקה',
      subjectCHEMISTRY: 'כימיה',
      subjectBIOLOGY: 'ביולוגיה',
      subjectENGLISH: 'אנגלית',
      subjectHEBREW: 'עברית',
      subjectHISTORY: 'היסטוריה',
      subjectCS: 'מדעי המחשב',
      subjectCIVICS: 'אזרחות'
    },
    ar: {
      appName: 'PeerEd',
      tagline: 'مطابقة الطلاب مع التلاميذ حسب المنطقة والتوفر والموضوع. بدون بيانات شخصية، بدون خادم.',
      headerTagline: 'نصل الطلاب بتلاميذ المدارس الثانوية حسب المنطقة والتوفر والموضوع. بلا اسم، بلا هاتف، بلا بريد إلكتروني.',
      langLabel: 'اللغة',
      tabPeople: 'الأشخاص',
      tabMatch: 'المطابقة',
      tabPrivacy: 'الخصوصية',
      tabUnits: 'الوحدات',
      tabSessions: 'الجلسات',
      addPerson: 'إضافة مشارك',
      addBtn: 'إضافة',
      demoBtn: 'تحميل مثال',
      participantsHeading: 'المشاركون',
      wipeHeading: 'الحذف من هذا الجهاز',
      wipeBtn: 'حذف كل شيء من هذا الجهاز',
      wipeConfirmBtn: 'نعم، احذف كل شيء',
      cancelBtn: 'إلغاء',
      role: 'الدور',
      roleStudent: 'طالب مرشد',
      rolePupil: 'تلميذ',
      region: 'المنطقة',
      subjects: 'المواضيع',
      hours: 'الأوقات المتاحة',
      hoursHint: 'اضغط على خانة اليوم والساعة. يمكنك اختيار ما تشاء.',
      consentLabel: 'تم الحصول على موافقة ولي الأمر للمطابقة',
      runMatch: 'بدء المطابقة',
      runMatchBtn: 'حساب المطابقة',
      clearForm: 'مسح',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      exportCsv: 'تصدير CSV',
      exportPairsBtn: 'تنزيل الأزواج (CSV)',
      exportSummaryBtn: 'تنزيل ملخص للسلطة (CSV)',
      wipeData: 'مسح كافة البيانات',
      matchHeading: 'المطابقة',
      summaryHeading: 'ملخص للسلطة',
      pairsHeading: 'الأزواج',
      unmatchedHeading: 'من بقي دون زوج',
      acrossHeading: 'مطابقة بين المناطق (طارئة)',
      textDemoHeading: 'عرض توضيحي: بوابة النص',
      checkTextLabel: 'نص للفحص',
      checkBtn: 'فحص',
      loadPersonalDemo: 'تحميل مثال ببيانات شخصية',
      loadRudeDemo: 'تحميل مثال بلغة مسيئة',
      clearTextBtn: 'مسح النص',
      gateDemoHeading: 'عرض توضيحي: رفض حقل ممنوع',
      gateBtn: 'حاول الحفظ برقم هاتف',
      submitUnitHeading: 'تقديم وحدة (معلم)',
      unitTitleLabel: 'العنوان (سطر واحد)',
      unitBodyLabel: 'محتوى الوحدة',
      unitDurationLabel: 'المدة بالدقائق (5–60)',
      submitUnitBtn: 'إرسال للموافقة',
      clearUnitBtn: 'مسح النموذج',
      pendingHeading: 'بانتظار الموافقة',
      approvedHeading: 'الموافق عليها — ما يراه التلميذ',
      rejectedHeading: 'المرفوضة',
      logSessionHeading: 'تسجيل جلسة',
      pairLabel: 'زوج',
      slotLabel: 'الساعة',
      approvedUnitLabel: 'وحدة معتمدة',
      outcomeLabel: 'كيف انتهت',
      logSessionBtn: 'تسجيل الجلسة',
      sessionSummaryHeading: 'ملخص للسلطة — أعداد فقط',
      exportReportBtn: 'تصدير تقرير CSV',
      logHeading: 'السجل',
      contactHeading: 'هل تريد التجربة في جولة التوزيع لديك؟',
      approveBtn: 'موافقة',
      rejectBtn: 'رفض',
      reviseBtn: 'تحميل للتحرير',
      emptyAfterMatch: 'يظهر بعد حساب المطابقة.',
      minutesUnit: 'دقائق',
      versionLabel: 'إصدار',
      noPairs: 'لم يتكون أي زوج.',
      allMatched: 'تم إقران الجميع.',
      matchAiOnlyFilter: 'تطابق الذكاء الاصطناعي فقط',
      matchAiOnlyEmpty: 'لا توجد مطابقات بتطابق الذكاء الاصطناعي',
      'match.aiOnlyFilter': 'تطابق الذكاء الاصطناعي فقط',
      'match.aiOnlyEmpty': 'لا توجد مطابقات بتطابق الذكاء الاصطناعي',
      peopleMissingAiFilter: 'بدون مواضيع ذكاء اصطناعي',
      'people.missingAiFilter': 'بدون مواضيع ذكاء اصطناعي',
      sharedSubjects: 'مواضيع مشتركة',
      sharedHours: 'ساعات مشتركة',
      outcomeHeld: 'عُقدت',
      outcomeMissed: 'لم تُعقد',
      outcomeCutShort: 'توقفت في المنتصف',
      regionNORTH: 'الشمال',
      regionHAIFA: 'حيفا',
      regionCENTER: 'المركز',
      regionTEL_AVIV: 'تل أبيب',
      regionJERUSALEM: 'القدس',
      regionSOUTH: 'الجنوب',
      subjectMATH: 'رياضيات',
      subjectPHYSICS: 'فيزياء',
      subjectCHEMISTRY: 'كيمياء',
      subjectBIOLOGY: 'أحياء',
      subjectENGLISH: 'إنجليزية',
      subjectHEBREW: 'عبرية',
      subjectHISTORY: 'تاريخ',
      subjectCS: 'علوم الحاسوب',
      subjectCIVICS: 'مدنيات'
    },
    ru: {
      appName: 'PeerEd',
      tagline: 'Подбор студентов для школьников по региону, доступности и предмету. Без личных данных, без сервера.',
      headerTagline: 'Соединяем студентов со школьниками по региону, доступности и предмету. Без имени, без телефона, без почты.',
      langLabel: 'Язык',
      tabPeople: 'Люди',
      tabMatch: 'Подбор',
      tabPrivacy: 'Приватность',
      tabUnits: 'Уроки',
      tabSessions: 'Сессии',
      addPerson: 'Добавить участника',
      addBtn: 'Добавить',
      demoBtn: 'Загрузить пример',
      participantsHeading: 'Участники',
      wipeHeading: 'Удаление с этого устройства',
      wipeBtn: 'Удалить всё с этого устройства',
      wipeConfirmBtn: 'Да, удалить всё',
      cancelBtn: 'Отмена',
      role: 'Роль',
      roleStudent: 'Студент-наставник',
      rolePupil: 'Ученик',
      region: 'Регион',
      subjects: 'Предметы',
      hours: 'Доступные часы',
      hoursHint: 'Нажимайте на ячейку дня и часа. Можно выбрать сколько угодно.',
      consentLabel: 'Получено согласие родителя на подбор',
      runMatch: 'Запустить подбор',
      runMatchBtn: 'Рассчитать подбор',
      clearForm: 'Очистить',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      exportCsv: 'Экспорт CSV',
      exportPairsBtn: 'Скачать пары (CSV)',
      exportSummaryBtn: 'Скачать сводку для ведомства (CSV)',
      wipeData: 'Удалить все данные',
      matchHeading: 'Подбор',
      summaryHeading: 'Сводка для ведомства',
      pairsHeading: 'Пары',
      unmatchedHeading: 'Кто остался без пары',
      acrossHeading: 'Подбор между регионами (экстренно)',
      textDemoHeading: 'Демо: текстовый фильтр',
      checkTextLabel: 'Текст для проверки',
      checkBtn: 'Проверить',
      loadPersonalDemo: 'Пример с личными данными',
      loadRudeDemo: 'Пример с грубой лексикой',
      clearTextBtn: 'Очистить текст',
      gateDemoHeading: 'Демо: запрещённое поле отклоняется',
      gateBtn: 'Попробовать сохранить с телефоном',
      submitUnitHeading: 'Отправка урока (учитель)',
      unitTitleLabel: 'Заголовок (одна строка)',
      unitBodyLabel: 'Содержание урока',
      unitDurationLabel: 'Длительность в минутах (5–60)',
      submitUnitBtn: 'Отправить на утверждение',
      clearUnitBtn: 'Очистить форму',
      pendingHeading: 'Ожидают утверждения',
      approvedHeading: 'Утверждено — что видит ученик',
      rejectedHeading: 'Отклонено',
      logSessionHeading: 'Запись занятия',
      pairLabel: 'Пара',
      slotLabel: 'Время',
      approvedUnitLabel: 'Утверждённый урок',
      outcomeLabel: 'Как закончилось',
      logSessionBtn: 'Записать занятие',
      sessionSummaryHeading: 'Сводка для ведомства — только числа',
      exportReportBtn: 'Экспорт отчёта CSV',
      logHeading: 'Журнал',
      contactHeading: 'Хотите попробовать в своём раунде распределения?',
      approveBtn: 'Утвердить',
      rejectBtn: 'Отклонить',
      reviseBtn: 'Загрузить для правки',
      emptyAfterMatch: 'Появится после расчёта подбора.',
      minutesUnit: 'минут',
      versionLabel: 'Версия',
      noPairs: 'Ни одной пары не создано.',
      allMatched: 'Все распределены по парам.',
      matchAiOnlyFilter: 'Только совпадения ИИ',
      matchAiOnlyEmpty: 'Нет совпадений по темам ИИ',
      'match.aiOnlyFilter': 'Только совпадения ИИ',
      'match.aiOnlyEmpty': 'Нет совпадений по темам ИИ',
      peopleMissingAiFilter: 'Без тем ИИ',
      'people.missingAiFilter': 'Без тем ИИ',
      sharedSubjects: 'Общие предметы',
      sharedHours: 'Общие часы',
      outcomeHeld: 'Состоялось',
      outcomeMissed: 'Не состоялось',
      outcomeCutShort: 'Прервано',
      regionNORTH: 'Север',
      regionHAIFA: 'Хайфа',
      regionCENTER: 'Центр',
      regionTEL_AVIV: 'Тель-Авив',
      regionJERUSALEM: 'Иерусалим',
      regionSOUTH: 'Юг',
      subjectMATH: 'Математика',
      subjectPHYSICS: 'Физика',
      subjectCHEMISTRY: 'Химия',
      subjectBIOLOGY: 'Биология',
      subjectENGLISH: 'Английский',
      subjectHEBREW: 'Иврит',
      subjectHISTORY: 'История',
      subjectCS: 'Информатика',
      subjectCIVICS: 'Гражданское образование'
    }
  };

  function getLanguageMeta(code) {
    return LANG_META[code] || LANG_META[DEFAULT_LANGUAGE];
  }

  function dirFor(code) {
    return getLanguageMeta(code).dir;
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
    dirFor: dirFor,
    t: t,
    getAllKeys: getAllKeys,
    verifyLanguageParity: verifyLanguageParity
  };
});
