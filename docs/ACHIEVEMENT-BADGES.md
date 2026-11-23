# מערכת אותות הצטיינות ושלבי מלגה (SVG Achievement Badges)

> **קטלוג אותות ומפרט וקטורי** — PeerEd  
> **תיקיית קבצים:** [design/badges/](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/)

---

## 1. סקירה ומטרת המערכת

מערכת האותות של PeerEd מעניקה הכרה ויזואלית ומשוב חיובי לתלמידים ולסטודנטים מתנדבים, תוך עמידה מלאה בעקרון **Zero-PII** וללא חשיפת שמות או פרטים אישיים.  
האותות משמשים כסמלים וקטוריים עצמאיים בפורמט SVG, קלי משקל, רספונסיביים ונגישים, המתאימים להטמעה בטבלאות שידוך, פרופילי משתתף ודוחות מלגה רשמיים (עבור פר"ח, המל"ג ומשרד החינוך).

---

## 2. קטלוג האותות הוקטוריים (10 אותות)

| קובץ SVG | שם האות בעברית | תיאור וקריטריון קבלה | מפתח קוד / טריגר |
| :--- | :--- | :--- | :--- |
| [`scholarship-25.svg`](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/scholarship-25.svg) | **אות מלגה 25%** | השלמת רבע ראשון ממכסת שעות המלגה (25 שעות מאומתות). | `attendance.js` (milestone 25) |
| [`scholarship-50.svg`](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/scholarship-50.svg) | **אות מלגה 50%** | הגעה לאמצע הדרך — 50 שעות התנדבות מאושרות בלוג. | `attendance.js` (milestone 50) |
| [`scholarship-75.svg`](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/scholarship-75.svg) | **אות מלגה 75%** | ישורת אחרונה לקראת סיום — 75 שעות התנדבות. | `attendance.js` (milestone 75) |
| [`scholarship-100.svg`](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/scholarship-100.svg) | **אות מלגה 100% מושלם** | השלמה מלאה של 100 שעות מלגה וזכאות לתעודת התנדבות. | `attendance.js` (milestone 100) |
| [`ai-mastery.svg`](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/ai-mastery.svg) | **אות התאמת AI מושלמת** | חפיפה מלאה (100%) בכל 4 תחומי הבינה המלאכותית: הנחיה, יצירה, קוד ואתיקה. | `match2.js` (`aiTopicOverlap === 1.0`) |
| [`privacy-guardian.svg`](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/privacy-guardian.svg) | **שומר הפרטיות (Zero PII)** | עמידה מלאה בתקנות הגנת מידע, ללא פרטים מזהים וללא חריגות רגולטוריות. | `validator.js` / Zero-PII gate |
| [`emergency-responder.svg`](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/emergency-responder.svg) | **מענה חירום מהיר** | שיבוץ מהיר והתייצבות לליווי תלמיד באזור פינוי או מתחם חירום תוך 24 שעות. | `modes.js` (emergency mode active) |
| [`hours-champion.svg`](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/hours-champion.svg) | **אלוף שעות (10+)** | רצף הדרכה שבועי/חודשי גבוה של מעל 10 שעות מפגש רציפות. | `attendance.js` (totalHours >= 10) |
| [`perfect-attendance.svg`](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/perfect-attendance.svg) | **נוכחות מושלמת 100%** | אפס ביטולים והתייצבות של 100% בכל המפגשים שנקבעו לאורך הסמסטר. | `attendance.js` (missedSessions === 0) |
| [`challenge-finalist.svg`](file:///C:/Users/avira/factory-apps/burn-work-agy/PeerEd/design/badges/challenge-finalist.svg) | **פיינליסט אתגר PeerEd** | העפלה לשלב הגמר באתגר הלמידה והפיתוח הקהילתי של מודולי הלימוד. | `curriculum.js` (`selectChallengeFinalists`) |

---

## 3. מאפיינים טכניים ונגישות (SVG Specs)

- **מידות וקנה מידה:** `viewBox="0 0 120 120"`, רוחב וגובה ניתנים לשינוי עצמאי (Scalable Vector Graphics).
- **תאימות צבעים:** שימוש בפלטת הצבעים הרשמית של PeerEd:
  - גוון מפתח (Teal): `#0F766E`, `#14B8A6`, `#CCFBF1`
  - גוון אינדיגו/מלכותי: `#4338CA`, `#6366F1`, `#EEF2FF`
  - גוון זהב/הצטיינות: `#F59E0B`, `#FBBF24`, `#FEF3C7`
  - גוון הצלחה (Emerald): `#15803D`, `#10B981`, `#F0FDF4`
  - גוון חירום (Warm/Ruby): `#9A3412`, `#DC2626`, `#FEE2E2`
- **נגישות (Accessibility):** לכל קובץ SVG מוטמעים אלמנטי `<title>` ו-`<desc>` בעברית עם `role="img"` ו-`aria-labelledby` מותאם לקוראי מסך.
- **עצמאות מרשת:** כל הגרדיאנטים, הפילטרים והנתיבים מוגדרים מקומית בתוך ה-SVG ללא תלות בקבצים חיצוניים או פונטים חיצוניים.
