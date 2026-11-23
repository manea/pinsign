# سجل التغييرات — «PinSign»

يُوثَّق في هذا الملف كل تغيير برمجي أو معماري في مشروع **«PinSign»** (`projects/pinsign/`).

---

## [0.5.0] — 2026-11-24 — الإطلاق الإنتاجي المفتوح المصدر والمصدر المفتوح (GitHub)
- **تجهيز الإصدار المفتوح المصدر (`LICENSE`, `.github/workflows/ci.yml`, `docs/screenshots/`)**:
  - إضافة رخصة `MIT License` وسير عمل `GitHub Actions CI` (تشغيل `typecheck` و`Vitest` و`vite build` على `Node 22`)، ونسخ لقطات الواجهة الست الموثقة، وسكربت التصدير المنقّى للنسخة العامة.
- **النشر الإنتاجي والربط المركزي**:
  - إعداد قوالب النشر المستقل (`Docker Compose` و`systemd` و`Caddy` و`Cloudflare Workers`) وإطلاق المستودع المفتوح المصدر.

## [0.4.0] — 2026-11-24 — المرحلة 4: اختبارات Playwright E2E والفحص البصري وحزمة النشر $0
- **اختبارات Playwright الشاملة (`tests/e2e/pinsign.spec.ts`)**:
  - **3/3** سيناريوهات E2E ناجحة عبر المتصفح الحقيقي (`1280x800` سطح المكتب و`390x844` الجوال) بدون أي أخطاء وحدة تحكم: ثبات المظهرين `Studio Slate / Midnight` والاتجاهين `EN LTR / AR RTL`، دورة الدبابيس بالنقر ووسم `out_of_scope` (`350`) وعدّاد الجولات ومقتطف `/embed.js` (`Access-Control-Allow-Origin: *`) وقفل العائق والتوقيع المكتوب/المرسوم وشهادة الإطلاق `SIGN-YYYY-0001`..`0002` ورفع صورة `PNG` حقيقية.
- **تحسينات الفحص البصري وتناسق الجوال/RTL (`App.tsx`, `CertificateView.tsx`, `ReviewCanvasBoard.tsx`)**:
  - معالجة جدول سجل الملاحظات على شاشات الجوال (`sm:hidden`) بتحويله إلى بطاقات متجاوبة تمنع القصّ الأفقي مع إبقاء جدول `A4` للسطح والطباعة.
  - تثبيت اتجاه `dir="ltr"` على نسب الجولات (`1 / 2`) وروابط التجربة (`stagingUrl`) داخل السياق العربي `RTL`، وإضافة `disabled={busyAction}` على حقل رفع الشاشة (`upload-screen-input`) لمنع تداخل الطوابير.
- **حزمة النشر المجانية ($0) والوثائق**:
  - إنشاء [`wrangler.jsonc`](wrangler.jsonc) لـ Cloudflare Workers Static Assets الآمنة تجارياً، و[`Dockerfile`](Dockerfile) و[`docker-compose.yml`](docker-compose.yml)، ومجلد [`deploy/`](deploy/) (`.env.example`, `Caddyfile`, `pinsign.service`, `backup-sqlite.sh` شاملاً نسخ مجلد `uploads`)، ودليلي [`README.md`](README.md) و[`launch/DEPLOY-AND-SHARE.md`](launch/DEPLOY-AND-SHARE.md).

## [0.3.0] — 2026-11-24 — المرحلة 3: واجهة Studio Slate & Coral Pin التفاعلية وشهادة الإطلاق PDF
- **تصميم ومظهر الواجهة (`index.html`, `src/index.css`, `public/favicon.svg`)**:
  - بناء الواجهة بـ **React 19 + Tailwind CSS v4** بمظهرين: **Studio Slate** (نهاري) و**Midnight** (داكن) مع دعم التبديل الفوري بين الإنجليزية (`LTR`) والعربية (`RTL`) وحفظ التفضيلات محلياً، بالإضافة لقواعد الطباعة `A4 @media print`.
- **الموجه العام واللوحات والمكونات (`src/App.tsx`, `src/components/*`, `src/lib/*`)**:
  - [`src/App.tsx`](src/App.tsx): لوحة الاستوديو ومشغّل القوالب الثلاثة، فلاتر الحالة، سجل شهادات الإطلاق الصادرة، وتوجيه المسارات (`/`, `/r/:slug`, `/cert/:certificateNumber`) مع دعم `BASE_PATH` via [`src/lib/basePath.ts`](src/lib/basePath.ts).
  - [`src/components/ReviewCanvasBoard.tsx`](src/components/ReviewCanvasBoard.tsx): لوحة الدبابيس التفاعلية بالنقر لتحديد الموقع `(xPct, yPct)`، مبدّل الشاشات، رفع الصور، عدّاد الجولات مع رسوم النطاق الإضافي `out_of_scope`، الردود، ونافذة مقتطف `<script>` + رسالة الدعوة للعميل.
  - [`src/components/SignaturePad.tsx`](src/components/SignaturePad.tsx) و[`src/components/CertificateView.tsx`](src/components/CertificateView.tsx): التوقيع الكتابي والمرسوم بالماوس/اللمس (`Canvas`)، مع وثيقة شهادة الإطلاق القابلة للطباعة وتحقق نزاهة `SHA-256` الفوري (`verifySignOffIntegrity`).
  - [`src/lib/api.ts`](src/lib/api.ts) و[`src/lib/i18n.ts`](src/lib/i18n.ts): طبقة اتصال كاملة مع وضع محلي احتياطي `localStorage` للنشر الساكن `$0` وترجمات `EN / AR` كاملة.
