'use strict';
// PeerEd - lesson content: engineering students (mentors) teach children AI (stage 10).
// Two tracks, about 12 lessons each, 45 minutes a lesson. Hebrew first; every lesson title
// also has an i18n key (cur.*) translated in lang-he/lang-ar/lang-ru for ar/ru. Content only:
// no child personal data, no network, no clock, no randomness. A group's track is passed in
// by the caller (trackByPair); the module never invents a track for a group it does not know.

const TRACKS = Object.freeze(['elementary', 'middle']);
const TRACK_GRADES = Object.freeze({ elementary: Object.freeze([3, 4, 5, 6]), middle: Object.freeze([7, 8, 9]) });
const LESSON_MINUTES = 45;

function lesson(track, index, slug, titleHe, goalsHe, flowHe, activityHe, unpluggedHe, materialsHe, wrapUpHe) {
  return Object.freeze({
    id: track + '-' + slug, track, index,
    titleKey: 'cur.' + track + '.' + slug, titleHe,
    goalsHe: Object.freeze(goalsHe.slice()),
    flowHe: Object.freeze(flowHe.map((f) => Object.freeze({ minutes: f[0], stepHe: f[1] }))),
    activityHe, unpluggedHe,
    materialsHe: Object.freeze(materialsHe.slice()),
    wrapUpHe: Object.freeze(wrapUpHe.slice())
  });
}

