
// PeerEd - lesson content: engineering students (mentors) teach children AI (stage 10).
// Two tracks, about 12 lessons each, 45 minutes a lesson. Hebrew first; every lesson title
// also has an i18n key (cur.*) translated in lang-he/lang-ar/lang-ru for ar/ru. Content only:
// no child personal data, no network, no clock, no randomness. A group's track is passed in
// by the caller (trackByPair); the module never invents a track for a group it does not know.

const { assertCleanText } = require('./validator.js');
const { AI_TOPIC_KEYS } = require('./attendance.js');

const TRACKS = Object.freeze(['elementary', 'middle']);
const TRACK_GRADES = Object.freeze({ elementary: Object.freeze([3, 4, 5, 6]), middle: Object.freeze([7, 8, 9]) });
const _LESSON_MINUTES = 45;

function lesson(track, spec) {
  const { index, slug, titleHe, goalsHe, flowHe, activityHe, unpluggedHe, materialsHe, wrapUpHe } = spec;
  return Object.freeze({
    id: `${track}-${slug}`, track, index,
    titleKey: `cur.${track}.${slug}`, titleHe,
    goalsHe: Object.freeze(goalsHe.slice()),
    flowHe: Object.freeze(flowHe.map((f) => Object.freeze({ minutes: f[0], stepHe: f[1] }))),
    activityHe, unpluggedHe,
    materialsHe: Object.freeze(materialsHe.slice()),
    wrapUpHe: Object.freeze(wrapUpHe.slice())
  });
}

