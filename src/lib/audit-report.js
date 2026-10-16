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
    '• נתוני פרופיל (תפקיד, אזור, זמינות, מקצועות לימוד) — לצורך התאמת חונכות.',
    '• נתוני התאמות חונכות (מי שויך למי ובאילו שעות) — לצורך ניהול מחזור החונכות.',
    '',
    'משך שמירה (לפי מדיניות השמירה הפעילה במערכת):',
    '• נתוני פרופיל: עד ' + profileDays + ' ימים ממועד עדכון אחרון.',
    '• נתוני התאמות: עד ' + matchDays + ' ימים ממועד יצירת ההתאמה או סיום מחזור החונכות.',
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
