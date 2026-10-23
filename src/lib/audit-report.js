'use strict';
// PeerEd — Hebrew privacy / retention statement for institutional audits and regulatory review.

const { getRetentionPolicy } = require('./retention.js');

// A statement handed to a regulator must not read "up to undefined days" or "up to Infinity days":
// a supplied policy needs a whole number of days, 0 or more, for both categories, or it is refused.
function wholeDays(active, category) {
  const days = active[category];
  if (!Number.isInteger(days) || days < 0) {
    throw new Error('invalid policy: ' + category + ' must be a whole number of days, 0 or more');
  }
  return days;
}

// One day reads "יום אחד", not "1 ימים".
function daysHe(days) {
  return days === 1 ? 'יום אחד' : days + ' ימים';
}

// The profile line lists what a stored person holds. A pupil's record also holds parentConsent (a yes or
// a no, nothing about the parent), and the match engine pairs no pupil without it; the participants
// screen's banner names it, so a statement for a regulator that left it out described less than the
// app keeps about a minor - and left out the one rule that keeps a minor out of the matching.
function generateAuditReport(policy) {
  const active = policy === undefined ? getRetentionPolicy() : policy;
  if (active === null || typeof active !== 'object' || Array.isArray(active)) {
    throw new Error('invalid policy: expected an object with profile and match days');
  }
  const profileDays = wholeDays(active, 'profile');
  const matchDays = wholeDays(active, 'match');

  return [
    'הצהרת פרטיות ושמירת מידע — PeerEd',
    '',
    'מידע שנאסף:',
    '• נתוני פרופיל (תפקיד, אזור, זמינות, מקצועות לימוד, ולתלמיד גם האם התקבל אישור הורה) — לצורך התאמת חונכות.',
    '• אישור הורה נשמר ככן או לא בלבד, בלי שם ההורה, בלי תאריך ובלי מסמך; תלמיד בלי אישור הורה לא נכנס לשידוך.',
    '• נתוני התאמות חונכות (מי שויך למי ובאילו שעות) — לצורך ניהול מחזור החונכות.',
    '',
    'משך שמירה (לפי מדיניות השמירה הפעילה במערכת):',
    '• נתוני פרופיל: עד ' + daysHe(profileDays) + ' ממועד עדכון אחרון.',
    '• נתוני התאמות: עד ' + daysHe(matchDays) + ' ממועד יצירת ההתאמה או סיום מחזור החונכות.',
    '',
    'פרוטוקול מחיקה:',
    '• בסיום תקופת השמירה, רשומות פרופיל והתאמה שעברו את המגבלה מוסרות מהמערכת.',
    '• לא נשמר עותק ארכיוני של נתונים אישיים מעבר לתקופות המפורטות לעיל.',
    '• מחיקה מוחלטת: הנתונים לא זמינים למנוע ההתאמות ולא משמשים לצורך התאמות עתידיות.'
  ].join('\n');
}

module.exports = {
  generateAuditReport
};