const ELEMENTARY = Object.freeze([
  lesson('elementary', {
    index: 0,
    slug: 'what-is-ai',
    titleHe: 'מה זו בינה מלאכותית?',
    goalsHe: ['להבחין בין מכונה רגילה למכונה שלומדת', 'לתת דוגמה אחת של בינה מלאכותית מהבית'],
    flowHe: [[5, 'פתיחה: מציגים שני חפצים ושואלים מה ההבדל בין מנורה למצלמה שמזהה פנים'], [10, 'הסבר קצר עם כרטיסיות: מכונה פועלת לפי הוראות, מכונה לומדת מדוגמאות'], [20, 'פעילות: משחק מיון - התלמידים ממיינים כרטיסיות למשימה שמכונה יודעת ולמשימה שלא'], [10, 'סיכום ושאלות הבנה בזוגות']],
    activityHe: 'משחק מיון כרטיסיות: כל זוג ממיין משימות ומנמק בקול.',
    unpluggedHe: 'בלי מחשב: התלמידים הם המכונה - אחד נותן הוראות מדויקות והשני מבצע בדיוק, ומגלים למה הוראות מעורפלות נכשלות.',
    materialsHe: ['כרטיסיות משימות', 'לוח וטוש'],
    wrapUpHe: ['מה ההבדל בין הוראה לדוגמה?', 'איזו משימה הייתם מלמדים מכונה קודם?']
  }),
  lesson('elementary', {
    index: 1,
    slug: 'learn-examples',
    titleHe: 'למידה מדוגמאות',
    goalsHe: ['להבין שמכונה לומדת מהרבה דוגמאות', 'להבחין בין דוגמה טובה לרועשת'],
    flowHe: [[5, 'פתיחה: מראים תמונה אחת של חתול ושואלים אם מספיקה דוגמה אחת'], [10, 'הסבר: מלמדים מכונה עם עשר דוגמאות ומסבירים למה צריך הרבה'], [20, 'פעילות: מאמנים בן זוג - מראים כרטיסי צורות והוא מנחש את הכלל'], [10, 'סיכום: מה קורה כשכל הדוגמאות דומות מדי']],
    activityHe: 'אימון בזוגות: מדריך כרטיסים מלמד כלל סודי ובן הזוג מנחש, ואז מחליפים תפקידים.',
    unpluggedHe: 'אותה פעילות בכרטיסי נייר בלבד, בלי מסך: הכלל הסודי כתוב על פתק מקופל.',
    materialsHe: ['כרטיסי צורות', 'פתקי כלל'],
    wrapUpHe: ['למה דוגמה אחת לא מספיקה?', 'מהי דוגמה שמבלבלת מכונה?']
  }),
  lesson('elementary', {
    index: 2,
    slug: 'image-recognition',
    titleHe: 'זיהוי תמונות ודפוסים',
    goalsHe: ['להבין איך מכונה מזהה תמונה לפי חלקים ודפוסים', 'להסביר למה זיהוי לפעמים טועה'],
    flowHe: [[5, 'פתיחה: מנחשים חפץ מתמונה חתוכה לחלקים'], [10, 'הסבר: מכונה מחפשת קצוות, צורות וצבעים ואז מנחשת'], [20, 'פעילות: מציירים אותה חיה בסגנונות שונים ובודקים אם הכיתה מזהה'], [10, 'סיכום: מתי הזיהוי נכשל - חושך, הסתרה, זווית מוזרה']],
    activityHe: 'ציור ובדיקה: כל תלמיד מצייר חיה והכיתה מנחשת, עם רמזים מהחלקים.',
    unpluggedHe: 'בלי מחשב: משחק עשרים שאלות על תמונה מוסתרת - שואלים רק על חלקים ודפוסים.',
    materialsHe: ['דפי ציור', 'תמונות חתוכות מודפסות'],
    wrapUpHe: ['איך מכונה יודעת שזה חתול?', 'מתי גם אנחנו טועים בזיהוי?']
  }),
  lesson('elementary', {
    index: 3,
    slug: 'chatbots',
    titleHe: 'צ׳אטבוטים ושיחה עם מכונה',
    goalsHe: ['להבין שצ׳אטבוט בונה תשובה ממילים ולא חושב כמו אדם', 'לנסח שאלה ברורה למכונה'],
    flowHe: [[5, 'פתיחה: קוראים שיחה מצחיקה עם מכונה ושואלים מה חסר בה'], [10, 'הסבר: המכונה משלימה את המילה הבאה הסבירה, בלי להבין באמת'], [20, 'פעילות: משחק השלמת משפטים שרשרת - בונים סיפור מילה אחרי מילה כמו מכונה'], [10, 'סיכום: למה תשובת מכונה יכולה להישמע בטוחה וגם לטעות']],
    activityHe: 'סיפור שרשרת: כל תלמיד מוסיף מילה אחת סבירה, ומקבלים סיפור מפתיע.',
    unpluggedHe: 'בלי מחשב: אחד משחק מכונה ועונה רק מהשלמת המילה הסבירה, והשאר מנסים לבלבל אותו בנימוס.',
    materialsHe: ['כרטיסי משפט פתיחה'],
    wrapUpHe: ['האם המכונה מבינה את הסיפור?', 'איך נשאל שאלה שהמכונה תענה עליה טוב?']
  }),
  lesson('elementary', {
    index: 4,
    slug: 'data-bias',
    titleHe: 'נתונים והוגנות',
    goalsHe: ['להבין שמכונה לומדת ממה שמראים לה', 'לזהות אימון לא הוגן שמפספס קבוצה שלמה'],
    flowHe: [[5, 'פתיחה: מלמדים כלל רק מדוגמאות של ילדים ושואלים מה עם מבוגרים'], [10, 'הסבר: אם הדוגמאות חד-צדדיות, המכונה תטעה על מי שלא הראה לה'], [20, 'פעילות: בונים ערכת אימון הוגנת ולא הוגנת לציור דמויות ומשווים תוצאות ניחוש'], [10, 'סיכום: הוגנות מתחילה במי שמראים למכונה']],
    activityHe: 'בניית ערכות: שתי קבוצות בונות דוגמאות שונות ובודקות זו את זו.',
    unpluggedHe: 'בלי מחשב: קופסת דוגמאות מנייר - מוציאים דוגמאות חד-צדדיות ורואים את הניחוש מוטה.',
    materialsHe: ['כרטיסי דמויות', 'שתי קופסאות'],
    wrapUpHe: ['למי המכונה תטעה אם לא הראו לה אותו?', 'איך עושים אימון הוגן יותר?']
  }),
  lesson('elementary', {
    index: 5,
    slug: 'safety-privacy',
    titleHe: 'בטיחות ופרטיות',
    goalsHe: ['לזהות מה לא משתפים עם מכונה או ברשת', 'לנסח כלל בטיחות אחד למשפחה'],
    flowHe: [[5, 'פתיחה: ממיינים כרטיסי מידע למה שמותר ומה שאסור לשתף'], [10, 'הסבר: מכונה שומרת מה שכותבים לה, ולכן לא כותבים פרטים אישיים'], [20, 'פעילות: בונים שלט כללי בטיחות לכיתה עם ציורים'], [10, 'סיכום ובחירת הכלל החשוב ביותר בהצבעה']],
    activityHe: 'מיון כרטיסים ובניית שלט כיתתי משותף.',
    unpluggedHe: 'בלי מחשב: משחק תפקידים - מה עונים למכונה ששואלת שאלה אישית מדי.',
    materialsHe: ['כרטיסי מידע', 'דף גדול וטושים'],
    wrapUpHe: ['מה לעולם לא נכתוב למכונה?', 'למי מספרים אם משהו מרגיש לא בטוח?']
  }),
  lesson('elementary', {
    index: 6,
    slug: 'creative-ai',
    titleHe: 'יצירה עם בינה מלאכותית',
    goalsHe: ['להבין שמכונה יכולה לעזור ליצור אבל הרעיון שלנו', 'לבנות יצירה משותפת אדם ומכונה בדמיון'],
    flowHe: [[5, 'פתיחה: משלימים ציור חצי גמור של חבר ושואלים מי היוצר'], [10, 'הסבר: מכונה מציעה המשכים, והאדם בוחר ועורך'], [20, 'פעילות: סיפור מאויר בזוגות - אחד מציע שלושה המשכים והשני בוחר וממשיך'], [10, 'סיכום: למה הבחירה האנושית היא היצירה']],
    activityHe: 'סיפור מאויר בזוגות עם בחירת המשכים.',
    unpluggedHe: 'בלי מחשב: קוביית רעיונות - מטילים ובונים המשך לסיפור לפי הפאה שיצאה.',
    materialsHe: ['דפים', 'צבעים', 'קובייה'],
    wrapUpHe: ['מי יצר את הסיפור, המציע או הבוחר?', 'מתי עזרת מכונה היא כבר לא היצירה שלי?']
  }),
  lesson('elementary', {
    index: 7,
    slug: 'good-questions',
    titleHe: 'שאלות טובות למכונה',
    goalsHe: ['לנסח בקשה ברורה עם פרטים חשובים', 'לשפר בקשה מעורפלת בשני צעדים'],
    flowHe: [[5, 'פתיחה: מבצעים הוראה מעורפלת וצוחקים מהתוצאה'], [10, 'הסבר: בקשה טובה אומרת מה, למי, באיזה אורך ובאיזה סגנון'], [20, 'פעילות: מתקנים בקשות מעורפלות על כרטיסים עד שהכיתה מבינה בדיוק'], [10, 'סיכום: בודקים בקשה מתוקנת על בן זוג אנושי']],
    activityHe: 'תיקון בקשות על כרטיסים בזוגות.',
    unpluggedHe: 'בלי מחשב: משחק ההוראות המדויקות - מציירים לפי הוראות של חבר בלי לראות את המקור.',
    materialsHe: ['כרטיסי בקשות מעורפלות'],
    wrapUpHe: ['מה הופך שאלה לברורה?', 'איזה פרט הכי חשוב להוסיף ראשון?']
  }),
  lesson('elementary', {
    index: 8,
    slug: 'ai-at-home',
    titleHe: 'בינה מלאכותית בבית ובבית הספר',
    goalsHe: ['לזהות בינה מלאכותית במכשירים יומיומיים', 'להחליט מתי עזרת מכונה מתאימה ומתי לא'],
    flowHe: [[5, 'פתיחה: סופרים כמה מכונות חכמות פגשנו מהבוקר'], [10, 'הסבר: המלצות, ניווט, תרגום ועוזרות קוליות - כולן מנחשות מדוגמאות'], [20, 'פעילות: מצביעים בכרטיסים על מצבים - מכונה עוזרת או עדיף לבד, ומנמקים'], [10, 'סיכום: שיעורי בית ולמידה - מה נשאר שלנו']],
    activityHe: 'הצבעת מצבים עם כרטיסי כן ולא ונימוקים.',
    unpluggedHe: 'בלי מחשב: ציד חפצים חכמים בציור של בית - מסמנים ומסבירים מה כל אחד מנחש.',
    materialsHe: ['כרטיסי הצבעה', 'ציור בית'],
    wrapUpHe: ['איפה מכונה עוזרת לכם הכי הרבה?', 'מה תמיד תעשו בעצמכם?']
  }),
  lesson('elementary', {
    index: 9,
    slug: 'robots-sensors',
    titleHe: 'חיישנים ורובוטים חכמים',
    goalsHe: ['להבין שרובוט חש בעזרת חיישנים ומחליט לפי כללים ולמידה', 'לתאר מסלול החלטה של רובוט'],
    flowHe: [[5, 'פתיחה: צועדים בעיניים עצומות לפי הוראות ושואלים מה חסר'], [10, 'הסבר: חיישן הוא העין והאוזן של הרובוט, והמוח מחליט מה לעשות'], [20, 'פעילות: מנווטים חבר רובוט במסלול מכשולים בהוראות צעד וסיבוב'], [10, 'סיכום: מה רובוט עדיין לא יודע לעשות']],
    activityHe: 'ניווט רובוט אנושי במסלול מכשולים בכיתה.',
    unpluggedHe: 'בלי מחשב: אותה פעילות היא הלא-מחוברת - רובוט הוא תלמיד, בלי שום מסך.',
    materialsHe: ['כיסאות כמכשולים', 'סרט סימון'],
    wrapUpHe: ['מהו חיישן?', 'איזו החלטה קשה לרובוט?']
  }),
  lesson('elementary', {
    index: 10,
    slug: 'truth-check',
    titleHe: 'בודקים אם זה אמיתי',
    goalsHe: ['לזהות תמונה או סיפור שמכונה המציאה', 'להשתמש בשתי בדיקות לפני שמאמינים'],
    flowHe: [[5, 'פתיחה: שתי תמונות, אחת מצוירת ואחת מומצאת, מנחשים איזו'], [10, 'הסבר: מכונות יכולות להמציא תמונות וסיפורים שנשמעים אמיתיים'], [20, 'פעילות: בלשי אמת - מחפשים שלושה רמזים חשודים בתמונות ובסיפורים קצרים'], [10, 'סיכום: שואלים מבוגר ובודקים במקום נוסף לפני שמשתפים']],
    activityHe: 'בלשי אמת בקבוצות: מוצאים רמזים חשודים ומציגים לכיתה.',
    unpluggedHe: 'בלי מחשב: סיפורים מודפסים, אחד אמיתי ואחד מומצא, מחפשים רמזים בטקסט בלבד.',
    materialsHe: ['תמונות מודפסות', 'סיפורים קצרים מודפסים'],
    wrapUpHe: ['מהו רמז שמשהו מומצא?', 'מה עושים לפני שמשתפים תמונה מפתיעה?']
  }),
  lesson('elementary', {
    index: 11,
    slug: 'mini-project',
    titleHe: 'מיני-פרויקט סיום: ממציאים עוזר חכם',
    goalsHe: ['לתכנן עוזר חכם שפותר בעיה אמיתית', 'להציג מה העוזר לומד ומה הוא לא ישתף לעולם'],
    flowHe: [[5, 'פתיחה: נזכרים בכל השיעורים ובוחרים בעיה אחת מהכיתה'], [15, 'תכנון בזוגות: מציירים את העוזר, מה הוא חש, ומאילו דוגמאות ילמד'], [15, 'בניית כרזה: שם, ציור, שלושה כללי הוגנות ובטיחות'], [10, 'הצגות קצרות ושאלה אחת מכל זוג למציגים']],
    activityHe: 'בניית כרזת עוזר חכם והצגה לכיתה.',
    unpluggedHe: 'בלי מחשב: כל הפרויקט על נייר - כרזה, ציור וכללים, בלי מסכים בכלל.',
    materialsHe: ['דפים גדולים', 'טושים וצבעים'],
    wrapUpHe: ['איזו בעיה העוזר שלכם פותר?', 'מאילו דוגמאות הוא ילמד כדי להיות הוגן?']
  })
]);

