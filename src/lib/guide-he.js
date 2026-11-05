'use strict';
// PeerEd - the coordinator guide, in Hebrew, inside the app (stage 9). Content only: sections the
// help screen renders. Examples use codes only (SUN_16, MATH) - the guide itself holds no personal
// data, and a search query passes the same privacy gate as any other free text in the system.

const { findPersonalData, PERSONAL_DATA_ERROR } = require('./validator.js');

const GUIDE_SECTIONS = Object.freeze([
  Object.freeze({ id: 'start', titleHe: 'מתחילים', stepsHe: Object.freeze(['פותחים את הקובץ app.html בדפדפן - אין שרת ואין התקנה.', 'עובדים לפי הסדר: אנשים, שידוך, לוח, נוכחות, דוחות.', 'כל המידע נשאר במכשיר הזה בלבד.']) }),
  Object.freeze({ id: 'import', titleHe: 'ייבוא זמינויות', stepsHe: Object.freeze(['מדביקים טבלת CSV עם העמודות role,region,subjects,availability.', 'שורת תלמיד נראית כך: pupil,CENTER,MATH,SUN_16;SUN_17.', 'שורה עם טלפון או מייל נעצרת כולה - שער הפרטיות בודק את ההדבקה לפני הייבוא.', 'אישור הורה לא מגיע מהטבלה; מסמנים אותו בנפרד לכל תלמיד.']) }),
  Object.freeze({ id: 'match', titleHe: 'שידוך', stepsHe: Object.freeze(['השידוך מדרג כל זוג לפי אזור, שעות, מקצוע, רמה, שפה והעדפות, ובוחר את הסכום הכולל הטוב ביותר - לא זוג-זוג.', 'לכל זוג יש הסבר בעברית עם פירוט הציון; קראו אותו לפני אישור.', 'זוג שסומן ידנית נעול ולא יזוז בריצה חוזרת; שחרור נעשה רק למי שצריך שידוך מחדש.', 'תלמיד בלי אישור הורה לא משודך, גם אם ההתאמה מושלמת.']) }),
  Object.freeze({ id: 'schedule', titleHe: 'לוח שבועי', stepsHe: Object.freeze(['בוחרים משך מפגש וכמה מפגשים בשבוע לכל זוג.', 'התנגשות (סטודנט בשני מקומות, תלמיד מעל המכסה) שולחת את הזוג לרשימת ההמתנה - לא מוחקת אותו.', 'לכל זוג ממתין מוצגות עד שלוש חלופות פנויות.', 'במסך הקיבולת רואים איפה הביקוש גדול מההיצע וכמה חונכים חסרים.']) }),
  Object.freeze({ id: 'attendance', titleHe: 'נוכחות וסמסטר', stepsHe: Object.freeze(['מגדירים תחילת וסוף סמסטר; חופשות וחגים נטענים מהלוח הישראלי, ואפשר להחליף אותם.', 'לכל מפגש: התקיים, לא התקיים, נדחה או בוטל. ביטול ביום חופש לא דורש השלמה.', 'זוג שלא נפגש שבועיים מקבל התראה - בדקו מה קרה לפני שמשבצים מחדש.']) }),
  Object.freeze({ id: 'reports', titleHe: 'דוחות וייצוא', stepsHe: Object.freeze(['דוח שבועי, חודשי או סמסטריאלי מציג כמה התקיים, לפי מקצוע ואזור.', 'ייצוא CSV לשמירה, ICS ליומן, והדפסה שומרת PDF.', 'בדוחות יש רק מספרים וקודים פנימיים - לעולם לא פרטי תלמידים.']) }),
  Object.freeze({ id: 'backup', titleHe: 'גיבוי ושחזור', stepsHe: Object.freeze(['יוצרים גיבוי מוצפן לקובץ עם סיסמה שרק הרכז מכיר.', 'סיסמה שגויה וקובץ פגום נראים אותו הדבר - בכוונה.', 'שחזור מחזיר את המצב כפי שהיה; בדקו אותו לפני שממשיכים לעבוד.']) }),
  Object.freeze({ id: 'privacy', titleHe: 'פרטיות', stepsHe: Object.freeze(['אסור להקליד שם, טלפון, מייל או תעודת זהות של קטין בשום שדה - המערכת חוסמת טקסט כזה.', 'אם משהו נחסם, הסירו את הפרט האישי ונסו שוב; החסימה היא ההגנה, לא תקלה.', 'מחיקת המכשיר מוחקת הכול, כולל גיבויים מקומיים שנשמרו בדפדפן.']) })
]);

function guideToc() { return GUIDE_SECTIONS.map((s) => ({ id: s.id, titleHe: s.titleHe })); }
function guideSection(id) {
  const s = GUIDE_SECTIONS.find((x) => x.id === id);
  if (!s) throw new Error('unknown guide section');
  return s;
}
function guideText() {
  return GUIDE_SECTIONS.map((s) => '## ' + s.titleHe + '\n' + s.stepsHe.map((x, i) => (i + 1) + '. ' + x).join('\n')).join('\n\n') + '\n';
}
function searchGuide(query) {
  if (typeof query !== 'string' || query.trim() === '') return [];
  if (findPersonalData(query).length > 0) throw new Error(PERSONAL_DATA_ERROR);
  const q = query.trim();
  return GUIDE_SECTIONS.filter((s) => s.titleHe.indexOf(q) !== -1 || s.stepsHe.some((x) => x.indexOf(q) !== -1)).map((s) => ({ id: s.id, titleHe: s.titleHe }));
}

module.exports = { GUIDE_SECTIONS, guideToc, guideSection, guideText, searchGuide };
