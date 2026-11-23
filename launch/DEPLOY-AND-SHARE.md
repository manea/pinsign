# دليل النشر المجاني ($0) والمشاركة الأخلاقية — PinSign

يوفّر هذا الدليل مسارَي نشر عمليين بميزانية ابتدائية **\$0** دون رسوم شهرية لـ MarkUp.io أو Pastel، بالإضافة إلى مسودات مشاركة مجتمعية أخلاقية لمصممي المواقع والاستوديوهات.

---

## المسار أ: النشر الساكن المجاني والآمن تجارياً ($0 — Cloudflare Workers Static Assets)

> **تنبيه التراخيص التجارية**: يعتمد الاستوديو حصراً على **Cloudflare Workers Static Assets / Pages** للنشر المجاني التجاري الآمن؛ ويُحظر تماماً استخدام **Vercel Hobby** (غير تجاري فقط) أو **GitHub Pages** (مقيد تجارياً).

في وضع العرض الساكن يعمل PinSign مباشرة عبر المتصفح مع تخزين محلي تلقائي (`localStorage` عبر آلية fallback في `src/lib/api.ts`)، وهو مثالي لتجربة واجهة دبابيس المراجعة وشهادات الاعتماد وطباعة `A4 PDF`.

```bash
cd projects/pinsign
npm ci
npm run build
npx wrangler login
npx wrangler deploy
```

ملف التهيئة الجاهز: [`wrangler.jsonc`](../wrangler.jsonc) (`assets.directory = "./dist"`, `not_found_handling = "single-page-application"`).

---

## المسار ب: التشغيل المتكامل الكامل (Node 22 + SQLite WAL + روابط `/r/:slug` ومقتطف `/embed.js`)

لتفعيل الروابط المشتركة للعملاء (`/r/:slug`)، ورفع لقطات الشاشة، وحقن `/embed.js` على مواقع التجربة (`Staging`)، وإصدار شهادات `SIGN-YYYY-0001` ذرياً:

### 1) عبر Docker Compose (خادم شخصي أو VPS اقتصادي)
```bash
cd projects/pinsign
cp deploy/.env.example .env
# عدّل APP_ORIGIN و BASE_PATH عند الحاجة
docker compose up -d --build
curl -sf http://127.0.0.1:4183/api/health
```

### 2) عبر Node 22 + systemd + Caddy HTTPS (:4183)
1. انسخ [`deploy/.env.example`](../deploy/.env.example) إلى مجلد البيانات (مثلاً `~/srv-data/pinsign/.env`) واضبط `PINSIGN_DATA_DIR` و`BASE_PATH` و`APP_ORIGIN`.
2. ابْنِ الواجهة الإنتاجية:
   ```bash
   npm ci && npm run build
   ```
3. ثبّت وحدة الخدمة [`deploy/pinsign.service`](../deploy/pinsign.service) وربطها خلف [`deploy/Caddyfile`](../deploy/Caddyfile) على المنفذ `4183`.
4. جدوِل النسخ الاحتياطي الآمن لقاعدة البيانات والصور المرفوعة عبر [`deploy/backup-sqlite.sh`](../deploy/backup-sqlite.sh):
   ```bash
   PINSIGN_DATA_DIR=/path/to/data ./deploy/backup-sqlite.sh
   ```

---

## مسودات المشاركة الأخلاقية ($0 Zero-Budget Community Sharing)

### 1) LinkedIn / X (English — Webflow, Framer & Shopify Designers / Studios)
> Two headaches every web designer hits at project handoff:
> 1. "Unbound" feedback threads turning 2 agreed rounds into 7 rounds of free scope creep.
> 2. Proxy iframe review tools breaking on Cloudflare, login walls, and CSP headers (often charging \$79/mo or expiring links after 72h).
>
> We built **PinSign**:
> - Upload desktop/mobile screens OR drop a single `<script src=".../embed.js">` tag onto your staging site (no iframe proxy required).
> - Drop numbered visual pins (`Blocker / Normal / Polish`), track `Rounds Used / Agreed`, and quote `Out-of-Scope` extras inline.
> - Close projects cleanly with an immutable `SHA-256` Launch Sign-Off Certificate (`SIGN-YYYY-0001`) that locks rounds once signed.
>
> Self-hostable (`Node 22 + SQLite WAL`) or `$0` static Cloudflare preview. Feedback from studio founders welcome!

### 2) منشور LinkedIn (عربي — لمصممي المواقع ومطوري المتاجر والاستوديوهات في الخليج)
> أكبر ثغرتين عند تسليم أي موقع أو متجر إلكتروني للعميل:
> 1) تحوّل «جولتي التعديلات المتفق عليهما» إلى سلسلة لا تنتهي من طلبات التعديل المجانية.
> 2) إرسال العميل ملاحظاته في 10 لقطات شاشة متفرقة عبر واتساب بدون إقرار إطلاق واضح يوثق تسليم المشروع.
>
> بنينا **PinSign** لفرق التصميم والتطوير:
> - لوحة مراجعة بصرية بدون بروكسي (رفع شاشات + مقتطف `<script>` بسطر واحد على موقع التجربة Webflow / Shopify).
> - دبابيس تعليق مرقمة (`عائق إطلاق` / `عادي` / `تحسين`) مع تسعير الطلبات التي تخرج عن النطاق.
> - عدّاد الجولات المتفق عليها + شهادة اعتماد إطلاق نهائية `SHA-256` قابلة للطباعة وتغلق المراجعة ضد أي تعديل بعد التوقيع.
>
> شاركونا آراءكم لو تشتغلون مع عملاء في تصميم المواقع والمتاجر!

### 3) رسالة تعريفية لمجتمعات وكالات Webflow / Framer / Shopify (بدون إزعاج)
> أهلاً يا مبدعين، جهزنا أداة خفيفة مفتوحة البنية اسمها **PinSign** تحل مشكلة المراجعة النهائية قبل إطلاق مواقع العملاء: بدلاً من تشتت ملاحظات الواتساب أو أدوات البروكسي المعطلة والمكلفة، تشارك رابط مراجعة برقم دبابيس على الشاشات أو تضيف `<script>` على موقع التجربة، يظهر للعميل عدد الجولات المتبقية، وعند الموافقة يوقّع على **شهادة اعتماد إطلاق `SHA-256`** تثبت أن المشروع أُنجز واعتُمد رسمياً. يسعدنا سماع ملاحظاتكم لتطوير قوالب التجارة الإلكترونية فيها.