const MIDDLE = Object.freeze([
  lesson('middle', {
    index: 0,
    slug: 'what-is-ai',
    titleHe: 'מה זו בינה מלאכותית ולמידת מכונה',
    goalsHe: ['להבחין בין תוכנה מבוססת כללים למודל שלמד מנתונים', 'לתאר מחזור אימון: נתונים, אימון, בדיקה'],
    flowHe: [[5, 'פתיחה: שני פתרונות לאותה בעיה - כללים ידניים מול למידה מדוגמאות'], [12, 'הסבר: מודל, נתוני אימון וטעות - איך מודל משתפר מהרבה ניסיונות'], [18, 'פעילות: ממיינים מערכות מוכרות לכללים או ללמידה ומנמקים'], [10, 'סיכום: מתי כללים עדיפים ומתי למידה']],
    activityHe: 'מיון מערכות ונימוק בקבוצות, עם הגנה על בחירה אחת מול הכיתה.',
    unpluggedHe: 'בלי מחשב: בניית מסווג אנושי - כללים כתובים על לוח מול ניחוש מדוגמאות בכרטיסים.',
    materialsHe: ['כרטיסי מערכות', 'לוח'],
    wrapUpHe: ['מה ההבדל בין כלל למודל?', 'מתי לא הייתם סומכים על למידה?']
  }),
  lesson('middle', {
    index: 1,
    slug: 'training-data',
    titleHe: 'למידה מדוגמאות ונתוני אימון',
    goalsHe: ['להסביר אימון, אימות ובדיקה ומהי התאמת-יתר בפשטות', 'לבנות ערכת דוגמאות מאוזנת למשימה'],
    flowHe: [[5, 'פתיחה: מודל שנבחן על אותן שאלות שלמד - למה זה לא הוגן'], [12, 'הסבר: חלוקת נתונים לאימון ובדיקה, וטעויות משני הסוגים'], [18, 'פעילות: בונים ערכת אימון למסווג ציורים ומחליפים ערכות לבדיקה צולבת'], [10, 'סיכום: מה ערכת בדיקה טובה חייבת להכיל']],
    activityHe: 'בניית ערכות אימון ובדיקה צולבת בין קבוצות.',
    unpluggedHe: 'בלי מחשב: כרטיסי ציור וטבלת רישום ניחושים על נייר, עם ספירת טעויות ידנית.',
    materialsHe: ['כרטיסי ציור', 'טבלאות רישום'],
    wrapUpHe: ['למה בודקים על דוגמאות חדשות?', 'איך נראית ערכת אימון גרועה?']
  }),
  lesson('middle', {
    index: 2,
    slug: 'image-recognition',
    titleHe: 'זיהוי תמונות ורשתות עצביות',
    goalsHe: ['לתאר בשכבות איך רשת מזהה תמונה מקצוות לצורות לאובייקט', 'להסביר טעות זיהוי אחת ולתקן בדוגמאות'],
    flowHe: [[5, 'פתיחה: מזהים תמונה שמתגלה שכבה אחרי שכבה'], [12, 'הסבר: שכבות של מאפיינים - קווים, צורות, חלקים, וציון ביטחון'], [18, 'פעילות: צוות אחד בונה רמזי שכבות והשני מנחש, ואז מנתחים טעות'], [10, 'סיכום: ביטחון גבוה הוא לא הוכחה לנכונות']],
    activityHe: 'משחק שכבות רמזים וניתוח טעויות בזוגות צוותים.',
    unpluggedHe: 'בלי מחשב: תמונות מודפסות בחיתוכים הולכים וגדלים, ורישום שלב הניחוש הנכון.',
    materialsHe: ['תמונות מודפסות בשכבות'],
    wrapUpHe: ['מה רואה השכבה הראשונה של רשת?', 'למה ביטחון גבוה עדיין יכול לטעות?']
  }),
  lesson('middle', {
    index: 3,
    slug: 'llm-chatbots',
    titleHe: 'מודלי שפה וצ׳אטבוטים',
    goalsHe: ['להסביר חיזוי המילה הבאה והקשרה בשפה פשוטה', 'לזהות הזיה של מודל ולהצליב עם מקור נוסף'],
    flowHe: [[5, 'פתיחה: מנחשים את המילה הבאה במשפטים ורואים כמה אפשרויות סבירות יש'], [12, 'הסבר: אימון על המון טקסט, חיזוי הסתברותי, ולמה נוצרות הזיות'], [18, 'פעילות: מחבר שרשרת - ממשיכים טקסט כמו מודל, ואז בודקים עובדה אחת שהמציא'], [10, 'סיכום: כלל אצבע - מודל הוא מקור ראשון, לא מקור אחרון']],
    activityHe: 'המשכת טקסט כמו מודל ובדיקת עובדות מומצאות.',
    unpluggedHe: 'בלי מחשב: משחק חיזוי מילה הבאה על לוח, עם הצבעה על ההמשך הסביר ביותר.',
    materialsHe: ['לוח', 'דפי טקסט קצרים'],
    wrapUpHe: ['מה המודל באמת עושה כשהוא עונה?', 'איך תפסנו הזיה אחת היום?']
  }),
  lesson('middle', {
    index: 4,
    slug: 'prompting-verify',
    titleHe: 'הנחיות יעילות ובדיקת תשובות',
    goalsHe: ['לנסח הנחיה עם מטרה, הקשר, פורמט ודוגמה', 'לאמת תשובת מודל בשני מקורות בלתי תלויים'],
    flowHe: [[5, 'פתיחה: אותה שאלה בשתי ניסוחים ותוצאות שונות לגמרי'], [12, 'הסבר: מבנה הנחיה טובה - תפקיד, משימה, אילוצים, פורמט פלט'], [18, 'פעילות: משפרים הנחיות חלשות על כרטיסים ומשווים תשובות אנושיות לתשובות מודל בדמיון'], [10, 'סיכום: רשימת בדיקת אימות לפני שמשתמשים בתשובה']],
    activityHe: 'סדנת שיפור הנחיות על כרטיסים בזוגות.',
    unpluggedHe: 'בלי מחשב: בן זוג משחק מודל צייתן ופשוטו כמשמעו - הנחיה מעורפלת נכשלת מיד.',
    materialsHe: ['כרטיסי הנחיות'],
    wrapUpHe: ['איזה חלק בהנחיה שינה הכי הרבה?', 'מהי בדיקת האימות הראשונה שלכם?']
  }),
  lesson('middle', {
    index: 5,
    slug: 'data-bias',
    titleHe: 'נתונים, הטיה והוגנות',
    goalsHe: ['להסביר הטיית נתונים, הטיית תוויות ומדידת פער בין קבוצות', 'להציע תיקון אחד לנתונים ואחד לבדיקה'],
    flowHe: [[5, 'פתיחה: מודל שלמד רק מקבוצה אחת נבחן על אחרת - צופים בפער'], [12, 'הסבר: מאיפה הטיה נכנסת - איסוף, תיוג, ומי חסר בנתונים'], [18, 'פעילות: חוקרים טבלת תוצאות קטנה, מוצאים פער ומציעים תיקון'], [10, 'סיכום: הוגנות נמדדת בתוצאות לפי קבוצות, לא בכוונות']],
    activityHe: 'חקירת טבלת תוצאות וכתיבת המלצת תיקון.',
    unpluggedHe: 'בלי מחשב: טבלה מודפסת וספירת תאים ידנית בשני צבעים.',
    materialsHe: ['טבלאות מודפסות', 'טושים בשני צבעים'],
    wrapUpHe: ['איפה נכנסה ההטיה בדוגמה?', 'איך הייתם מודדים שהתיקון עבד?']
  }),
  lesson('middle', {
    index: 6,
    slug: 'deepfakes-verify',
    titleHe: 'זיופים עמוקים ואימות מידע',
    goalsHe: ['לזהות סימני זיוף בתמונה, בקול ובסרטון', 'ליישם בדיקת מקור, הקשר ואישוש צולב'],
    flowHe: [[5, 'פתיחה: שתי כותרות מפתיעות - מה בודקים לפני שמשתפים'], [12, 'הסבר: איך נוצר זיוף עמוק ולמה העין כבר לא מספיקה'], [18, 'פעילות: תחנות אימות - כל קבוצה מאמתת פריט אחר ומדווחת ודאות ורמזים'], [10, 'סיכום: שיתוף הוא פעולה - עוצרים כשלא בטוחים']],
    activityHe: 'תחנות אימות בקבוצות עם דיווח ודאות מנומק.',
    unpluggedHe: 'בלי מחשב: פריטים מודפסים בלבד - בודקים מקור, תאריך והקשר על הנייר.',
    materialsHe: ['פריטים מודפסים לאימות'],
    wrapUpHe: ['מהו סימן הזיוף הכי אמין שמצאתם?', 'מתי נכון לא לשתף גם אם זה נראה אמיתי?']
  }),
  lesson('middle', {
    index: 7,
    slug: 'privacy-safety',
    titleHe: 'פרטיות ובטיחות בעידן הבינה המלאכותית',
    goalsHe: ['למפות אילו נתונים שירות אוסף ולמה', 'לנסח מדיניות אישית: מה לא מזינים למודל לעולם'],
    flowHe: [[5, 'פתיחה: מה מודל יכול לזכור משיחה אחת תמימה'], [12, 'הסבר: הזנת נתונים לאימון, הרשאות, ומחיקה - מה בשליטתנו ומה לא'], [18, 'פעילות: בונים תווית פרטיות לשירות דמיוני - אוסף, שומר, משתף, מוחק'], [10, 'סיכום: שלושה קווים אדומים אישיים שכל אחד כותב לעצמו']],
    activityHe: 'בניית תווית פרטיות לשירות דמיוני בקבוצות.',
    unpluggedHe: 'בלי מחשב: כרטיסי תרחישים - ממיינים מה מזינים ומה לא, ומנמקים.',
    materialsHe: ['כרטיסי תרחישים', 'דפי תווית'],
    wrapUpHe: ['מה לא תזינו למודל לעולם?', 'איך יודעים אם שירות מוחק באמת?']
  }),
  lesson('middle', {
    index: 8,
    slug: 'ai-creativity',
    titleHe: 'בינה מלאכותית ויצירה',
    goalsHe: ['להבחין בין יצירה, עריכה וייצור המוני בעזרת מודל', 'להפיק יצירה עם קרדיט הוגן לתהליך'],
    flowHe: [[5, 'פתיחה: מי חתום על יצירה שהמודל הציע ואדם ערך'], [12, 'הסבר: מודלים יוצרים מהמשכים סטטיסטיים של יצירות קודמות - וזכויות וקרדיט'], [18, 'פעילות: יוצרים סיפור או כרזה עם שלבי הצעה, בחירה ועריכה מתועדים'], [10, 'סיכום: מתי שימוש במודל פוגע בלמידה שלנו']],
    activityHe: 'יצירה מתועדת-שלבים בזוגות: הצעה, בחירה, עריכה.',
    unpluggedHe: 'בלי מחשב: מגזין גזירי משפטים - מרכיבים סיפור מגזרים כמו מודל ובוחרים עריכה.',
    materialsHe: ['גזירי משפטים מודפסים', 'דפים וצבעים'],
    wrapUpHe: ['מי היוצר כשמודל מציע ואדם בוחר?', 'איך נותנים קרדיט הוגן?']
  }),
  lesson('middle', {
    index: 9,
    slug: 'ai-society-work',
    titleHe: 'בינה מלאכותית, עבודה וחברה',
    goalsHe: ['למפות מטלות במקצוע שמודל משנה ומטלות שנשארות אנושיות', 'לטעון בעד ונגד אוטומציה של מטלה אחת'],
    flowHe: [[5, 'פתיחה: מקצוע אחד על הלוח - אילו מטלות שלו משתנות'], [12, 'הסבר: אוטומציה של מטלות, לא של מקצועות שלמים, ומקצועות חדשים שנוצרים'], [18, 'פעילות: דיבייט קצר - כל קבוצה טוענת צד אחר על מטלה שבחרה'], [10, 'סיכום: מיומנות אנושית אחת להשקיע בה']],
    activityHe: 'דיבייט מטלות בקבוצות עם שופטי כיתה.',
    unpluggedHe: 'בלי מחשב: כרטיסי מטלות מקצוע על נייר - ממיינים למשתנה, נשאר, וחדש.',
    materialsHe: ['כרטיסי מטלות'],
    wrapUpHe: ['מטלה שהשתנתה, או מקצוע שלם?', 'באיזו מיומנות אנושית תשקיעו?']
  }),
  lesson('middle', {
    index: 10,
    slug: 'ethics-responsibility',
    titleHe: 'אתיקה: מי אחראי כשהמכונה טועה',
    goalsHe: ['לנתח תרחיש נזק: מפתח, מפעיל, משתמש ונתונים', 'לנסח כלל אחריות אחד למערכת בית-ספרית'],
    flowHe: [[5, 'פתיחה: תרחיש קצר - מודל טעה ומישהו נפגע, מי אשם'], [12, 'הסבר: אחריות מבוזרת, פיקוח אנושי, וזכות ערעור על החלטת מכונה'], [18, 'פעילות: בית דין כיתתי - טוענים תפקידים שונים על אותו תרחיש'], [10, 'סיכום: כלל זהב - החלטה חשובה תמיד עם אדם אחראי וערעור']],
    activityHe: 'בית דין כיתתי על תרחיש נזק.',
    unpluggedHe: 'בלי מחשב: כרטיסי תפקידים ותרחיש מודפס, בלי מסכים.',
    materialsHe: ['כרטיסי תפקידים', 'תרחיש מודפס'],
    wrapUpHe: ['מי אחראי כשהמודל טועה?', 'מהו כלל האחריות שלכם?']
  }),
  lesson('middle', {
    index: 11,
    slug: 'mini-project',
    titleHe: 'מיני-פרויקט סיום: פותרים בעיה עם בינה מלאכותית',
    goalsHe: ['להגדיר בעיה, קהל ונתונים לפרויקט צוותי', 'להציג סיכונים, הוגנות ובדיקת אימות בתוכנית'],
    flowHe: [[5, 'פתיחה: בוחרים בעיה אמיתית מבית הספר או מהשכונה'], [15, 'תכנון: בעיה, קהל, אילו נתונים צריך, ואיך נאמן ונבדוק'], [15, 'בניית מצגת או כרזה: פתרון, סיכוני הוגנות ופרטיות, ותוכנית אימות'], [10, 'הצגות ושאלות - כל צוות מקבל שאלת אתיקה אחת']],
    activityHe: 'תכנון ובניית מצגת פרויקט בצוותים.',
    unpluggedHe: 'בלי מחשב: כל הפרויקט ככרזה על נייר, כולל תוכנית הנתונים והאימות.',
    materialsHe: ['דפים גדולים', 'טושים'],
    wrapUpHe: ['איזו בעיה הפרויקט פותר ולמי?', 'מהו הסיכון הכי גדול בתוכנית שלכם?']
  })
]);

