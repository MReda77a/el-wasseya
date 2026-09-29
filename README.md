# الوصية 📜🔐

لعبة للقعدة من ٤ لـ ١٠ لعيبة، كل واحد من تليفونه: اكتب وصيتك، اكسر الخزنة، وماتبقاش أول واحد يخرج.

السيرفر هو اللي بيشغّل اللعبة، وكل لعيب بيوصله المعلومات بتاعته بس، فمحدش يقدر يشوف كروت حد تاني حتى لو فتح الكود.

---

## فيه إيه جوه المشروع

```
wasseya-app/
├── public/
│   ├── index.html      ← شكل اللعبة وكل النصوص (عربي وإنجليزي)
│   ├── engine.js       ← قواعد اللعبة كلها (الخزنة، الوصايا، القدرات، الأحداث، البوتات)
│   ├── manifest.json   ← عشان اللعبة تتنزل على الشاشة الرئيسية زي الأبلكيشن
│   └── icons/          ← أيقونات اللعبة (١٩٢، ٥١٢، ١٠٢٤)
├── shared/room.js      ← إدارة الأوضة (دخول، خروج، صاحب الأوضة…)
├── cloudflare/worker.js← السيرفر على Cloudflare (مجاني، من غير كريدت كارد)
├── wrangler.jsonc      ← إعدادات Cloudflare
├── server/index.js     ← نفس السيرفر بس بـ Node.js (عشان تجرب على جهازك)
└── package.json
```

---

## ١. ارفعها على Cloudflare (مجاني ومن غير كريدت كارد) ✅

الخطة المجانية في Cloudflare Workers بتشغّل اللعبة كلها، ومش بتطلب فيزا.

### الطريقة الأسهل: من GitHub من غير ما تكتب أوامر

1. ارفع المشروع على GitHub (من غير فولدر `node_modules`).
2. اعمل حساب مجاني على [dash.cloudflare.com](https://dash.cloudflare.com).
3. من القايمة: **Workers & Pages** ← **Create** ← **Import a repository**، واربط حساب GitHub واختار الـ repo.
4. خلي اسم المشروع **`el-wasseya`** بالظبط (لازم يطابق الاسم اللي في `wrangler.jsonc`).
5. الـ **Deploy command** يبقى: `npx wrangler deploy` (وسيب الـ Build command فاضي).
6. دوس **Deploy**. بعد دقيقة هيديك لينك زي:
   `https://el-wasseya.اسمك.workers.dev`

وأي تعديل ترفعه على GitHub بعد كده، Cloudflare بينزله لوحده.

### أو من الكمبيوتر

محتاج **Node.js نسخة ١٨ أو أحدث** من [nodejs.org](https://nodejs.org).

```bash
cd wasseya-app
npm install
npx wrangler login     # هيفتح المتصفح عشان تسجل دخول Cloudflare
npx wrangler deploy
```

### حدود الخطة المجانية

الأرقام دي من Cloudflare، وممكن تتغير، فبص عليها لو اللعبة كبرت:
- ١٠٠ ألف طلب في اليوم.
- وقت تشغيل للأوض يكفي حوالي ٢٥ ساعة لعب في اليوم (مجموع كل الأوض مع بعض).

ده كفاية جداً لقعدات مع الصحاب. لو الحد خلص في يوم، اللعبة بتقف لحد تاني يوم الساعة ٣ الفجر بتوقيت مصر.

---

## ٢. جرّبها على جهازك

```bash
cd wasseya-app
npm install
npm start
```

افتح **http://localhost:3000**. عشان تلعبوا من الموبايلات وانتوا على نفس الواي فاي، افتح من الموبايل **http://IP-الكمبيوتر:3000** (مثلاً `http://192.168.1.5:3000`).

- `npm run dev` بيخلي كل الأوقات أسرع عشان تجرب بسرعة (على ماك ولينكس).
- `npm run cf:dev` بيشغّل نسخة Cloudflare على جهازك على **http://localhost:8787**.

---

## ٣. نزّلها على الموبايل كأنها أبلكيشن

افتح لينك اللعبة من الموبايل:
- **آيفون (Safari):** زرار المشاركة ← «Add to Home Screen».
- **أندرويد (Chrome):** التلات نقط ← «Add to Home screen» أو «Install app».

هتظهر بالأيقونة وتفتح full screen من غير شريط المتصفح.

---

## إزاي الكود متقسم (لو هتعدّل في Cursor)

| عايز تغيّر | روح لـ |
|---|---|
| الأوقات (الدور، الإجابة، الوصية…) | `public/engine.js` ← `const D = {...}` (بالثواني) |
| عدد اللعيبة | `public/engine.js` ← `MAXP` و `MINP` |
| القدرات | `public/engine.js` ← `ABIL` و `useAbility()` |
| أحداث الراوند | `public/engine.js` ← `EVENTS` وابحث عن `this.evk` |
| الوصايا | `public/engine.js` ← `WTYPES` و `execWill()` |
| النقط | `public/engine.js` ← `rankPts` و `scoreRound()` |
| البوتات | `public/engine.js` ← `bots()` |
| أي نص في اللعبة | `public/index.html` ← `const T = { ar:{...}, en:{...} }` |
| الألوان والشكل | `public/index.html` ← أول `<style>` (`:root`) |
| الأوض والدخول والخروج | `shared/room.js` |

**إزاي الاتصال شغال:** كل لاعب بيفتح WebSocket على `/ws?code=كود-الأوضة` ويبعت اختياراته. السيرفر كل ٢٠٠ مللي ثانية بيحرّك اللعبة ويبعت لكل واحد الحالة بمعلوماته الخاصة بس. على Cloudflare كل أوضة ليها «Durable Object» خاص بيها.

**وضع «جرّب لوحدك مع بوتات»** شغال جوه المتصفح من غير سيرفر، فبيشتغل حتى من غير نت.

---

## الخطوة الجاية: Apple Store و Google Play

1. استخدم **[Capacitor](https://capacitorjs.com)** عشان يلف الويب آب ده في أبلكيشن حقيقي للآيفون والأندرويد من غير ما تعيد كتابته.
2. **آيفون:** محتاج Mac و Xcode (أو خدمة build في السحابة زي Codemagic)، وحساب Apple Developer.
3. **أندرويد:** Android Studio وحساب Google Play Console. الحسابات الشخصية الجديدة لازم تعمل تجربة مقفولة مع ١٢ واحد لمدة ١٤ يوم قبل النشر.
4. الاتنين محتاجين: أيقونة (موجودة في `public/icons/icon-1024.png`)، صور للشاشات، ولينك لـ Privacy Policy.