const ELEMENTARY = Object.freeze([
  lesson('elementary', 0, 'what-is-ai', 'מה זו בינה מלאכותית?',
    ['להבחין בין מכונה רגילה למכונה שלומדת', 'לתת דוגמה אחת של בינה מלאכותית מהבית'],
    [[5, 'פתיחה: מציגים שני חפצים ושואלים מה ההבדל בין מנורה למצלמה שמזהה פנים'], [10, 'הסבר קצר עם כרטיסיות: מכונה פועלת לפי הוראות, מכונה לומדת מדוגמאות'], [20, 'פעילות: משחק מיון - התלמידים ממיינים כרטיסיות למשימה שמכונה יודעת ולמשימה שלא'], [10, 'סיכום ושאלות הבנה בזוגות']],
    'משחק מיון כרטיסיות: כל זוג ממיין משימות ומנמק בקול.',
    'בלי מחשב: התלמידים הם המכונה - אחד נותן הוראות מדויקות והשני מבצע בדיוק, ומגלים למה הוראות מעורפלות נכשלות.',
    ['כרטיסיות משימות', 'לוח וטוש'],
    ['מה ההבדל בין הוראה לדוגמה?', 'איזו משימה הייתם מלמדים מכונה קודם?']),
  lesson('elementary', 1, 'learn-examples', 'למידה מדוגמאות',
    ['להבין שמכונה לומדת מהרבה דוגמאות', 'להבחין בין דוגמה טובה לרועשת'],
    [[5, 'פתיחה: מראים תמונה אחת של חתול ושואלים אם מספיקה דוגמה אחת'], [10, 'הסבר: מלמדים מכונה עם עשר דוגמאות ומסבירים למה צריך הרבה'], [20, 'פעילות: מאמנים בן זוג - מראים כרטיסי צורות והוא מנחש את הכלל'], [10, 'סיכום: מה קורה כשכל הדוגמאות דומות מדי']],
    'אימון בזוגות: מדריך כרטיסים מלמד כלל סודי ובן הזוג מנחש, ואז מחליפים תפקידים.',
    'אותה פעילות בכרטיסי נייר בלבד, בלי מסך: הכלל הסודי כתוב על פתק מקופל.',
    ['כרטיסי צורות', 'פתקי כלל'],
    ['למה דוגמה אחת לא מספיקה?', 'מהי דוגמה שמבלבלת מכונה?']),
  lesson('elementary', 2, 'image-recognition', 'זיהוי תמונות ודפוסים',
    ['להבין איך מכונה מזהה תמונה לפי חלקים ודפוסים', 'להסביר למה זיהוי לפעמים טועה'],
    [[5, 'פתיחה: מנחשים חפץ מתמונה חתוכה לחלקים'], [10, 'הסבר: מכונה מחפשת קצוות, צורות וצבעים ואז מנחשת'], [20, 'פעילות: מציירים אותה חיה בסגנונות שונים ובודקים אם הכיתה מזהה'], [10, 'סיכום: מתי הזיהוי נכשל - חושך, הסתרה, זווית מוזרה']],
    'ציור ובדיקה: כל תלמיד מצייר חיה והכיתה מנחשת, עם רמזים מהחלקים.',
    'בלי מחשב: משחק עשרים שאלות על תמונה מוסתרת - שואלים רק על חלקים ודפוסים.',
    ['דפי ציור', 'תמונות חתוכות מודפסות'],
    ['איך מכונה יודעת שזה חתול?', 'מתי גם אנחנו טועים בזיהוי?']),
  lesson('elementary', 3, 'chatbots', 'צ׳אטבוטים ושיחה עם מכונה',
    ['להבין שצ׳אטבוט בונה תשובה ממילים ולא חושב כמו אדם', 'לנסח שאלה ברורה למכונה'],
    [[5, 'פתיחה: קוראים שיחה מצחיקה עם מכונה ושואלים מה חסר בה'], [10, 'הסבר: המכונה משלימה את המילה הבאה הסבירה, בלי להבין באמת'], [20, 'פעילות: משחק השלמת משפטים שרשרת - בונים סיפור מילה אחרי מילה כמו מכונה'], [10, 'סיכום: למה תשובת מכונה יכולה להישמע בטוחה וגם לטעות']],
    'סיפור שרשרת: כל תלמיד מוסיף מילה אחת סבירה, ומקבלים סיפור מפתיע.',
    'בלי מחשב: אחד משחק מכונה ועונה רק מהשלמת המילה הסבירה, והשאר מנסים לבלבל אותו בנימוס.',
    ['כרטיסי משפט פתיחה'],
    ['האם המכונה מבינה את הסיפור?', 'איך נשאל שאלה שהמכונה תענה עליה טוב?']),
  lesson('elementary', 4, 'data-bias', 'נתונים והוגנות',
    ['להבין שמכונה לומדת ממה שמראים לה', 'לזהות אימון לא הוגן שמפספס קבוצה שלמה'],
    [[5, 'פתיחה: מלמדים כלל רק מדוגמאות של ילדים ושואלים מה עם מבוגרים'], [10, 'הסבר: אם הדוגמאות חד-צדדיות, המכונה תטעה על מי שלא הראה לה'], [20, 'פעילות: בונים ערכת אימון הוגנת ולא הוגנת לציור דמויות ומשווים תוצאות ניחוש'], [10, 'סיכום: הוגנות מתחילה במי שמראים למכונה']],
    'בניית ערכות: שתי קבוצות בונות דוגמאות שונות ובודקות זו את זו.',
    'בלי מחשב: קופסת דוגמאות מנייר - מוציאים דוגמאות חד-צדדיות ורואים את הניחוש מוטה.',
    ['כרטיסי דמויות', 'שתי קופסאות'],
    ['למי המכונה תטעה אם לא הראו לה אותו?', 'איך עושים אימון הוגן יותר?']),
  lesson('elementary', 5, 'safety-privacy', 'בטיחות ופרטיות',
    ['לזהות מה לא משתפים עם מכונה או ברשת', 'לנסח כלל בטיחות אחד למשפחה'],
    [[5, 'פתיחה: ממיינים כרטיסי מידע למה שמותר ומה שאסור לשתף'], [10, 'הסבר: מכונה שומרת מה שכותבים לה, ולכן לא כותבים פרטים אישיים'], [20, 'פעילות: בונים שלט כללי בטיחות לכיתה עם ציורים'], [10, 'סיכום ובחירת הכלל החשוב ביותר בהצבעה']],
    'מיון כרטיסים ובניית שלט כיתתי משותף.',
    'בלי מחשב: משחק תפקידים - מה עונים למכונה ששואלת שאלה אישית מדי.',
    ['כרטיסי מידע', 'דף גדול וטושים'],
    ['מה לעולם לא נכתוב למכונה?', 'למי מספרים אם משהו מרגיש לא בטוח?']),
  lesson('elementary', 6, 'creative-ai', 'יצירה עם בינה מלאכותית',
    ['להבין שמכונה יכולה לעזור ליצור אבל הרעיון שלנו', 'לבנות יצירה משותפת אדם ומכונה בדמיון'],
    [[5, 'פתיחה: משלימים ציור חצי גמור של חבר ושואלים מי היוצר'], [10, 'הסבר: מכונה מציעה המשכים, והאדם בוחר ועורך'], [20, 'פעילות: סיפור מאויר בזוגות - אחד מציע שלושה המשכים והשני בוחר וממשיך'], [10, 'סיכום: למה הבחירה האנושית היא היצירה']],
    'סיפור מאויר בזוגות עם בחירת המשכים.',
    'בלי מחשב: קוביית רעיונות - מטילים ובונים המשך לסיפור לפי הפאה שיצאה.',
    ['דפים', 'צבעים', 'קובייה'],
    ['מי יצר את הסיפור, המציע או הבוחר?', 'מתי עזרת מכונה היא כבר לא היצירה שלי?']),
  lesson('elementary', 7, 'good-questions', 'שאלות טובות למכונה',
    ['לנסח בקשה ברורה עם פרטים חשובים', 'לשפר בקשה מעורפלת בשני צעדים'],
    [[5, 'פתיחה: מבצעים הוראה מעורפלת וצוחקים מהתוצאה'], [10, 'הסבר: בקשה טובה אומרת מה, למי, באיזה אורך ובאיזה סגנון'], [20, 'פעילות: מתקנים בקשות מעורפלות על כרטיסים עד שהכיתה מבינה בדיוק'], [10, 'סיכום: בודקים בקשה מתוקנת על בן זוג אנושי']],
    'תיקון בקשות על כרטיסים בזוגות.',
    'בלי מחשב: משחק ההוראות המדויקות - מציירים לפי הוראות של חבר בלי לראות את המקור.',
    ['כרטיסי בקשות מעורפלות'],
    ['מה הופך שאלה לברורה?', 'איזה פרט הכי חשוב להוסיף ראשון?']),
  lesson('elementary', 8, 'ai-at-home', 'בינה מלאכותית בבית ובבית הספר',
    ['לזהות בינה מלאכותית במכשירים יומיומיים', 'להחליט מתי עזרת מכונה מתאימה ומתי לא'],
    [[5, 'פתיחה: סופרים כמה מכונות חכמות פגשנו מהבוקר'], [10, 'הסבר: המלצות, ניווט, תרגום ועוזרות קוליות - כולן מנחשות מדוגמאות'], [20, 'פעילות: מצביעים בכרטיסים על מצבים - מכונה עוזרת או עדיף לבד, ומנמקים'], [10, 'סיכום: שיעורי בית ולמידה - מה נשאר שלנו']],
    'הצבעת מצבים עם כרטיסי כן ולא ונימוקים.',
    'בלי מחשב: ציד חפצים חכמים בציור של בית - מסמנים ומסבירים מה כל אחד מנחש.',
    ['כרטיסי הצבעה', 'ציור בית'],
    ['איפה מכונה עוזרת לכם הכי הרבה?', 'מה תמיד תעשו בעצמכם?']),
  lesson('elementary', 9, 'robots-sensors', 'חיישנים ורובוטים חכמים',
    ['להבין שרובוט חש בעזרת חיישנים ומחליט לפי כללים ולמידה', 'לתאר מסלול החלטה של רובוט'],
    [[5, 'פתיחה: צועדים בעיניים עצומות לפי הוראות ושואלים מה חסר'], [10, 'הסבר: חיישן הוא העין והאוזן של הרובוט, והמוח מחליט מה לעשות'], [20, 'פעילות: מנווטים חבר רובוט במסלול מכשולים בהוראות צעד וסיבוב'], [10, 'סיכום: מה רובוט עדיין לא יודע לעשות']],
    'ניווט רובוט אנושי במסלול מכשולים בכיתה.',
    'בלי מחשב: אותה פעילות היא הלא-מחוברת - רובוט הוא תלמיד, בלי שום מסך.',
    ['כיסאות כמכשולים', 'סרט סימון'],
    ['מהו חיישן?', 'איזו החלטה קשה לרובוט?']),
  lesson('elementary', 10, 'truth-check', 'בודקים אם זה אמיתי',
    ['לזהות תמונה או סיפור שמכונה המציאה', 'להשתמש בשתי בדיקות לפני שמאמינים'],
    [[5, 'פתיחה: שתי תמונות, אחת מצוירת ואחת מומצאת, מנחשים איזו'], [10, 'הסבר: מכונות יכולות להמציא תמונות וסיפורים שנשמעים אמיתיים'], [20, 'פעילות: בלשי אמת - מחפשים שלושה רמזים חשודים בתמונות ובסיפורים קצרים'], [10, 'סיכום: שואלים מבוגר ובודקים במקום נוסף לפני שמשתפים']],
    'בלשי אמת בקבוצות: מוצאים רמזים חשודים ומציגים לכיתה.',
    'בלי מחשב: סיפורים מודפסים, אחד אמיתי ואחד מומצא, מחפשים רמזים בטקסט בלבד.',
    ['תמונות מודפסות', 'סיפורים קצרים מודפסים'],
    ['מהו רמז שמשהו מומצא?', 'מה עושים לפני שמשתפים תמונה מפתיעה?']),
  lesson('elementary', 11, 'mini-project', 'מיני-פרויקט סיום: ממציאים עוזר חכם',
    ['לתכנן עוזר חכם שפותר בעיה אמיתית', 'להציג מה העוזר לומד ומה הוא לא ישתף לעולם'],
    [[5, 'פתיחה: נזכרים בכל השיעורים ובוחרים בעיה אחת מהכיתה'], [15, 'תכנון בזוגות: מציירים את העוזר, מה הוא חש, ומאילו דוגמאות ילמד'], [15, 'בניית כרזה: שם, ציור, שלושה כללי הוגנות ובטיחות'], [10, 'הצגות קצרות ושאלה אחת מכל זוג למציגים']],
    'בניית כרזת עוזר חכם והצגה לכיתה.',
    'בלי מחשב: כל הפרויקט על נייר - כרזה, ציור וכללים, בלי מסכים בכלל.',
    ['דפים גדולים', 'טושים וצבעים'],
    ['איזו בעיה העוזר שלכם פותר?', 'מאילו דוגמאות הוא ילמד כדי להיות הוגן?'])
]);