const BY_TRACK = Object.freeze({ elementary: ELEMENTARY, middle: MIDDLE });
const ALL_LESSONS = Object.freeze(ELEMENTARY.concat(MIDDLE));

function assertTrack(track) {
  if (TRACKS.indexOf(track) === -1) throw new Error('invalid track: expected elementary or middle');
  return track;
}
function trackForGrade(grade) {
  if (!Number.isInteger(grade)) throw new Error('invalid grade: expected an integer 3..9');
  if (grade >= 3 && grade <= 6) return 'elementary';
  if (grade >= 7 && grade <= 9) return 'middle';
  throw new Error('invalid grade: expected an integer 3..9');
}
function lessonsForTrack(track) { return BY_TRACK[assertTrack(track)]; }
function invalidLessonIndex(track) {
  return new Error(`invalid lesson index for track ${track}`);
}

function assertLessonIndex(index, list, track) {
  if (!Number.isInteger(index)) throw invalidLessonIndex(track);
  if (index < 0) throw invalidLessonIndex(track);
  if (index >= list.length) throw invalidLessonIndex(track);
}
function getLesson(track, index) {
  const list = lessonsForTrack(track);
  assertLessonIndex(index, list, track);
  return list[index];
}
function lessonById(id) {
  const found = ALL_LESSONS.find((l) => l.id === id);
  if (!found) throw new Error('unknown lesson id');
  return found;
}
function flowMinutes(lesson) { return lesson.flowHe.reduce((sum, f) => sum + f.minutes, 0); }

