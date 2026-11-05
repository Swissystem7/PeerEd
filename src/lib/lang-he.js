'use strict';
// PeerEd - Hebrew strings for the NEW coordinator screens (stage 7). Separate dictionaries because
// the i18n mechanism of PR #358 is not merged; key parity with lang-ar/lang-ru is test-enforced.
module.exports = Object.freeze({
  'sched.title': 'לוח מפגשים שבועי', 'sched.sessionsPerWeek': 'מפגשים בשבוע', 'sched.duration': 'משך מפגש (דקות)',
  'sched.conflicts': 'התנגשויות', 'sched.waitlist': 'רשימת המתנה', 'sched.alternatives': 'חלופות אפשריות',
  'cap.title': 'קיבולת וביקוש', 'cap.demand': 'ביקוש', 'cap.supply': 'היצע', 'cap.gapAlert': 'הביקוש גדול מההיצע',
  'sem.title': 'ניהול סמסטר', 'sem.holidays': 'חופשות וחגים', 'sem.cancelled': 'בוטל', 'sem.makeup': 'השלמה',
  'sem.attendance': 'נוכחות', 'sem.held': 'התקיים', 'sem.missed': 'לא התקיים', 'sem.postponed': 'נדחה',
  'sem.stalePair': 'הזוג לא נפגש כבר שבועיים',
  'rep.title': 'דוחות רכז', 'rep.weekly': 'שבועי', 'rep.monthly': 'חודשי', 'rep.semester': 'סמסטריאלי',
  'rep.exportCsv': 'ייצוא CSV', 'rep.exportIcs': 'ייצוא ICS', 'rep.print': 'הדפסה / PDF',
  'imp.title': 'ייבוא זמינויות', 'imp.pasteHint': 'הדביקו CSV: role,region,subjects,availability', 'imp.errors': 'שורות שלא יובאו',
  'wiz.title': 'מילוי זמינות', 'wiz.submit': 'שליחת הזמינות',
  'bak.title': 'גיבוי ושחזור', 'bak.create': 'יצירת גיבוי מוצפן', 'bak.restore': 'שחזור מגיבוי', 'bak.passphrase': 'סיסמת גיבוי',
  'guide.title': 'מדריך רכז', 'guide.open': 'פתיחת המדריך'
});
