# Agent notes

- **מדיניות מיזוג (חובה).** הענף הראשי ( או ) מוגן. אסור למזג PRs ישירות ואסור לדחוף ישירות אליו. פתח PR מענף לולאה ( או ) או dependabot. הלולאות לא ממזגות בעצמן. המיזוג האוטומטי בשרת ( דרך ) רץ רק כאשר סוקר ה-pre-PR ( — Gemini או מודל אחר השונה מהמחבר) אישר בלי בעיות חוסמות, וכל בדיקות GitHub כולל  ירוקות על ה-head הנוכחי, וה-PR הוא MERGEABLE בלי קונפליקט. אין להמתין לאישור מיזוג ידני נוסף. (כלל אבירן 22.11.2026 08:13.)
- **עיצוב.** Build UI minimal and functional; never wait for designs; approved Claude Design packages are applied later as polish.
## Modern web guidance

For HTML, CSS, and client-side JavaScript, follow `.agents/skills/modern-web-guidance/SKILL.md` before implementing or updating UI, layout, or browser behavior. Run it with `npx -y modern-web-guidance@latest`. The CLI needs no API keys and runs offline (if the registry is unreachable and the package is already cached, retry with `npx --offline`). Skip it for backend, infrastructure, and tooling-only changes.