function assertFlow(lesson) {
  if (!lesson) throw new Error('invalid lesson: flowHe');
  if (!Array.isArray(lesson.flowHe)) throw new Error('invalid lesson: flowHe');
  if (lesson.flowHe.length === 0) throw new Error('invalid lesson: flowHe');
}

function isValidStep(f) {
  if (!f) return false;
  if (!Number.isInteger(f.minutes) || f.minutes <= 0) return false;
  if (typeof f.stepHe !== 'string') return false;
  return f.stepHe.trim() !== '';
}

function timelineStep(f, i) {
  if (!isValidStep(f)) throw new Error('invalid lesson: flowHe');
  const cut = f.stepHe.indexOf(': ');
  const hasTitle = cut > 0 && cut <= 28;
  return Object.freeze({
    minutes: f.minutes,
    titleHe: hasTitle ? f.stepHe.slice(0, cut) : `שלב ${i + 1}`,
    bodyHe: hasTitle ? f.stepHe.slice(cut + 2) : f.stepHe
  });
}

// The 45-minute flow as timeline steps for the lesson screen: a short title, the
// duration and the body of each step. Steps are written "title: body"; a step
// without that prefix keeps its whole text as the body under a numbered title.
function flowTimeline(lesson) {
  assertFlow(lesson);
  return Object.freeze(lesson.flowHe.map(timelineStep));
}

function resolveTrack(trackByPair, pairIndex) {
  let track;
  if (typeof trackByPair === 'function') track = trackByPair(pairIndex);
  else if (trackByPair && typeof trackByPair === 'object') track = trackByPair[pairIndex];
  if (track === undefined || track === null) throw new Error(`missing track for pair ${pairIndex}`);
  return assertTrack(track);
}
function sessionOrderKey(s) {
  return [Number.isInteger(s.week) ? s.week : 0, typeof s.slot === 'string' ? s.slot : '', typeof s.date === 'string' ? s.date : ''];
}
function assertSession(s) {
  if (!s) throw new Error('invalid session: pairIndex');
  if (!Number.isInteger(s.pairIndex)) throw new Error('invalid session: pairIndex');
  if (s.pairIndex < 0) throw new Error('invalid session: pairIndex');
}

function groupSessionIndexes(list) {
  const byPair = new Map();
  list.forEach((s, i) => {
    if (!byPair.has(s.pairIndex)) byPair.set(s.pairIndex, []);
    byPair.get(s.pairIndex).push(i);
  });
  return byPair;
}

function compareSessionOrder(list, a, b) {
  const ka = sessionOrderKey(list[a]);
  const kb = sessionOrderKey(list[b]);
  for (let k = 0; k < ka.length; k += 1) {
    if (ka[k] < kb[k]) return -1;
    if (ka[k] > kb[k]) return 1;
  }
  return a - b;
}

function assignPairLessons(context, indexes, pairIndex) {
  const track = resolveTrack(context.trackByPair, pairIndex);
  const lessons = lessonsForTrack(track);
  const ordered = indexes.slice().sort((a, b) => compareSessionOrder(context.list, a, b));
  ordered.forEach((sessionIdx, pos) => {
    const lessonIndex = pos % lessons.length;
    context.out[sessionIdx] = Object.freeze(Object.assign({}, context.list[sessionIdx], {
      track, sessionIndex: pos, cycle: Math.floor(pos / lessons.length) + 1,
      lessonIndex, lessonId: lessons[lessonIndex].id, titleKey: lessons[lessonIndex].titleKey
    }));
  });
}

// Each session gets the next lesson of its group's track, in session order within the group.
// More sessions than lessons start a new cycle (cycle 2 repeats the track from lesson 1).
function assignLessons(sessions, trackByPair) {
  const list = Array.isArray(sessions) ? sessions : [];
  list.forEach(assertSession);
  const byPair = groupSessionIndexes(list);
  const context = { list: list, trackByPair: trackByPair, out: new Array(list.length) };
  byPair.forEach((indexes, pairIndex) => {
    assignPairLessons(context, indexes, pairIndex);
  });
  return Object.freeze(context.out);
}
function todayLesson(assigned, pairIndex, delivered) {
  const rows = (Array.isArray(assigned) ? assigned : []).filter((s) => s && s.pairIndex === pairIndex);
  if (rows.length === 0) return null;
  const done = delivered instanceof Set ? delivered : new Set(Array.isArray(delivered) ? delivered : []);
  const next = rows.find((s) => !done.has(deliveryKey(s)));
  const pick = next || rows[rows.length - 1];
  return Object.freeze({ pairIndex, lesson: lessonById(pick.lessonId), assigned: pick, delivered: !next });
}
function makeDeliveryLog() { return Object.freeze({ delivered: Object.freeze([]) }); }
function deliveryKeyOf(pairIndex, lessonId, cycle) { return `${pairIndex}|${lessonId}|${Number.isInteger(cycle) ? cycle : 1}`; }
function deliveryKey(session) { return deliveryKeyOf(session.pairIndex, session.lessonId, session.cycle); }
function assertLog(log) { if (!log || !Array.isArray(log.delivered)) throw new Error('invalid delivery log'); }
function setDelivered(log, input, delivered) {
  assertLog(log); const o = input || {};
  if (!Number.isInteger(o.pairIndex) || o.pairIndex < 0) throw new Error('invalid delivery: pairIndex');
  lessonById(o.lessonId);
  const key = deliveryKeyOf(o.pairIndex, o.lessonId, o.cycle);
  const has = log.delivered.indexOf(key) !== -1;
  const want = delivered !== false;
  if (has === want) return log;
  const next = want ? log.delivered.concat([key]).sort() : log.delivered.filter((k) => k !== key);
  return Object.freeze({ delivered: Object.freeze(next) });
}
function isDelivered(log, input) { assertLog(log); const o = input || {}; return log.delivered.indexOf(deliveryKeyOf(o.pairIndex, o.lessonId, o.cycle)) !== -1; }
function lessonProgress(assigned, log) {
  assertLog(log);
  const byPair = new Map();
  (Array.isArray(assigned) ? assigned : []).forEach((s) => {
    if (!s) return;
    if (!byPair.has(s.pairIndex)) byPair.set(s.pairIndex, { pairIndex: s.pairIndex, track: s.track, total: 0, delivered: 0, nextLessonId: null });
    const row = byPair.get(s.pairIndex); row.total += 1;
    if (log.delivered.indexOf(deliveryKey(s)) !== -1) row.delivered += 1;
    else if (row.nextLessonId === null) row.nextLessonId = s.lessonId;
  });
  const rows = Array.from(byPair.values()).sort((a, b) => a.pairIndex - b.pairIndex)
    .map((r) => Object.freeze(Object.assign({}, r, { percent: r.total === 0 ? null : Math.round((r.delivered / r.total) * 1000) / 1000 })));
  const total = rows.reduce((n, r) => n + r.total, 0); const delivered = rows.reduce((n, r) => n + r.delivered, 0);
  return Object.freeze({ byPair: Object.freeze(rows), total, delivered, percent: total === 0 ? null : Math.round((delivered / total) * 1000) / 1000 });
}
function progressToCsv(progress) {
  const lines = ['pair,track,total,delivered,percent,next_lesson'];
  (progress && Array.isArray(progress.byPair) ? progress.byPair : []).forEach((r) => {
    lines.push(`${r.pairIndex},${r.track},${r.total},${r.delivered},${r.percent === null ? '' : r.percent},${r.nextLessonId || ''}`);
  });
  return `${lines.join('\n')}\n`;
}