const MIDDLE = Object.freeze([
  lesson('middle', 0, 'what-is-ai', 'מה זו בינה מלאכותית ולמידת מכונה',
    ['להבחין בין תוכנה מבוססת כללים למודל שלמד מנתונים', 'לתאר מחזור אימון: נתונים, אימון, בדיקה'],
    [[5, 'פתיחה: שני פתרונות לאותה בעיה - כללים ידניים מול למידה מדוגמאות'], [12, 'הסבר: מודל, נתוני אימון וטעות - איך מודל משתפר מהרבה ניסיונות'], [18, 'פעילות: ממיינים מערכות מוכרות לכללים או ללמידה ומנמקים'], [10, 'סיכום: מתי כללים עדיפים ומתי למידה']],
    'מיון מערכות ונימוק בקבוצות, עם הגנה על בחירה אחת מול הכיתה.',
    'בלי מחשב: בניית מסווג אנושי - כללים כתובים על לוח מול ניחוש מדוגמאות בכרטיסים.',
    ['כרטיסי מערכות', 'לוח'],
    ['מה ההבדל בין כלל למודל?', 'מתי לא הייתם סומכים על למידה?']),
  lesson('middle', 1, 'training-data', 'למידה מדוגמאות ונתוני אימון',
    ['להסביר אימון, אימות ובדיקה ומהי התאמת-יתר בפשטות', 'לבנות ערכת דוגמאות מאוזנת למשימה'],
    [[5, 'פתיחה: מודל שנבחן על אותן שאלות שלמד - למה זה לא הוגן'], [12, 'הסבר: חלוקת נתונים לאימון ובדיקה, וטעויות משני הסוגים'], [18, 'פעילות: בונים ערכת אימון למסווג ציורים ומחליפים ערכות לבדיקה צולבת'], [10, 'סיכום: מה ערכת בדיקה טובה חייבת להכיל']],
    'בניית ערכות אימון ובדיקה צולבת בין קבוצות.',
    'בלי מחשב: כרטיסי ציור וטבלת רישום ניחושים על נייר, עם ספירת טעויות ידנית.',
    ['כרטיסי ציור', 'טבלאות רישום'],
    ['למה בודקים על דוגמאות חדשות?', 'איך נראית ערכת אימון גרועה?']),
  lesson('middle', 2, 'image-recognition', 'זיהוי תמונות ורשתות עצביות',
    ['לתאר בשכבות איך רשת מזהה תמונה מקצוות לצורות לאובייקט', 'להסביר טעות זיהוי אחת ולתקן בדוגמאות'],
    [[5, 'פתיחה: מזהים תמונה שמתגלה שכבה אחרי שכבה'], [12, 'הסבר: שכבות של מאפיינים - קווים, צורות, חלקים, וציון ביטחון'], [18, 'פעילות: צוות אחד בונה רמזי שכבות והשני מנחש, ואז מנתחים טעות'], [10, 'סיכום: ביטחון גבוה הוא לא הוכחה לנכונות']],
    'משחק שכבות רמזים וניתוח טעויות בזוגות צוותים.',
    'בלי מחשב: תמונות מודפסות בחיתוכים הולכים וגדלים, ורישום שלב הניחוש הנכון.',
    ['תמונות מודפסות בשכבות'],
    ['מה רואה השכבה הראשונה של רשת?', 'למה ביטחון גבוה עדיין יכול לטעות?']),
  lesson('middle', 3, 'llm-chatbots', 'מודלי שפה וצ׳אטבוטים',
    ['להסביר חיזוי המילה הבאה והקשרה בשפה פשוטה', 'לזהות הזיה של מודל ולהצליב עם מקור נוסף'],
    [[5, 'פתיחה: מנחשים את המילה הבאה במשפטים ורואים כמה אפשרויות סבירות יש'], [12, 'הסבר: אימון על המון טקסט, חיזוי הסתברותי, ולמה נוצרות הזיות'], [18, 'פעילות: מחבר שרשרת - ממשיכים טקסט כמו מודל, ואז בודקים עובדה אחת שהמציא'], [10, 'סיכום: כלל אצבע - מודל הוא מקור ראשון, לא מקור אחרון']],
    'המשכת טקסט כמו מודל ובדיקת עובדות מומצאות.',
    'בלי מחשב: משחק חיזוי מילה הבאה על לוח, עם הצבעה על ההמשך הסביר ביותר.',
    ['לוח', 'דפי טקסט קצרים'],
    ['מה המודל באמת עושה כשהוא עונה?', 'איך תפסנו הזיה אחת היום?']),
  lesson('middle', 4, 'prompting-verify', 'הנחיות יעילות ובדיקת תשובות',
    ['לנסח הנחיה עם מטרה, הקשר, פורמט ודוגמה', 'לאמת תשובת מודל בשני מקורות בלתי תלויים'],
    [[5, 'פתיחה: אותה שאלה בשתי ניסוחים ותוצאות שונות לגמרי'], [12, 'הסבר: מבנה הנחיה טובה - תפקיד, משימה, אילוצים, פורמט פלט'], [18, 'פעילות: משפרים הנחיות חלשות על כרטיסים ומשווים תשובות אנושיות לתשובות מודל בדמיון'], [10, 'סיכום: רשימת בדיקת אימות לפני שמשתמשים בתשובה']],
    'סדנת שיפור הנחיות על כרטיסים בזוגות.',
    'בלי מחשב: בן זוג משחק מודל צייתן ופשוטו כמשמעו - הנחיה מעורפלת נכשלת מיד.',
    ['כרטיסי הנחיות'],
    ['איזה חלק בהנחיה שינה הכי הרבה?', 'מהי בדיקת האימות הראשונה שלכם?']),
  lesson('middle', 5, 'data-bias', 'נתונים, הטיה והוגנות',
    ['להסביר הטיית נתונים, הטיית תוויות ומדידת פער בין קבוצות', 'להציע תיקון אחד לנתונים ואחד לבדיקה'],
    [[5, 'פתיחה: מודל שלמד רק מקבוצה אחת נבחן על אחרת - צופים בפער'], [12, 'הסבר: מאיפה הטיה נכנסת - איסוף, תיוג, ומי חסר בנתונים'], [18, 'פעילות: חוקרים טבלת תוצאות קטנה, מוצאים פער ומציעים תיקון'], [10, 'סיכום: הוגנות נמדדת בתוצאות לפי קבוצות, לא בכוונות']],
    'חקירת טבלת תוצאות וכתיבת המלצת תיקון.',
    'בלי מחשב: טבלה מודפסת וספירת תאים ידנית בשני צבעים.',
    ['טבלאות מודפסות', 'טושים בשני צבעים'],
    ['איפה נכנסה ההטיה בדוגמה?', 'איך הייתם מודדים שהתיקון עבד?']),
  lesson('middle', 6, 'deepfakes-verify', 'זיופים עמוקים ואימות מידע',
    ['לזהות סימני זיוף בתמונה, בקול ובסרטון', 'ליישם בדיקת מקור, הקשר ואישוש צולב'],
    [[5, 'פתיחה: שתי כותרות מפתיעות - מה בודקים לפני שמשתפים'], [12, 'הסבר: איך נוצר זיוף עמוק ולמה העין כבר לא מספיקה'], [18, 'פעילות: תחנות אימות - כל קבוצה מאמתת פריט אחר ומדווחת ודאות ורמזים'], [10, 'סיכום: שיתוף הוא פעולה - עוצרים כשלא בטוחים']],
    'תחנות אימות בקבוצות עם דיווח ודאות מנומק.',
    'בלי מחשב: פריטים מודפסים בלבד - בודקים מקור, תאריך והקשר על הנייר.',
    ['פריטים מודפסים לאימות'],
    ['מהו סימן הזיוף הכי אמין שמצאתם?', 'מתי נכון לא לשתף גם אם זה נראה אמיתי?']),
  lesson('middle', 7, 'privacy-safety', 'פרטיות ובטיחות בעידן הבינה המלאכותית',
    ['למפות אילו נתונים שירות אוסף ולמה', 'לנסח מדיניות אישית: מה לא מזינים למודל לעולם'],
    [[5, 'פתיחה: מה מודל יכול לזכור משיחה אחת תמימה'], [12, 'הסבר: הזנת נתונים לאימון, הרשאות, ומחיקה - מה בשליטתנו ומה לא'], [18, 'פעילות: בונים תווית פרטיות לשירות דמיוני - אוסף, שומר, משתף, מוחק'], [10, 'סיכום: שלושה קווים אדומים אישיים שכל אחד כותב לעצמו']],
    'בניית תווית פרטיות לשירות דמיוני בקבוצות.',
    'בלי מחשב: כרטיסי תרחישים - ממיינים מה מזינים ומה לא, ומנמקים.',
    ['כרטיסי תרחישים', 'דפי תווית'],
    ['מה לא תזינו למודל לעולם?', 'איך יודעים אם שירות מוחק באמת?']),
  lesson('middle', 8, 'ai-creativity', 'בינה מלאכותית ויצירה',
    ['להבחין בין יצירה, עריכה וייצור המוני בעזרת מודל', 'להפיק יצירה עם קרדיט הוגן לתהליך'],
    [[5, 'פתיחה: מי חתום על יצירה שהמודל הציע ואדם ערך'], [12, 'הסבר: מודלים יוצרים מהמשכים סטטיסטיים של יצירות קודמות - וזכויות וקרדיט'], [18, 'פעילות: יוצרים סיפור או כרזה עם שלבי הצעה, בחירה ועריכה מתועדים'], [10, 'סיכום: מתי שימוש במודל פוגע בלמידה שלנו']],
    'יצירה מתועדת-שלבים בזוגות: הצעה, בחירה, עריכה.',
    'בלי מחשב: מגזין גזירי משפטים - מרכיבים סיפור מגזרים כמו מודל ובוחרים עריכה.',
    ['גזירי משפטים מודפסים', 'דפים וצבעים'],
    ['מי היוצר כשמודל מציע ואדם בוחר?', 'איך נותנים קרדיט הוגן?']),
  lesson('middle', 9, 'ai-society-work', 'בינה מלאכותית, עבודה וחברה',
    ['למפות מטלות במקצוע שמודל משנה ומטלות שנשארות אנושיות', 'לטעון בעד ונגד אוטומציה של מטלה אחת'],
    [[5, 'פתיחה: מקצוע אחד על הלוח - אילו מטלות שלו משתנות'], [12, 'הסבר: אוטומציה של מטלות, לא של מקצועות שלמים, ומקצועות חדשים שנוצרים'], [18, 'פעילות: דיבייט קצר - כל קבוצה טוענת צד אחר על מטלה שבחרה'], [10, 'סיכום: מיומנות אנושית אחת להשקיע בה']],
    'דיבייט מטלות בקבוצות עם שופטי כיתה.',
    'בלי מחשב: כרטיסי מטלות מקצוע על נייר - ממיינים למשתנה, נשאר, וחדש.',
    ['כרטיסי מטלות'],
    ['מטלה שהשתנתה, או מקצוע שלם?', 'באיזו מיומנות אנושית תשקיעו?']),
  lesson('middle', 10, 'ethics-responsibility', 'אתיקה: מי אחראי כשהמכונה טועה',
    ['לנתח תרחיש נזק: מפתח, מפעיל, משתמש ונתונים', 'לנסח כלל אחריות אחד למערכת בית-ספרית'],
    [[5, 'פתיחה: תרחיש קצר - מודל טעה ומישהו נפגע, מי אשם'], [12, 'הסבר: אחריות מבוזרת, פיקוח אנושי, וזכות ערעור על החלטת מכונה'], [18, 'פעילות: בית דין כיתתי - טוענים תפקידים שונים על אותו תרחיש'], [10, 'סיכום: כלל זהב - החלטה חשובה תמיד עם אדם אחראי וערעור']],
    'בית דין כיתתי על תרחיש נזק.',
    'בלי מחשב: כרטיסי תפקידים ותרחיש מודפס, בלי מסכים.',
    ['כרטיסי תפקידים', 'תרחיש מודפס'],
    ['מי אחראי כשהמודל טועה?', 'מהו כלל האחריות שלכם?']),
  lesson('middle', 11, 'mini-project', 'מיני-פרויקט סיום: פותרים בעיה עם בינה מלאכותית',
    ['להגדיר בעיה, קהל ונתונים לפרויקט צוותי', 'להציג סיכונים, הוגנות ובדיקת אימות בתוכנית'],
    [[5, 'פתיחה: בוחרים בעיה אמיתית מבית הספר או מהשכונה'], [15, 'תכנון: בעיה, קהל, אילו נתונים צריך, ואיך נאמן ונבדוק'], [15, 'בניית מצגת או כרזה: פתרון, סיכוני הוגנות ופרטיות, ותוכנית אימות'], [10, 'הצגות ושאלות - כל צוות מקבל שאלת אתיקה אחת']],
    'תכנון ובניית מצגת פרויקט בצוותים.',
    'בלי מחשב: כל הפרויקט ככרזה על נייר, כולל תוכנית הנתונים והאימות.',
    ['דפים גדולים', 'טושים'],
    ['איזו בעיה הפרויקט פותר ולמי?', 'מהו הסיכון הכי גדול בתוכנית שלכם?'])
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
function getLesson(track, index) {
  const list = lessonsForTrack(track);
  if (!Number.isInteger(index) || index < 0 || index >= list.length) throw new Error('invalid lesson index for track ' + track);
  return list[index];
}
function lessonById(id) {
  const found = ALL_LESSONS.find((l) => l.id === id);
  if (!found) throw new Error('unknown lesson id');
  return found;
}
function flowMinutes(lesson) { return lesson.flowHe.reduce((sum, f) => sum + f.minutes, 0); }

// The 45-minute flow as timeline steps for the lesson screen: a short title, the
// duration and the body of each step. Steps are written "title: body"; a step
// without that prefix keeps its whole text as the body under a numbered title.
function flowTimeline(lesson) {
  if (!lesson || !Array.isArray(lesson.flowHe) || lesson.flowHe.length === 0) {
    throw new Error('invalid lesson: flowHe');
  }
  return Object.freeze(lesson.flowHe.map((f, i) => {
    if (!f || !Number.isInteger(f.minutes) || f.minutes <= 0 || typeof f.stepHe !== 'string' || f.stepHe.trim() === '') {
      throw new Error('invalid lesson: flowHe');
    }
    const cut = f.stepHe.indexOf(': ');
    const hasTitle = cut > 0 && cut <= 28;
    return Object.freeze({
      minutes: f.minutes,
      titleHe: hasTitle ? f.stepHe.slice(0, cut) : 'שלב ' + (i + 1),
      bodyHe: hasTitle ? f.stepHe.slice(cut + 2) : f.stepHe
    });
  }));
}

function resolveTrack(trackByPair, pairIndex) {
  let track;
  if (typeof trackByPair === 'function') track = trackByPair(pairIndex);
  else if (trackByPair && typeof trackByPair === 'object') track = trackByPair[pairIndex];
  if (track === undefined || track === null) throw new Error('missing track for pair ' + pairIndex);
  return assertTrack(track);
}
function sessionOrderKey(s) {
  return [Number.isInteger(s.week) ? s.week : 0, typeof s.slot === 'string' ? s.slot : '', typeof s.date === 'string' ? s.date : ''];
}
// Each session gets the next lesson of its group's track, in session order within the group.
// More sessions than lessons start a new cycle (cycle 2 repeats the track from lesson 1).
function assignLessons(sessions, trackByPair) {
  const list = Array.isArray(sessions) ? sessions : [];
  list.forEach((s) => { if (!s || !Number.isInteger(s.pairIndex) || s.pairIndex < 0) throw new Error('invalid session: pairIndex'); });
  const byPair = new Map();
  list.forEach((s, i) => { if (!byPair.has(s.pairIndex)) byPair.set(s.pairIndex, []); byPair.get(s.pairIndex).push(i); });
  const out = new Array(list.length);
  byPair.forEach((indexes, pairIndex) => {
    const track = resolveTrack(trackByPair, pairIndex);
    const lessons = lessonsForTrack(track);
    const ordered = indexes.slice().sort((a, b) => {
      const ka = sessionOrderKey(list[a]); const kb = sessionOrderKey(list[b]);
      for (let k = 0; k < ka.length; k += 1) { if (ka[k] < kb[k]) return -1; if (ka[k] > kb[k]) return 1; }
      return a - b;
    });
    ordered.forEach((sessionIdx, pos) => {
      const lessonIndex = pos % lessons.length;
      out[sessionIdx] = Object.freeze(Object.assign({}, list[sessionIdx], {
        track, sessionIndex: pos, cycle: Math.floor(pos / lessons.length) + 1,
        lessonIndex, lessonId: lessons[lessonIndex].id, titleKey: lessons[lessonIndex].titleKey
      }));
    });
  });
  return Object.freeze(out);
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
function deliveryKeyOf(pairIndex, lessonId, cycle) { return pairIndex + '|' + lessonId + '|' + (Number.isInteger(cycle) ? cycle : 1); }
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
    lines.push(r.pairIndex + ',' + r.track + ',' + r.total + ',' + r.delivered + ',' + (r.percent === null ? '' : r.percent) + ',' + (r.nextLessonId || ''));
  });
  return lines.join('\n') + '\n';
}

module.exports = {
  TRACKS, TRACK_GRADES, LESSON_MINUTES, ALL_LESSONS,
  lessonsForTrack, getLesson, lessonById, trackForGrade, flowMinutes, flowTimeline,
  assignLessons, todayLesson, makeDeliveryLog, setDelivered, isDelivered, deliveryKey, lessonProgress, progressToCsv
};
