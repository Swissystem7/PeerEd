'use strict';
// PeerEd — Hebrew privacy / retention statement for institutional audits and regulatory review.

const { getRetentionPolicy } = require('./retention.js');

function generateAuditReport() {
  const policy = getRetentionPolicy();
  const profileDays = policy.profile;
  const matchDays = policy.match;

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