const VALID_AI_TOPICS = Object.freeze(AI_TOPIC_KEYS ? AI_TOPIC_KEYS.slice() : [
  'AI_LIT_PROMPT',
  'AI_CREATIVE',
  'AI_STEM_CODE',
  'AI_ETHICS_SEC'
]);

const ALLOWED_CHALLENGE_KEYS = Object.freeze([
  'pairIndex',
  'aiTopic',
  'toolTitle',
  'innovation',
  'usefulness',
  'safety'
]);

const ALLOWED_JUDGE_EVAL_KEYS = Object.freeze([
  'judgeRole',
  'innovation',
  'usefulness',
  'safety'
]);

const SCORE_KEYS = Object.freeze(['innovation', 'usefulness', 'safety']);

const VALID_JUDGE_ROLES = Object.freeze([
  'coordinator',
  'mentor_peer',
  'industry_guest'
]);

const JUDGE_ROLE_WEIGHTS = Object.freeze({
  coordinator: 0.4,
  mentor_peer: 0.3,
  industry_guest: 0.3
});

function assertPlainObject(value, message) {
  if (!value) throw new Error(message);
  if (typeof value !== 'object') throw new Error(message);
  if (Array.isArray(value)) throw new Error(message);
}

function assertAllowedKeys(value, allowed) {
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    if (allowed.indexOf(keys[i]) === -1) throw new Error('personal data is not accepted');
  }
}

function assertScore(scoreKey, val) {
  if (!Number.isInteger(val)) throw new Error(`invalid ${scoreKey}: expected integer 1..5`);
  if (val < 1) throw new Error(`invalid ${scoreKey}: expected integer 1..5`);
  if (val > 5) throw new Error(`invalid ${scoreKey}: expected integer 1..5`);
}

function assertScores(value) {
  for (const scoreKey of SCORE_KEYS) {
    assertScore(scoreKey, value[scoreKey]);
  }
}

function challengeRecord(entry, cleanTitle) {
  const totalScore = entry.innovation + entry.usefulness + entry.safety;
  return Object.freeze({
    pairIndex: entry.pairIndex,
    aiTopic: entry.aiTopic,
    toolTitle: cleanTitle,
    innovation: entry.innovation,
    usefulness: entry.usefulness,
    safety: entry.safety,
    totalScore: totalScore,
    averageScore: Math.round((totalScore / 3) * 100) / 100,
    score: totalScore
  });
}

function upsertChallengeEntry(prev, record) {
  const idx = prev.findIndex((e) => e && e.pairIndex === record.pairIndex);
  if (idx < 0) return prev.concat([record]);
  const next = prev.slice();
  next[idx] = record;
  return next;
}

function assertEntriesInput(entries) {
  if (entries === undefined) return;
  if (entries === null) return;
  if (!Array.isArray(entries)) throw new Error('invalid entries: expected array');
}

function assertPairIndexField(entry) {
  if (!Number.isInteger(entry.pairIndex)) throw new Error('invalid pairIndex: expected non-negative integer');
  if (entry.pairIndex < 0) throw new Error('invalid pairIndex: expected non-negative integer');
}

function assertAiTopicField(entry) {
  if (typeof entry.aiTopic !== 'string') throw new Error('invalid aiTopic: expected valid AI topic key');
  if (VALID_AI_TOPICS.indexOf(entry.aiTopic) === -1) throw new Error('invalid aiTopic: expected valid AI topic key');
}

function assertToolTitleField(entry) {
  if (typeof entry.toolTitle !== 'string') throw new Error('invalid toolTitle: expected string');
}

function submitChallengeEntry(entries, entry) {
  assertEntriesInput(entries);
  assertPlainObject(entry, 'invalid challenge entry: expected an object');
  assertAllowedKeys(entry, ALLOWED_CHALLENGE_KEYS);
  assertPairIndexField(entry);
  assertAiTopicField(entry);
  assertToolTitleField(entry);
  const cleanTitle = assertCleanText(entry.toolTitle, { minLength: 1, maxLength: 80 });
  assertScores(entry);
  const record = challengeRecord(entry, cleanTitle);
  return Object.freeze(upsertChallengeEntry(Array.isArray(entries) ? entries : [], record));
}

function resolveEntryIndex(entries, entryIndex) {
  if (entryIndex < entries.length && entries[entryIndex]) return entryIndex;
  return entries.findIndex((e) => e && e.pairIndex === entryIndex);
}

function assertJudgeEvaluation(evaluation) {
  assertPlainObject(evaluation, 'invalid evaluation: expected an object');
  assertAllowedKeys(evaluation, ALLOWED_JUDGE_EVAL_KEYS);
  if (typeof evaluation.judgeRole !== 'string' || VALID_JUDGE_ROLES.indexOf(evaluation.judgeRole) === -1) {
    throw new Error("invalid judgeRole: expected 'coordinator', 'mentor_peer', or 'industry_guest'");
  }
  assertScores(evaluation);
}

function assertNoDuplicateRole(prevEvals, role) {
  if (prevEvals.some((ev) => ev && ev.judgeRole === role)) {
    throw new Error(`duplicate judgeRole: evaluation already exists for role '${role}'`);
  }
}

function evaluationRecord(evaluation) {
  const totalScore = evaluation.innovation + evaluation.usefulness + evaluation.safety;
  return Object.freeze({
    judgeRole: evaluation.judgeRole,
    innovation: evaluation.innovation,
    usefulness: evaluation.usefulness,
    safety: evaluation.safety,
    totalScore: totalScore,
    averageScore: Math.round((totalScore / 3) * 100) / 100
  });
}