- **التحقق**: `npm run typecheck` (`0` أخطاء)، **13/13** Vitest، `npm run build`، وفحص التشغيل الحي لـ SPA fallback على المنفذ `4186`.

## [0.2.0] — 2026-11-24 — المرحلة 2: خادم Node 22 + SQLite WAL وواجهات API ومقتطف embed.js ورفع اللقطات
- **طبقة قاعدة البيانات الدائمة (`server/db.mjs`)**: إعداد `SQLite WAL` (`pinsign.sqlite`) بأربعة جداول (`boards`, `certificates`, `certificate_counters`, `audit_events`) مع معاملة ذرية متزامنة `BEGIN IMMEDIATE ... COMMIT` لإصدار شهادات الإطلاق `SIGN-YYYY-0001` وحساب بصمة التثبيت `SHA-256` وفرض القفل (`409 BOARD_LOCKED` و`409 ALREADY_APPROVED`) والاستنساخ إلى لوحة مراجعة جديدة.
- **خادم HTTP وواجهات API (`server/app.mjs`, `server/app.d.mts`, `server/index.mjs`)**:
  - إعادة استخدام `src/core/*.ts` مباشرة على المنفذ `4183` مع دعم المسار الفرعي `BASE_PATH` وترويسات الأمان.
  - حفظ صور الشاشات المرفوعة (`PNG`, `JPEG`, `WebP`) مع التحقق من البايتات السحرية (Magic Bytes) وتقديمها عبر `/api/uploads/:filename`.
  - نقطة مقتطف الودجت `/embed.js` (بوضع `Shadow DOM` و`Access-Control-Allow-Origin: *`) لإرسال الدبابيس مباشرة من روابط التجربة دون `CORS Proxy`.
  - واجهات بوابة العميل `/api/public/boards/:slug` والردود وتحديث حالات الدبابيس (`out_of_scope` + التسعيرة الإضافية) وانتقال الجولات والترقيم الذري للشهادات.
- **التحقق (`tests/unit/pinsignServer.test.ts`)**: `npm run typecheck` (`0` أخطاء)، **13/13** Vitest (`8` نواة + `5` تكامل خادم)، وفحص التشغيل الحي على `4185` (`/api/health` و`/embed.js`).

## [0.1.0] — 2026-11-24 — المرحلة 1: التوثيق وهيكلة المشروع والمحرك الأساسي لـ PinSign
- إعداد وثيقة المواصفات والمعمارية [`research/05-pinsign-spec-and-architecture.md`](../../research/05-pinsign-spec-and-architecture.md) لتغطية فجوة السوق أمام أدوات المراجعة البصرية المكلفة وتطبيق عدّاد الجولات وشهادة اعتماد الإطلاق.
- تأسيس هيكل المشروع المستقل `projects/pinsign/` (`package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`).
- بناء المحرك الأساسي المتوافق مع المتصفح وNode 22 في `src/core/`:
  - [`src/core/types.ts`](src/core/types.ts): عقود الشاشات، الدبابيس، الردود، سجل جولات المراجعة، وشهادة اعتماد الإطلاق.
  - [`src/core/revisions.ts`](src/core/revisions.ts): ضبط إحداثيات الدبابيس، حاسبة مقاييس الجولات وتكاليف النطاق الإضافي (`out_of_scope` + `extraRoundFee`)، التحقق من العوائق (`blocker`)، ومنع التعديل بعد القفل (`BOARD_LOCKED`).
  - [`src/core/certificate.ts`](src/core/certificate.ts): توليد بصمة التثبيت الحتمية `SHA-256` لشهادة اعتماد الإطلاق والتحقق من عدم التلاعب (`verifySignOffIntegrity`).
  - [`src/core/embedSnippet.ts`](src/core/embedSnippet.ts): مولد مقتطف `<script>` آمن ضد XSS مع رسائل الدعوة ثنائية اللغة `EN / AR`.
  - [`src/core/presets.ts`](src/core/presets.ts): 3 قوالب مشاريع جاهزة مع شاشات wireframe بصيغة SVG وعيّنات دبابيس تفاعلية.
- التحقق عبر `npm run typecheck` و`Vitest` (`tests/unit/pinsignCore.test.ts`).