function weightedScores(evals) {
  let totalWeight = 0;
  let weightedInnoSum = 0;
  let weightedUseSum = 0;
  let weightedSafeSum = 0;

  for (let i = 0; i < evals.length; i += 1) {
    const ev = evals[i];
    const weight = JUDGE_ROLE_WEIGHTS[ev.judgeRole] || 1;
    totalWeight += weight;
    weightedInnoSum += ev.innovation * weight;
    weightedUseSum += ev.usefulness * weight;
    weightedSafeSum += ev.safety * weight;
  }

  const innovation = Math.round((weightedInnoSum / totalWeight) * 100) / 100;
  const usefulness = Math.round((weightedUseSum / totalWeight) * 100) / 100;
  const safety = Math.round((weightedSafeSum / totalWeight) * 100) / 100;
  const totalScore = Math.round((innovation + usefulness + safety) * 100) / 100;
  return {
    innovation: innovation,
    usefulness: usefulness,
    safety: safety,
    totalScore: totalScore,
    averageScore: Math.round((totalScore / 3) * 100) / 100
  };
}

function assertEntryIndex(entryIndex) {
  if (!Number.isInteger(entryIndex)) throw new Error('invalid entryIndex: expected non-negative integer');
  if (entryIndex < 0) throw new Error('invalid entryIndex: expected non-negative integer');
}

function addJudgeEvaluation(entries, entryIndex, evaluation) {
  if (!Array.isArray(entries)) {
    throw new Error('invalid entries: expected array');
  }
  assertEntryIndex(entryIndex);
  const targetIdx = resolveEntryIndex(entries, entryIndex);
  if (targetIdx === -1) {
    throw new Error('entry not found');
  }

  assertJudgeEvaluation(evaluation);

  const currentEntry = entries[targetIdx];
  const prevEvals = Array.isArray(currentEntry.evaluations) ? currentEntry.evaluations : [];
  assertNoDuplicateRole(prevEvals, evaluation.judgeRole);

  const nextEvals = prevEvals.concat([evaluationRecord(evaluation)]);
  const scores = weightedScores(nextEvals);
  const updatedEntry = Object.freeze(Object.assign({}, currentEntry, scores, {
    score: scores.totalScore,
    evaluations: Object.freeze(nextEvals),
    judgeCount: nextEvals.length
  }));

  const nextEntries = entries.slice();
  nextEntries[targetIdx] = updatedEntry;
  return Object.freeze(nextEntries);
}

function textOr(value, fallback) {
  if (typeof value === 'string') return value;
  return fallback;
}

function roundedOr(value, fallback) {
  if (value !== undefined) return Math.round(Number(value) * 100) / 100;
  return fallback;
}

function judgeCountOf(e) {
  if (Number.isInteger(e.judgeCount)) return e.judgeCount;
  if (Array.isArray(e.evaluations)) return e.evaluations.length;
  return 0;
}

function leaderboardItem(e) {
  assertPlainObject(e, 'invalid challenge entry in leaderboard');
  const pairIndex = Number(e.pairIndex);
  const innovation = Number(e.innovation);
  const usefulness = Number(e.usefulness);
  const safety = Number(e.safety);
  const totalScore = roundedOr(e.totalScore, Math.round((innovation + usefulness + safety) * 100) / 100);
  const averageScore = roundedOr(e.averageScore, Math.round((totalScore / 3) * 100) / 100);
  return {
    pairIndex: pairIndex,
    aiTopic: textOr(e.aiTopic, ''),
    toolTitle: textOr(e.toolTitle, ''),
    innovation: innovation,
    usefulness: usefulness,
    safety: safety,
    totalScore: totalScore,
    averageScore: averageScore,
    score: totalScore,
    evaluations: Array.isArray(e.evaluations) ? e.evaluations : Object.freeze([]),
    judgeCount: judgeCountOf(e)
  };
}

function compareLeaderboardItems(a, b) {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  return a.pairIndex - b.pairIndex;
}

function rankedItem(item, index) {
  return Object.freeze({
    rank: index + 1,
    pairIndex: item.pairIndex,
    aiTopic: item.aiTopic,
    toolTitle: item.toolTitle,
    innovation: item.innovation,
    usefulness: item.usefulness,
    safety: item.safety,
    totalScore: item.totalScore,
    averageScore: item.averageScore,
    score: item.score,
    evaluations: item.evaluations,
    judgeCount: item.judgeCount
  });
}

function hasRankableEntries(entries) {
  if (!entries) return false;
  if (!Array.isArray(entries)) return false;
  return entries.length > 0;
}

function rankChallengeLeaderboard(entries) {
  if (!hasRankableEntries(entries)) {
    return Object.freeze([]);
  }
  const items = entries.map(leaderboardItem);
  items.sort(compareLeaderboardItems);
  return Object.freeze(items.map(rankedItem));
}

function finalistLimit(topN) {
  return (topN !== undefined && Number.isInteger(topN)) ? Math.max(0, topN) : 3;
}

function selectChallengeFinalists(entries, topN) {
  if (!hasRankableEntries(entries)) {
    return Object.freeze([]);
  }
  const n = finalistLimit(topN);
  if (n === 0) {
    return Object.freeze([]);
  }
  const ranked = rankChallengeLeaderboard(entries);
  const finalists = ranked.slice(0, n).map((item) => Object.freeze(Object.assign({}, item, {
    isFinalist: true
  })));
  return Object.freeze(finalists);
}

function filterChallengeEntriesByTopic(entries, aiTopic) {
  const list = Array.isArray(entries) ? entries : [];
  if (!aiTopic || aiTopic === 'all') {
    return Object.freeze(list.slice());
  }
  return Object.freeze(list.filter((e) => e && e.aiTopic === aiTopic));
}

function buildChallengeWinnersSummary(entries, lang) {
  const list = Array.isArray(entries) ? entries : [];
  const ranked = rankChallengeLeaderboard(list);
  const top3 = ranked.slice(0, 3);
  const l = (lang === 'ar' || lang === 'ru' || lang === 'he') ? lang : 'he';

  const titles = {
    he: { header: 'סיכום זוכים אנונימי - Top 3', empty: 'אין הגשות זמינות', format: (r) => `#${r.rank} זוג ${r.pairIndex} | ${r.toolTitle} (${r.aiTopic}) - ציון: ${r.totalScore}` },
    ar: { header: 'ملخص الفائزين - Top 3', empty: 'لا توجد مشاركات', format: (r) => `#${r.rank} الثنائي ${r.pairIndex} | ${r.toolTitle} (${r.aiTopic}) - المجموع: ${r.totalScore}` },
    ru: { header: 'Сводка победителей - Top 3', empty: 'Нет заявок', format: (r) => `#${r.rank} Пара ${r.pairIndex} | ${r.toolTitle} (${r.aiTopic}) - Счёт: ${r.totalScore}` }
  };

  const t = titles[l];
  if (top3.length === 0) {
    return Object.freeze({ text: t.empty, top3: Object.freeze([]) });
  }

  const lines = [t.header];
  top3.forEach((r) => {
    lines.push(t.format(r));
  });

  return Object.freeze({
    text: lines.join('\n'),
    top3: Object.freeze(top3.map((r) => Object.freeze({
      pairIndex: r.pairIndex,
      toolTitle: r.toolTitle,
      aiTopic: r.aiTopic,
      totalScore: r.totalScore
    })))
  });
}

const AI_CHALLENGE_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'ai-lit-prompt',
    topic: 'AI_LIT_PROMPT',
    aiTopic: 'AI_LIT_PROMPT',
    title: Object.freeze({
      he: 'עוזר הנחיות מדויק',
      ar: 'مساعد التوجيه الدقيق',
      ru: 'Мастер точных промптов'
    }),
    titleHe: 'עוזר הנחיות מדויק',
    titleAr: 'مساعد التوجيه الدقيق',
    titleRu: 'Мастер точных промптов',
    criterion: Object.freeze({
      he: 'בהירות הניסוח ודיוק התוצאה',
      ar: 'وضوح الصياغة ودقة النتيجة',
      ru: 'Четкость формулировки и точность результата'
    }),
    mainCriterion: Object.freeze({
      he: 'בהירות הניסוח ודיוק התוצאה',
      ar: 'وضوح الصياغة ودقة النتيجة',
      ru: 'Четкость формулировки и точность результата'
    }),
    criterionHe: 'בהירות הניסוח ודיוק התוצאה',
    criterionAr: 'وضوح الصياغة ودقة النتيجة',
    criterionRu: 'Четкость формулировки и точность результата'
  }),
  Object.freeze({
    id: 'ai-creative',
    topic: 'AI_CREATIVE',
    aiTopic: 'AI_CREATIVE',
    title: Object.freeze({
      he: 'יוצר סיפורים מאויר',
      ar: 'مؤلف القصص المصورة',
      ru: 'Генератор иллюстрированных историй'
    }),
    titleHe: 'יוצר סיפורים מאויר',
    titleAr: 'مؤلف القصص المصورة',
    titleRu: 'Генератор иллюстрированных историй',
    criterion: Object.freeze({
      he: 'מקוריות עלילתית ושילוב מדיה יוצרת',
      ar: 'أصالة الحبكة ودمج الوسائط التوليدية',
      ru: 'Оригинальность сюжета и интеграция медиа'
    }),
    mainCriterion: Object.freeze({
      he: 'מקוריות עלילתית ושילוב מדיה יוצרת',
      ar: 'أصالة الحبكة וدمج الوسائط التوليدية',
      ru: 'Оригинальность сюжета и интеграция медиа'
    }),
    criterionHe: 'מקוריות עלילתית ושילוב מדיה יוצרת',
    criterionAr: 'أصالة الحبكة ودمج الوسائط التوليدية',
    criterionRu: 'Оригинальность сюжета и интеграция медиа'
  }),
  Object.freeze({
    id: 'ai-stem-code',
    topic: 'AI_STEM_CODE',
    aiTopic: 'AI_STEM_CODE',
    title: Object.freeze({
      he: 'מדריך לפתרון תקלות קוד',
      ar: 'مرشد تصحيح أخطاء البرمجة',
      ru: 'Инструктор по отладке кода'
    }),
    titleHe: 'מדריך לפתרון תקלות קוד',
    titleAr: 'مرشد تصحيح أخطاء البرمجة',
    titleRu: 'Инструктор по отладке кода',
    criterion: Object.freeze({
      he: 'יעילות האלגוריתם והסבר צעדי הפתרון',
      ar: 'كفاءة الخوارزمية وشرح خطوات الحل',
      ru: 'Эффективность алгоритма и объяснение шагов'
    }),
    mainCriterion: Object.freeze({
      he: 'יעילות האלגוריתם והסבר צעדי הפתרון',
      ar: 'كفاءة الخوارزمية وشرح خطوات الحل',
      ru: 'Эффективность алгоритма и объяснение шагов'
    }),
    criterionHe: 'יעילות האלגוריתם והסבר צעדי הפתרון',
    criterionAr: 'كفاءة الخوارزمية وشرح خطوات الحل',
    criterionRu: 'Эффективность алгоритма и объяснение шагов'
  }),
  Object.freeze({
    id: 'ai-ethics-sec',
    topic: 'AI_ETHICS_SEC',
    aiTopic: 'AI_ETHICS_SEC',
    title: Object.freeze({
      he: 'שומר פרטיות ובטיחות תוכן',
      ar: 'حارس الخصوصية وأمان المحتوى',
      ru: 'Защитник приватности и безопасности'
    }),
    titleHe: 'שומר פרטיות ובטיחות תוכן',
    titleAr: 'حارس الخصوصية وأمان المحتوى',
    titleRu: 'Защитник приватности и безопасности',
    criterion: Object.freeze({
      he: 'זיהוי הטיות, מניעת דליפת מידע ושמירה על פרטיות',
      ar: 'كشف التحيز ومنع تسريب البيانات وحماية الخصوصية',
      ru: 'Выявление предвзятости, предотвращение утечек данных и защита приватности'
    }),
    mainCriterion: Object.freeze({
      he: 'זיהוי הטיות, מניעת דליפת מידע ושמירה על פרטיות',
      ar: 'كشف التحيز ومنع تسريب البيانات وحماية الخصوصية',
      ru: 'Выявление предвзятости, предотвращение утечек данных и защита приватности'
    }),
    criterionHe: 'זיהוי הטיות, מניעת דליפת מידע ושמירה על פרטיות',
    criterionAr: 'كشف التحيز ومنع تسريب البيانات وحماية الخصوصية',
    criterionRu: 'Выявление предвзятости, предотвращение утечек данных и защита приватности'
  })
]);

const CERTIFICATE_LANGS = Object.freeze(['he', 'ar', 'ru']);

function certificateLanguage(lang, rank) {
  if (typeof rank === 'string' && CERTIFICATE_LANGS.indexOf(rank) !== -1) {
    return { lang: rank, rank: undefined };
  }
  return { lang: CERTIFICATE_LANGS.indexOf(lang) !== -1 ? lang : 'he', rank: rank };
}

function isPresent(value) {
  if (value === undefined) return false;
  if (value === null) return false;
  return true;
}

function firstPresent(a, b, fallback) {
  if (isPresent(a)) return a;
  if (isPresent(b)) return b;
  return fallback;
}

function firstTruthy(a, b, fallback) {
  if (a) return a;
  if (b) return b;
  return fallback;
}

function certificateFields(entry, rank) {
  return {
    actualRank: firstPresent(rank, entry.rank, 1),
    pairIndex: entry.pairIndex !== undefined ? entry.pairIndex : '',
    toolTitle: firstTruthy(entry.toolTitle, undefined, ''),
    aiTopic: firstTruthy(entry.aiTopic, entry.topic, ''),
    totalScore: firstPresent(entry.totalScore, entry.score, 0)
  };
}

function certificateLines(l, f) {
  if (l === 'ar') {
    return [
      'شهادة تقدير ومشاركة - تحدي أدوات الذكاء الاصطناعي',
      `المرتبة: #${f.actualRank}`,
      `الثنائي: زوج ${f.pairIndex}`,
      `اسم الأداة: ${f.toolTitle}`,
      `موضوع الذكاء الاصطناعي: ${f.aiTopic}`,
      `الدرجة الكلية: ${f.totalScore}`
    ];
  }
  if (l === 'ru') {
    return [
      'Почётная грамота и сертификат участия - Конкурс инструментов ИИ',
      `Место: #${f.actualRank}`,
      `Пара: Пара ${f.pairIndex}`,
      `Название инструмента: ${f.toolTitle}`,
      `Тема ИИ: ${f.aiTopic}`,
      `Итоговый балл: ${f.totalScore}`
    ];
  }
  return [
    'תעודת הוקרה והשתתפות - אתגר כלי AI',
    `מקום: #${f.actualRank}`,
    `זוג: זוג ${f.pairIndex}`,
    `שם הכלי: ${f.toolTitle}`,
    `נושא AI: ${f.aiTopic}`,
    `ציון כולל: ${f.totalScore}`
  ];
}

function generateChallengeCertificateText(entry, rank, lang) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const language = certificateLanguage(lang, rank);
  return certificateLines(language.lang, certificateFields(entry, language.rank)).join('\n');
}

module.exports = {
  TRACKS, TRACK_GRADES, ALL_LESSONS,
  lessonsForTrack, getLesson, lessonById, trackForGrade, flowMinutes, flowTimeline,
  assignLessons, todayLesson, makeDeliveryLog, setDelivered, isDelivered, deliveryKey, lessonProgress, progressToCsv,
  VALID_AI_TOPICS, submitChallengeEntry, rankChallengeLeaderboard, filterChallengeEntriesByTopic, buildChallengeWinnersSummary,
  AI_CHALLENGE_TEMPLATES, generateChallengeCertificateText,
  addJudgeEvaluation, selectChallengeFinalists, VALID_JUDGE_ROLES, JUDGE_ROLE_WEIGHTS
};
