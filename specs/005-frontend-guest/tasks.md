---

description: "Task list for feature implementation"
---

# Tasks: فرانت‌اند وب، بخش ۱: پایه و جریان مهمان

**Input**: Design documents from `/specs/005-frontend-guest/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/web.md, contracts/api.md, quickstart.md

**Tests**: لازم‌اند. constitution اصل IV برای هر قاعده و هر سناریوی پذیرش تست خودکار می‌خواهد، و FR-035 همین را برای قاعده‌های سایت می‌گوید.
- **فرانت‌اند:** Vitest، و `vitest-axe` برای دسترس‌پذیری. پوشش `src/lib` و `src/api` دست‌کم ۹۰٪ است (R16).
- **بکند:** آواتار با pytest روی PostgreSQL و MinIO واقعی آزموده می‌شود.
- **دستی:** SC-003 زمان روی سخت‌افزار است و با Lighthouse، طبق quickstart، اندازه گرفته می‌شود.

**Organization**:
- کارها بر اساس user story دسته‌بندی شده‌اند.
- کارهایی که یک فایل را تغییر می‌دهند، در هر فاز کنار هم آمده‌اند (constitution: Development Workflow).
- پیام‌های ترجمه (`messages/fa.json` و `en.json`) در Phase 2 یک بار با همه‌ی کلیدهای شناخته‌شده ساخته می‌شوند. هر story فقط کلیدهای صفحه‌ی خودش را به همان دو فایل اضافه می‌کند.

**قاعده‌ی مستندسازی (مالک پروژه، 2026-11-07)**: هر ساختار تازه (تنظیم، کوکی، endpoint، سازوکار، تغییر رفتار) دلیل وجود و اثرش را در دو جا می‌گیرد:
- یک توضیح کوتاه در کد، کنار تعریفش.
- بخش مربوط در `docs/backend-design.md` (T078).

متن پایه‌ی هر دو، جدول «ساختارهای تازه‌ی بخش مهمان» در `docs/future-work.md` بخش ۱ است.

**قاعده‌ی وابستگی‌ها (R2)**: هر بسته‌ی npm با نسخه‌ی دقیق (بدون `^` یا `~`) نصب می‌شود. نسخه‌ای انتخاب می‌شود که دست‌کم دو هفته از انتشارش گذشته باشد، و `package-lock.json` commit می‌شود. اگر نصب از رجیستری npm در این محیط اجازه نگیرد، کار متوقف می‌شود و از مالک پروژه اجازه گرفته می‌شود. هیچ راه دیگری برای دور زدن آن امتحان نمی‌شود.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: می‌تواند هم‌زمان اجرا شود (فایل جدا، بدون وابستگی به کار ناتمام)
- **[Story]**: US1 تا US5

## Path Conventions

- **فرانت‌اند:** `frontend/` (کد در `frontend/src/`، ترجمه در `frontend/messages/`)
- **تست‌های فرانت‌اند:** کنار هر فایل، با پسوند `*.test.ts` یا `*.test.tsx`
- **بکند:** `backend/src/caravansara/`، و تست‌ها در `backend/tests/`
- **e2e:** `e2e/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 خط پایه، روی همین branch و پیش از هر تغییر:
  - `cd backend && uv run pytest -q` پاس شود (۳۴۲ تست).
  - `cd e2e && npm test` روی stack پاس شود (۵۱ تست).
  - `docker compose ps` همه‌ی سرویس‌ها را سالم نشان دهد.
- [ ] T002 ساختن `frontend/` با `create-next-app`: App Router، TypeScript، Tailwind، ESLint، پوشه‌ی `src/` و alias `@/*`، با پیش‌فرض‌های `create-next-app` 16 برای build.
  - **نسخه‌ها:** Next.js 16.4.x و React 19، با نسخه‌ی دقیق (R2).
  - **`frontend/package.json`:** `engines.node` برابر `">=24 <25"`، و اسکریپت‌های زیر:
    - `dev`، `build` و `start`
    - `lint`، `format` و `format:check`
    - `typecheck` (`tsc --noEmit`)
    - `test` (`vitest run`)
    - `gen:api` (`openapi-typescript ../backend/openapi.json -o src/api/schema.d.ts`)
  - **`frontend/.nvmrc`:** `24`.
  - **`.gitignore`:** `frontend/.gitignore` شامل `node_modules/`، `.next/`، `coverage/`، `.env*` و `!.env.example` باشد.
- [ ] T003 پیکربندی ابزارهای کیفیت در `frontend/`:
  - **`tsconfig.json`:** `strict: true`، `noUncheckedIndexedAccess: true` و `noImplicitOverride: true`.
  - **`eslint.config.mjs`:** `next/core-web-vitals` و `next/typescript`، و قاعده‌های `jsx-a11y` که همراه `eslint-config-next` می‌آیند، در سطح `recommended`. قاعده‌ی منع `localStorage` با `no-restricted-globals` و `no-restricted-properties` (FR-012). دلیلش در کامنت کنار قاعده آمده باشد.
  - **Prettier:** `.prettierrc` و `.prettierignore`.
  - **`vitest.config.ts`:**
    - jsdom، setup با `@testing-library/jest-dom` و `vitest-axe`.
    - پوشش با `v8`، با آستانه‌ی ۹۰٪ (lines، branches و functions) فقط برای `src/lib/**` و `src/api/**`، به‌جز `src/api/schema.d.ts` (R16).
- [ ] T004 [P] نصب وابستگی‌های اجرا در `frontend/package.json`، همه با نسخه‌ی دقیق:
  - `next-intl` 4.x
  - `@tanstack/react-query` 5.x
  - `openapi-fetch` 0.17.x
  - `maplibre-gl` 5.x
  - `jalaali-js` 2.x
  - `clsx`، `tailwind-merge` و `lucide-react`

  نوع‌ها (`@types/jalaali-js`) در devDependencies هستند.
- [ ] T005 [P] نصب وابستگی‌های توسعه در `frontend/package.json`، همه با نسخه‌ی دقیق: `typescript` 5.9.x، `openapi-typescript` 7.x، `vitest` 4.x، `@vitejs/plugin-react`، `@testing-library/react`، `@testing-library/user-event`، `@testing-library/jest-dom`، `jsdom`، `vitest-axe`، `@vitest/coverage-v8` و `prettier`. `eslint-plugin-jsx-a11y` جدا نصب نمی‌شود، چون `eslint-config-next` آن را دارد (R2).
- [ ] T006 اجرای `npx shadcn init` در `frontend/` با Tailwind 4 و رنگ پایه‌ی خنثی. خروجی آن `frontend/components.json` و `frontend/src/components/ui/` است. سپس فقط کامپوننت‌هایی اضافه می‌شوند که صفحه‌ها لازم دارند: `button`، `input`، `label`، `dialog`، `popover`، `command`، `select`، `checkbox`، `card`، `badge`، `skeleton`، `sonner`، `separator` و `sheet`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: زبان و جهت، کلاینت API، نشست، قالب‌ها، پیام‌ها، اجرا در Docker و CI. هر story به این‌ها تکیه دارد.

**⚠️ CRITICAL**: هیچ کار storyای پیش از پایان این فاز شروع نمی‌شود.

### پیکربندی Next.js و زبان

- [ ] T007 در `frontend/next.config.ts`:
  - `output: "standalone"`.
  - پلاگین next-intl.
  - `rewrites`: `/api/v1/:path*` → `${API_INTERNAL_URL}/api/v1/:path*`، و هیچ مسیر دیگری (R5، contracts/web.md). `/api/v1/auth/*` پیش از rewrite، در `proxy.ts` (T008)، پاسخ 404 می‌گیرد. دلیل: ورود و نشست فقط از `/session/*` بگذرند (R3، R19).
  - `images.remotePatterns` فقط برای مبدأ `NEXT_PUBLIC_MEDIA_BASE_URL`.
  - سرآیندهای ثابت برای همه‌ی مسیرها: `X-Content-Type-Options: nosniff` و `Referrer-Policy: strict-origin-when-cross-origin`. `no-referrer` نباشد، چون سیاست کاشی OSM Referer می‌خواهد (R22).
  - CSP اینجا نیست، چون nonce هر درخواست را می‌خواهد. CSP در `proxy.ts` ساخته می‌شود (T008، R21).

  دلیل هر بند در کامنت کنار آن آمده باشد.
- [ ] T008 [P] ساختن `frontend/src/i18n/routing.ts` و `frontend/src/i18n/request.ts` (next-intl)، و `frontend/src/proxy.ts`. در Next.js 16، `middleware.ts` جایش را به `proxy.ts` با `export function proxy` داده است (R21). همه‌ی موارد زیر با تست در `frontend/src/proxy.test.ts`:
  - **زبان:** زبان‌ها `fa` و `en`، و پیش‌فرض `fa`. `localePrefix: "always"`، و `localeDetection: false`، چون spec فارسی را پیش‌فرض گفته است (plan، Assumptions).
  - **CSP با nonce (R21):** پس از middleware زبان، nonce تازه (۱۶ بایت تصادفی به base64) ساخته می‌شود. در سرآیند درخواست `x-nonce` و `Content-Security-Policy`، و در سرآیند پاسخ `Content-Security-Policy` گذاشته می‌شود، با بندهای R21:
    - `script-src 'self' 'nonce-…' 'strict-dynamic'`، و `'unsafe-eval'` فقط وقتی `NODE_ENV=development`.
    - `style-src 'self' 'unsafe-inline'`
    - `img-src` و `connect-src` با مبدأ media و مبدأ `NEXT_PUBLIC_MAP_TILE_URL`.
    - `worker-src blob:`، `font-src 'self'`، `frame-ancestors 'none'`، `base-uri 'self'` و `form-action 'self'`.
    - دلیل هر بند در کامنت. FR-041: CSP بار شدن تصویر از سرور بیرونی را هم می‌بندد.
  - **مسیرهای auth:** `/api/v1/auth/*` پاسخ 404 با بدنه‌ی خطای `not_found` بگیرد.
  - **matcher:** مثل راهنمای Next.js، `_next/static`، `_next/image`، `favicon.ico`، فایل‌های ثابت و درخواست‌های prefetch را نادیده بگیرد. `/session` از زبان معاف باشد. `/api/v1/auth` فقط برای آن 404 گرفته شود.
  - **رندر پویا:** صفحه‌ها رندر پویا دارند، چون nonce آن را می‌خواهد. `layout.tsx` (T009) با `await connection()` این را صریح می‌کند.
- [ ] T009 ساختن `frontend/src/app/[locale]/layout.tsx`:
  - `<html lang dir>`: برای `fa` مقدار `rtl` و برای `en` مقدار `ltr`.
  - فونت Vazirmatn از `next/font/local`، با فایل‌های woff2 متغیر در `frontend/src/app/fonts/`. فونت از خود سایت بار می‌شود، و منبع و مجوز OFL آن در `frontend/src/app/fonts/README.md` ثبت می‌شود.
  - `NextIntlClientProvider`، `QueryClientProvider` (در یک `Providers` سمت کاربر) و `Toaster`.
  - `generateStaticParams` برای دو زبان، و `await connection()` برای رندر پویا (R21).
  - `not-found.tsx` ترجمه‌شده برای 404، و `error.tsx` با پیام عمومی و دکمه‌ی «دوباره» (Edge Cases).
- [ ] T010 [P] ساختن `frontend/src/components/layout/Header.tsx`، `LocaleSwitch.tsx` و `Footer.tsx`:
  - **سرصفحه:** لوگو، پیوند «سفرهای من»، و ورود یا آواتار کاربر. آواتار از T051 می‌آید و تا آن موقع یک جای‌نگه‌دار است.
  - **`LocaleSwitch`:** همان مسیر و همان query را در زبان دیگر باز می‌کند.
  - **پانویس:** ذکر منبع نقشه (© OpenStreetMap contributors).
  - همه‌ی چیدمان با ویژگی‌های logical Tailwind (`ms-*`، `ps-*`، `start-*`)، و آیکن‌های جهت‌دار با `rtl:rotate-180` (FR-008).

### پیام‌ها و کدهای خطا

- [ ] T011 ساختن `frontend/messages/fa.json` و `frontend/messages/en.json` با ساختار یکسان (data-model، «پیام‌ها»):
  - بخش‌های `common`، `nav`، `search`، `listing`، `booking`، `trips`، `review` و `account`، با کلیدهای پایه.
  - `errors.<code>` برای همه‌ی کدهای بکند (فهرست research R7)، به‌اضافه‌ی کدهای تازه‌ی `image_too_large`، `invalid_image`، `invalid_avatar_url`، `bad_origin` و `errors.unknown`. هر پیام کوتاه و غیر فنی است (حافظه‌ی پروژه: متن رابط کاربری).
  - `amenities.<English name>` و `amenityCategories.<English name>`: همه‌ی ۳۱ امکان و دسته‌ها از `GET /amenities` دمو.
  - `propertyTypes.entire_place`، `private_room` و `shared_room`.
  - `cities.<English name>`: همه‌ی شهرهای دمو.
- [ ] T012 [P] ساختن `frontend/src/messages.test.ts`:
  - **هم‌کلیدی:** `fa.json` و `en.json` دقیقاً یک مجموعه کلید داشته باشند.
  - **SC-007:**
    - همه‌ی کدهای خطا از `backend/src/caravansara/**/*.py` جمع شوند: الگوی سازنده‌های `AppError`، `Conflict`، `Forbidden`، `Unprocessable`، `Unauthorized`، `NotFound` و `code="…"`، به‌اضافه‌ی کدهای `core/errors.py`.
    - هر کد در `errors` هر دو فایل باشد.
    - برای هر الگو یک نمونه‌ی ثابت هم سنجیده شود، تا اگر الگو چیزی پیدا نکرد، تست بی‌صدا پاس نشود.
  - **امکانات:** یک فهرست ثابت از ۳۱ نام امکان دمو در خود تست، که از `GET /amenities` گرفته شده و منبعش در کامنت آمده، با `amenities` مقایسه شود.
- [ ] T013 [P] ساختن `frontend/src/lib/errors.ts` و `errors.test.ts`:
  - `errorMessage(t, body)`: کد را به کلید `errors.*` تبدیل می‌کند، و برای کد ناشناخته `errors.unknown` می‌دهد. متن انگلیسی سرور هرگز نشان داده نمی‌شود (FR-002، FR-003).
  - `fieldErrors(body)`: `details` در `validation_error` را به نقشه‌ی «فیلد → پیام» تبدیل می‌کند، برای نمایش کنار هر فیلد.
  - **تست:** کد شناخته‌شده، کد ناشناخته، بدنه‌ی غیر JSON، و خطای شبکه.

### قالب‌ها (src/lib، پوشش ≥ ۹۰٪)

- [ ] T014 [P] ساختن `frontend/src/lib/digits.ts` و `digits.test.ts`:
  - `toLatinDigits`: ارقام `۰-۹` و `٠-٩` را به لاتین برمی‌گرداند (FR-004).
  - `parseIntInput`: ورودی عدد صحیح را با هر سه نوع رقم می‌خواند.
- [ ] T015 [P] ساختن `frontend/src/lib/calendar.ts` و `calendar.test.ts` (R8):
  - `toJalali(isoDate)` و `toGregorianIso(jy, jm, jd)` (با `jalaali-js`).
  - `jalaliMonthGrid(jy, jm)`: هفته‌ها از شنبه شروع می‌شوند.
  - `gregorianMonthGrid(y, m)`: هفته‌ها از دوشنبه شروع می‌شوند، و در کامنت آمده چرا.
  - `formatDate(isoDate, locale)` با `Intl`: تقویم persian و ارقام فارسی در `fa`.
  - **تست SC-008:** برای هر روز از ۱۴۰۰/۱/۱ تا ۱۴۱۰/۱۲/آخر، رفت‌وبرگشت درست باشد و با `Intl` (`fa-IR-u-ca-persian`) برابر باشد. اسفند سال‌های کبیسه و نوروز جدا هم تست شوند (Edge Cases).
- [ ] T016 [P] ساختن `frontend/src/lib/cityTime.ts` و `cityTime.test.ts` (R9، FR-006):
  - `todayInZone(tz, now)`: «امروزِ شهر».
  - `startOfDayInZone(isoDate, tz)`: لحظه‌ی آغاز روز در آن منطقه، که تغییر ساعت تابستانی را هم درست حساب می‌کند.
  - `formatTimeInZone(time, tz, locale)`: با نام شهر یا منطقه.
  - **تست:**
    - `Asia/Tehran`، `Europe/London` (روز تغییر ساعت) و `America/New_York`.
    - مهمانی در تهران که آگهی هلسینکی را می‌بیند (Edge Cases).
    - لحظه‌ی درست پیش و پس از نیمه‌شب شهر.
- [ ] T017 [P] ساختن `frontend/src/lib/money.ts` و `money.test.ts` (R10، FR-007):
  - `formatMoney(amount: string, currency, locale)`.
  - **ریال:** `IRR` بر ۱۰ تقسیم می‌شود، با محاسبه‌ی BigInt روی رشته‌ی decimal و بدون `number`. برچسب «تومان» در فارسی و «Toman» در انگلیسی. بدون اعشار مگر وقتی تقسیم بخش‌پذیر نباشد (data-model، «مبلغ»).
  - **ارزهای دیگر:** با `Intl.NumberFormat(locale, { style: "currency" })`.
  - **تست:**
    - بزرگ‌ترین جمع ممکن (۳۶۶٬۰۰۰٬۰۰۰٬۰۰۰٫۰۰ ریال) بدون از دست رفتن رقم.
    - ارقام و جداکننده‌ی فارسی.
    - EUR، USD، GBP، SEK و DKK در هر دو زبان.

### کلاینت API

- [ ] T018 اجرای `npm run gen:api` در `frontend/`. خروجی `frontend/src/api/schema.d.ts` است و commit می‌شود (R6). یک کامنت در سرآیند فایل بگوید فایل تولیدشده است و چطور دوباره ساخته می‌شود.
- [ ] T019 ساختن `frontend/src/lib/session.ts` و `session.test.ts` (R3، R4، data-model «نشست»):
  - **نگه‌داری:** access token و زمان پایانش فقط در متغیر ماژول. `getAccessToken()` و `setSession()` و `clearSession()`.
  - **تازه کردن:** `refresh()` فقط درون `navigator.locks.request("cv-refresh", …)` اجرا می‌شود.
    - پس از گرفتن قفل، اگر token تازه‌تری از `BroadcastChannel("cv-session")` رسیده باشد، همان را برمی‌دارد و درخواست نمی‌فرستد.
    - وگرنه `POST /session/refresh` را صدا می‌زند و نتیجه را پخش می‌کند.
  - **زمان‌بندی:** ۶۰ ثانیه پیش از پایان، تازه کردن خودکار.
  - **خروج:** پیام `logout` در کانال، همه‌ی زبانه‌ها را بی‌نشست می‌کند (Edge Cases).
  - **توضیح در کد:** چرا قفل لازم است (بکند استفاده‌ی دوباره را دزدی می‌داند و همه‌ی نشست‌ها را باطل می‌کند: `identity/service.py`، `refresh`).
  - **تست:**
    - دو «زبانه»ی شبیه‌سازی‌شده که هم‌زمان تازه می‌کنند، فقط یک درخواست بفرستند.
    - تازه کردن ناموفق نشست را پاک کند.
    - هیچ چیزی در `localStorage`، `sessionStorage` یا `document.cookie` نوشته نشود (SC-006).
- [ ] T020 ساختن `frontend/src/api/client.ts` و `client.test.ts`:
  - `openapi-fetch` با `baseUrl: "/api/v1"`.
  - middlewareای که `Authorization: Bearer` را از `session.ts` می‌گذارد.
  - با پاسخ `401` و کد `token_expired` یا `invalid_token`، یک بار `refresh()` و تکرار درخواست. اگر باز شکست خورد، `clearSession()` و رفتن به ورود با `returnTo` (Edge Cases).
  - تابع `serverDate(response)` اختلاف ساعت را از سرآیند `Date` حساب می‌کند (R12).
  - **تست:** تکرار پس از ۴۰۱، شکست دوم، و سرآیند `Date`.
- [ ] T021 [P] ساختن `frontend/src/api/server.ts` و `server.test.ts`: کلاینت سمت سرور با `baseUrl: ${API_INTERNAL_URL}/api/v1`، بدون هیچ توکنی (R14)، و با `cache: "no-store"` برای جستجو. تست بررسی می‌کند که هیچ سرآیند `Authorization` فرستاده نمی‌شود.

### نشست (route handlerها)

- [ ] T022 ساختن `frontend/src/app/session/_lib.ts`، `frontend/src/app/session/login/route.ts`، `register/route.ts`، `refresh/route.ts` و `logout/route.ts` (contracts/web.md):
  - **بررسی `Origin`:** با مبدأ سایت یکی نباشد، `403 bad_origin`.
  - **کوکی `cv_refresh`:** `HttpOnly`، `SameSite=Strict`، `Path=/session`، `Max-Age=2592000` (۳۰ روز)، و `Secure` وقتی `NODE_ENV=production`. توضیح هر پرچم در کد آمده باشد.
  - **پاسخ‌ها:**
    - `login` و `register` فقط `{ access_token, expires_in }` را برمی‌گردانند، و `register` کاربر را هم برمی‌گرداند.
    - `refresh` بدون کوکی یا با رد شدن، `401 invalid_token` می‌دهد و کوکی را پاک می‌کند.
    - `logout` همیشه کوکی را پاک می‌کند، حتی وقتی API خطا بدهد.
  - **خطای API:** با همان وضعیت و بدنه برگردانده می‌شود.
  - **IP کاربر:** سرآیند `X-Forwarded-For` با IP کاربر به API فرستاده می‌شود (R19).
  - هیچ لاگی ایمیل، رمز یا توکن ندارد (FR-036).
- [ ] T023 ساختن `frontend/src/app/session/session.test.ts`: تست route handlerها با fetch جعلی به API:
  - پرچم‌های کوکی، در توسعه و در production.
  - `Origin` نادرست.
  - عبور خطای `invalid_credentials`، `email_taken` و `too_many_attempts` با همان وضعیت.
  - `refresh` بدون کوکی.
  - `logout` که حتی با خطای API کوکی را پاک می‌کند.
  - نبودن هیچ توکن refresh در بدنه‌ی پاسخ (SC-006).
- [ ] T024 [P] ساختن `frontend/src/lib/returnTo.ts` و `returnTo.test.ts` (contracts/web.md):
  - فقط مسیری را می‌پذیرد که با `/fa/` یا `/en/` شروع شود.
  - `//evil`، `/\evil`، `https://…`، `javascript:` و رمزگذاری‌های آن‌ها به `/{locale}` تبدیل می‌شوند (FR-014).
- [ ] T025 [P] ساختن `frontend/src/components/auth/RequireAuth.tsx`: اگر نشست نیست، یک بار `refresh()` را امتحان می‌کند. اگر نشد، به `/{locale}/login?returnTo=` با مسیر فعلی و query آن می‌رود. هنگام بررسی، skeleton نشان می‌دهد.

### اجرا (Docker و CI)

- [ ] T026 ساختن `frontend/Dockerfile` و `frontend/.dockerignore` (R15):
  - چند مرحله: `deps` (`npm ci`)، `build` (`npm run build`) و `runner` (`node:24-slim`، کاربر غیر root، فقط `.next/standalone`، `.next/static` و `public`).
  - `PORT=3001`، و `HOSTNAME=0.0.0.0`.
  - مرحله‌ی build `openapi.json` را نمی‌خواند، چون `schema.d.ts` commit شده است.
- [ ] T027 در `docker-compose.yml` (contracts/web.md، R19):
  - **شبکه:** شبکه‌ی `app` با `ipam.config.subnet: ${CARAVANSARA_APP_SUBNET:-172.28.0.0/24}`، و همه‌ی سرویس‌ها روی آن، تا نام‌های `db`، `minio` و `api` مثل امروز کار کنند. یک کامنت بگوید اگر این subnet با شبکه‌ی میزبان یا VPN برخورد کرد، چطور با متغیر عوض شود. نشانی `web` و `FORWARDED_ALLOW_IPS` هم از همان متغیرها بیایند (`CARAVANSARA_WEB_IP`، پیش‌فرض `172.28.0.10`).
  - **سرویس `web`:**
    - build از `frontend/Dockerfile`، با `ports: ["3001:3001"]` و `networks.app.ipv4_address: 172.28.0.10`.
    - محیط: `API_INTERNAL_URL=http://api:8000`، `NEXT_PUBLIC_MEDIA_BASE_URL=http://localhost:9000/caravansara-media` و `NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png`. متغیرهای `NEXT_PUBLIC_*` هنگام build در کد قرار می‌گیرند، پس به‌صورت `build.args` هم داده می‌شوند.
    - `depends_on.api: service_healthy`، و healthcheck روی `http://localhost:3001/fa`.
  - **`api`:** `FORWARDED_ALLOW_IPS: ${CARAVANSARA_WEB_IP:-172.28.0.10}`.
  - **توضیح بالای فایل:** نشانی سایت (`http://localhost:3001`)، و چرا پورت ۳۰۰۱ (Grafana ۳۰۰۰ را دارد) و چرا نشانی ثابت لازم است (محدودیت تلاش با IP واقعی).
- [ ] T028 در `.github/workflows/ci.yml`:
  - **job تازه‌ی `frontend`:** `actions/setup-node@v4` با Node 24 و `cache: npm` (`frontend/package-lock.json`)، سپس به ترتیب:
    1. `npm ci`
    2. `npm run gen:api && git diff --exit-code src/api/schema.d.ts` (FR-033)
    3. `npm run lint`
    4. `npm run format:check`
    5. `npm run typecheck`
    6. `npm run test -- --coverage`
    7. `npm run build`
  - **job `image`:** `docker build -f frontend/Dockerfile -t caravansara-web:ci frontend` هم اجرا شود.
- [ ] T029 [P] ساختن `frontend/.env.example`، با `API_INTERNAL_URL`، `NEXT_PUBLIC_MEDIA_BASE_URL`، `NEXT_PUBLIC_MAP_TILE_URL` و `PORT`، هر کدام با یک خط توضیح. یک کامنت هم بگوید هیچ رازی نباید در `NEXT_PUBLIC_*` باشد.

**Checkpoint**: `npm run lint`، `typecheck`، `test` و `build` در `frontend/` سبز باشند، و `docker compose up --build` سایت را روی `http://localhost:3001/fa` بالا بیاورد، با صفحه‌ی خالی و راست‌به‌چپ.

---

## Phase 3: User Story 1 - جستجو و دیدن اقامتگاه بدون ورود (Priority: P1) 🎯 MVP

**Goal**: مهمان بدون حساب، شهر یا ناحیه، تاریخ و مهمان‌ها را انتخاب می‌کند. نتایج را با نقشه و فیلتر می‌بیند، و صفحه‌ی آگهی را باز می‌کند.

**Independent Test**: بدون ورود، در یک شهر دمو با تاریخ و شمار مهمان جستجو کنید. نتایج و نقشه با هم بخوانند، یک فیلتر امکانات نتایج را کم کند، و صفحه‌ی یک آگهی همه‌ی بخش‌هایش را نشان دهد (quickstart، سناریوهای ۱ تا ۵).

### قاعده‌ها (US1)

- [ ] T030 [P] [US1] ساختن `frontend/src/lib/searchParams.ts` و `searchParams.test.ts` (data-model، «انتخاب جستجو»، FR-016، FR-020):
  - `parseSearch(query)` و `toQuery(state)`.
  - قاعده‌ها:
    - یا `city_id` یا `lat` + `lng` + `radius_km`.
    - `radius_km` در بازه‌ی ۱ تا ۱۰۰، و پیش‌فرض ۵.
    - `check_in` و `check_out` با هم، به‌شکل `YYYY-MM-DD`، و `check_out` پس از `check_in`.
    - `adults` دست‌کم ۱.
    - `sort=distance` فقط با جستجوی شعاعی.
    - `amenity_ids` تکراری.
    - `offset` مضرب ۲۰.
  - مقدار نامعتبر به نزدیک‌ترین مقدار مجاز برگردانده یا کنار گذاشته می‌شود، و خطا نمی‌دهد.
  - **تست:** رفت‌وبرگشت، هر قاعده، و نشانی‌های خراب.

### کامپوننت‌ها و صفحه‌ها (US1)

- [ ] T031 [P] [US1] ساختن `frontend/src/components/date/DateRangePicker.tsx` و `DateRangePicker.test.tsx` (FR-005، R8):
  - شبکه‌ی شمسی در `fa` و میلادی در `en`، از `calendar.ts`.
  - انتخاب بازه، کمینه‌ی تاریخ (`min`)، بیشینه‌ی ۳۶۵ روز جلوتر، و روزهای غیرفعال.
  - کار با صفحه‌کلید، شامل جهت‌نماها که در RTL برعکس می‌شوند، `Home`/`End` و `PageUp`/`PageDown`، و `aria-label` هر روز با تاریخ کامل.
  - خروجی همیشه `YYYY-MM-DD` میلادی است.
  - **تست:** انتخاب در شمسی، میلادی فرستاده‌شده، صفحه‌کلید، و axe.
- [ ] T032 [P] [US1] ساختن `frontend/src/components/search/CityCombobox.tsx` و `CityCombobox.test.tsx`:
  - `GET /cities?q=` با تأخیر ۲۰۰ میلی‌ثانیه.
  - نام شهر از `cities.*`، با بازگشت به نام API اگر ترجمه نبود.
  - کشور با `Intl.DisplayNames`.
  - نقش `combobox` و انتخاب با صفحه‌کلید (US1/AC1).
- [ ] T033 [P] [US1] ساختن `frontend/src/components/search/GuestPicker.tsx` و `GuestPicker.test.tsx`:
  - بزرگسال، کودک، نوزاد و حیوان، با دکمه‌های ± و ورودی که ارقام فارسی را می‌پذیرد (`digits.ts`).
  - توضیح «نوزاد در ظرفیت حساب نمی‌شود».
  - **تست:** کمینه و بیشینه، ارقام فارسی، و axe.
- [ ] T034 [US1] ساختن `frontend/src/components/search/SearchForm.tsx` و `SearchForm.test.tsx`:
  - ترکیب T031 تا T033.
  - ارسال با `router.push` به `/{locale}/search?…` از `toQuery`.
  - پیام خطای کنار فیلد برای تاریخ خروج پیش از ورود.
  - در صفحه‌ی اول و بالای صفحه‌ی جستجو استفاده می‌شود.
- [ ] T035 [P] [US1] ساختن `frontend/src/components/search/ResultCard.tsx` و `ResultCard.test.tsx` (FR-017):
  - عکس کاور با `next/image`. اگر عکس نبود، جای‌نگه‌دار بدون تصویر شکسته (Edge Cases).
  - عنوان، شهر ترجمه‌شده و امتیاز. بدون نظر، «تازه» نمایش داده می‌شود، نه صفر.
  - قیمت شب، و با تاریخ‌ها قیمت کل، با `formatMoney`.
  - پیوند به صفحه‌ی آگهی با همان تاریخ‌ها و مهمان‌ها.
  - **تست:** IRR به تومان، EUR، بدون عکس، بدون نظر، مبلغ بزرگ که از کارت بیرون نمی‌زند، و axe.
- [ ] T036 [P] [US1] ساختن `frontend/src/lib/mapStyle.ts` و `mapStyle.test.ts`، و `frontend/src/components/search/ResultsMap.tsx` و `ResultsMap.test.tsx` (FR-018، R22):
  - **`mapStyle.ts`:** سبک MapLibre درون‌خطی با یک منبع raster از `NEXT_PUBLIC_MAP_TILE_URL`، `tileSize: 256` و `maxzoom: 19`. ذکر منبع «© OpenStreetMap contributors» با پیوند به `https://www.openstreetmap.org/copyright`، آشکار در گوشه‌ی نقشه، نه پشت دکمه. بدون پیش‌بارگذاری کاشی و بدون حالت آفلاین (سیاست کاشی OSM).
  - MapLibre فقط سمت کاربر (`dynamic`، `ssr: false`).
  - یک پین برای هر نتیجه از `SearchResult.pin`، و هیچ مختصات دیگری.
  - دکمه‌ی «جستجو در این ناحیه»: `lat` و `lng` مرکز، و `radius_km` از اندازه‌ی نما، در بازه‌ی ۱ تا ۱۰۰ (US1/AC4).
  - اگر نقشه بار نشود، پیام کوچک می‌آید و فهرست کار می‌کند (Edge Cases).
  - **تست:** با MapLibre جعلی، شمار پین‌ها برابر نتایج باشد، و مرکز و شعاع درست به نشانی برود.
- [ ] T037 [P] [US1] ساختن `frontend/src/components/search/FiltersPanel.tsx` و `FiltersPanel.test.tsx` (FR-019، US1/AC3):
  - `GET /search/filters` با همان انتخاب‌ها.
  - امکانات دسته‌بندی‌شده و ترجمه‌شده، با شمار کنار هر کدام.
  - تغییر انتخاب، `amenity_ids` نشانی را عوض می‌کند و `offset` را صفر می‌کند.
  - در موبایل داخل `sheet` است.
  - **تست:** شمارها، و تغییر نشانی، و axe.
- [ ] T038 [US1] ساختن `frontend/src/app/[locale]/page.tsx`: صفحه‌ی اول، Server Component، با `SearchForm` و چند شهر پیشنهادی دمو، و `generateMetadata` ترجمه‌شده.
- [ ] T039 [US1] ساختن `frontend/src/app/[locale]/search/page.tsx` و `search.test.tsx`:
  - Server Component که با `parseSearch` و `server.ts` جستجو می‌کند (FR-022).
  - فهرست کارت‌ها، شمار کل، و صفحه‌بندی با پیوندهای «قبلی» و «بعدی» در نشانی (US1/AC5).
  - مرتب‌سازی، که «فاصله» فقط در حالت شعاعی دارد.
  - `FiltersPanel` و `ResultsMap` سمت کاربر.
  - پیام «نتیجه‌ای نیست» با پیشنهاد کم کردن فیلتر یا بزرگ کردن شعاع (Edge Cases).
  - `invalid_search_area` پیام ترجمه‌شده می‌گیرد.
  - **تست:** رندر با پاسخ جعلی، صفحه‌بندی بدون تکرار، و US1/AC8: همان query در `/fa` و `/en` همان شناسه‌های آگهی را به همان ترتیب نشان دهد، فقط با قالب و جهت متفاوت.
- [ ] T040 [P] [US1] ساختن `frontend/src/components/listing/Gallery.tsx`، `AmenityList.tsx` و `ReviewList.tsx`، با تست‌های کنارشان:
  - **گالری:** کاور اول، برچسب اتاق، و ناوبری با صفحه‌کلید.
  - **امکانات:** دسته‌بندی‌شده و ترجمه‌شده.
  - **نظرها:** صفحه‌بندی‌شده از `GET /listings/{id}/reviews`، با امتیاز جزئی، نام نویسنده و آواتار. آواتار از T051 می‌آید و تا آن موقع جای‌نگه‌دار است.
- [ ] T041 [US1] ساختن `frontend/src/app/[locale]/listings/[id]/page.tsx`، `not-found.tsx` و `listing.test.tsx` (FR-021، FR-022):
  - Server Component با `GET /listings/{id}` بدون توکن.
  - `generateMetadata`: عنوان، و توضیح کوتاه‌شده.
  - همه‌ی بخش‌های FR-021، و ساعت ورود و خروج با `formatTimeInZone` و `city.timezone`.
  - جعبه‌ی قیمت و رزرو، که در US3 کامل می‌شود. تا آن موقع فقط قیمت و انتخاب تاریخ و مهمان را دارد.
  - 404 ترجمه‌شده (US1/AC7).
  - **تست SC-005:** HTML رندرشده هیچ `private_location`، `address`، `latitude` یا `longitude` واقعی ندارد. تست با پاسخ آگهی‌ای انجام می‌شود که این فیلدها را دارد، تا نشان دهد صفحه آن‌ها را بیرون نمی‌دهد.
- [ ] T042 [US1] افزودن کلیدهای `search.*` و `listing.*` به `frontend/messages/fa.json` و `en.json`، برای هر متن T030 تا T041.

**Checkpoint**: quickstart، سناریوهای ۱ تا ۵ و ۱۳ (بخش جستجو) و ۱۴، روی stack و دمو.

---

## Phase 4: User Story 2 - حساب کاربری: ثبت‌نام، ورود، پروفایل، آواتار و خروج (Priority: P1)

**Goal**: ثبت‌نام، ورود ماندگار، ویرایش نام، آواتار پیش‌فرض، آپلود، جایگزینی و حذف عکس، و خروج واقعی.

**Independent Test**: ثبت‌نام کنید، مرورگر را ببندید و باز کنید و هنوز وارد باشید. نام را عوض کنید. آواتار پیش‌فرض را ببینید، یک PNG زیر ۵ مگابایت آپلود کنید، و ببینید فایل ۶ مگابایتی رد می‌شود. خارج شوید (quickstart، سناریوهای ۶، ۹، ۱۰، ۱۵ تا ۱۹).

### بکند آواتار: تست‌ها (اول، شکست‌خورده)

- [ ] T043 [US2] ساختن `backend/tests/test_avatar.py` روی PostgreSQL و MinIO واقعی (contracts/api.md):
  - **`upload-url`:**
    - برای `image/png` و `image/jpeg` کلید `avatars/{user_id}/…` و policy با `content-length-range` تا ۵٬۲۴۲٬۸۸۰ می‌دهد.
    - `image/webp` و `image/gif` پاسخ `422 validation_error` می‌گیرند.
  - **سقف در MinIO (SC-010):** آپلود واقعی ۵٬۲۴۲٬۸۸۱ بایت با همان presigned POST (httpx multipart) از خود MinIO `400` بگیرد و فایلی ذخیره نشود. ۵٬۲۴۲٬۸۸۰ بایت پذیرفته شود.
  - **`PUT /me/avatar`:**
    - PNG و JPEG درست → `200`، و `avatar_url` برابر `media_base_url/key`.
    - کلید کاربر دیگر یا پیشوند دیگر → `422 invalid_storage_key` (FR-040).
    - کلیدی که فایلش نیست → `422 upload_missing`.
    - فایل بزرگ‌تر از سقف، که با `Storage.put_bytes` مستقیم گذاشته شده تا policy دور زده شود → `422 image_too_large` با `details.max_bytes`، و فایل پاک شده باشد.
    - فایل متنی با `Content-Type: image/png` → `422 invalid_image`، و فایل پاک شده باشد.
    - در هر رد شدن، `avatar_url` قبلی بی‌تغییر بماند.
  - **جایگزینی و حذف (FR-039):**
    - عکس دوم، فایل اول را از storage پاک کند.
    - `DELETE /me/avatar` فایل را پاک کند و `avatar_url` را `null` کند.
    - `DELETE` دوم هم `200` بدهد.
  - **`PATCH /me` (FR-041):**
    - `https://example.com/a.png` → `422 invalid_avatar_url`، و `full_name` همان درخواست هم ذخیره نشود.
    - نشانی storage خود کاربر با فایل درست → `200`.
    - نشانی storage کاربر دیگر → `422 invalid_avatar_url`.
    - `null` → فایل پاک شود.
  - **ورود:** بدون توکن، هر سه endpoint `401` بدهند.
- [ ] T044 [US2] در `backend/tests/test_identity.py:108`: تست `PATCH /me` به جریان تازه تغییر کند. `full_name` با `avatar_url: null`، و یک تست جدا برای رد شدن نشانی بیرونی (FR-041). دلیل تغییر در کامنت تست آمده باشد.

### بکند آواتار: پیاده‌سازی

- [ ] T045 [US2] در `backend/src/caravansara/core/config.py`: `max_avatar_bytes: int = 5 * 1024 * 1024`، با کامنت: سقف آواتار در policy آپلود و در بررسی `PUT /me/avatar`. تصمیم مالک پروژه، 2026-11-08 (FR-038).
- [ ] T046 [US2] در `backend/src/caravansara/core/storage.py`:
  - `presigned_upload(key, content_type, max_bytes)`. همه‌ی صدا زدن‌های امروز در `listings/service.py` با `settings.max_photo_bytes` به‌روز شوند، پس رفتار عکس آگهی عوض نمی‌شود.
  - `async size(key) -> int | None`، از `head_object` و `ContentLength`.
  - `async read_head(key, n=8) -> bytes`، با `get_object` و `Range: bytes=0-{n-1}`.
  - `key_from_url(url) -> str | None`: اگر نشانی با `media_base_url/` شروع شود، کلید را می‌دهد، وگرنه `None`.
  - هر تابع یک docstring کوتاه با دلیلش دارد.
- [ ] T047 [US2] در `backend/src/caravansara/identity/schemas.py`، `service.py` و `router.py` (contracts/api.md):
  - **`schemas.py`:**
    - `AvatarType = Literal["image/png", "image/jpeg"]`، با کامنت: جدا از `ImageType` آگهی، چون آواتار WebP را نمی‌پذیرد.
    - `AvatarUploadUrlIn` و `AvatarSetIn` (`storage_key: str = Field(max_length=300)`).
    - `ProfileUpdate.avatar_url`: توضیح فیلد قاعده‌ی FR-041 را بگوید و به `PUT /me/avatar` اشاره کند.
    - `UploadUrlOut` از `listings.schemas` import نمی‌شود، چون import میان ماژول‌ها ممنوع است. یک `AvatarUploadUrlOut` هم‌شکل در `identity/schemas.py` تعریف می‌شود.
  - **`service.py`:**
    - `avatar_upload_url(storage, settings, user_id, content_type)`: کلید `avatars/{user_id}/{uuid4().hex}.{png|jpg}`.
    - `set_avatar(session, storage, settings, user_id, storage_key)`: بررسی‌های ۱ تا ۴ به ترتیب contracts/api.md. فایل ردشده در ۳ و ۴ پاک می‌شود. `avatar_url` و commit. فایل قبلی کاربر، اگر زیر `avatars/{user_id}/` بوده، پس از commit پاک می‌شود، و شکست آن فقط لاگ می‌شود.
    - `remove_avatar(...)`.
    - `update_me`: اگر `avatar_url` آمده باشد، `null` به `remove_avatar` می‌رود. نشانی دیگر با `storage.key_from_url` به کلید تبدیل می‌شود و به `set_avatar` می‌رود. اگر کلید نبود یا پیشوندش مال کاربر نبود، `Unprocessable("invalid_avatar_url", …)`. همه‌ی این بررسی‌ها پیش از هر تغییر در `full_name` انجام می‌شوند، تا درخواست یکجا رد شود.
    - کدهای تازه: `image_too_large` (با `details={"max_bytes": …}`)، `invalid_image` و `invalid_avatar_url`.
    - لاگ‌ها هیچ نشانی یا کلید کامل ندارند، فقط `user_id` (اصل V).
  - **`router.py`:**
    - `POST /me/avatar/upload-url`، `PUT /me/avatar` و `DELETE /me/avatar`، با `summary` و `description`، مثال‌ها، و `error_responses(401, 422)`.
    - توضیح `PATCH /me` قاعده‌ی تازه را بگوید.
- [ ] T048 [US2] اجرای `uv run caravansara export-openapi --output openapi.json` در `backend/`. سپس بررسی:
  - diff فقط سه مسیر تازه، schemaهای تازه، و توضیح `avatar_url` در `ProfileUpdate` و `PATCH /me` را نشان دهد (۳۶ ← ۳۹ عملیات).
  - `uv run pytest tests/test_avatar.py tests/test_identity.py tests/test_openapi_contract.py` پاس شود.
  - `uv run lint-imports`، `mypy` و `ruff` سبز باشند.
  - سپس `cd frontend && npm run gen:api`، تا `schema.d.ts` همگام شود.
- [ ] T049 [US2] در `e2e/tests/auth.spec.ts:91`: تست پروفایل دیگر `https://example.com/avatar.png` نفرستد. نام را عوض کند، و رد شدن نشانی بیرونی را با `422 invalid_avatar_url` بسنجد. در `e2e/tests/web.spec.ts` (T072) یک آپلود واقعی آواتار از راه presigned POST هم اضافه می‌شود.

### فرانت‌اند حساب (US2)

- [ ] T050 [P] [US2] ساختن `frontend/src/lib/avatar.ts` و `avatar.test.ts` (data-model، «آواتار»، R20):
  - `initialOf(fullName)`: با `Intl.Segmenter`. برای نام فارسی، حرف اول درست است، و نیم‌فاصله و نویسه‌ی ترکیبی جدا نمی‌شوند.
  - `avatarColor(userId)`: `palette[userId % 8]`. ۸ رنگ ثابت، که هر کدام با متن سفید کنتراست ≥ 4.5:1 دارد، و تست این را حساب می‌کند.
  - `isOwnMediaUrl(url)`: فقط نشانی‌ای که با `NEXT_PUBLIC_MEDIA_BASE_URL` شروع شود (FR-041).
  - `checkAvatarFile(file)`:
    - `size ≤ 5242880`.
    - `type ∈ {image/png, image/jpeg}`.
    - ۸ بایت اول (`file.slice(0, 8)`) امضای PNG (`89 50 4E 47 0D 0A 1A 0A`) یا JPEG (`FF D8 FF`) باشند.
    - خروجی `ok` است، یا یکی از `too_large`، `wrong_type` و `not_image`.
  - **تست:** هر سه خطا، فایل `.png` با محتوای متنی، دقیقاً ۵٬۲۴۲٬۸۸۰ و ۵٬۲۴۲٬۸۸۱ بایت، نام‌های فارسی و لاتین، و نشانی بیرونی.
- [ ] T051 [P] [US2] ساختن `frontend/src/components/account/UserAvatar.tsx` و `UserAvatar.test.tsx` (FR-037):
  - اگر `avatar_url` پر و `isOwnMediaUrl` باشد، تصویر. وگرنه آواتار پیش‌فرض: حرف اول روی `avatarColor`.
  - `alt` یا `aria-label` نام کاربر.
  - اندازه‌های `sm`، `md` و `lg`.
  - در `Header` (T010)، `ReviewList` (T040) و نام میزبان در صفحه‌ی آگهی (T041) جای جای‌نگه‌دار را می‌گیرد.
  - **تست:** پیش‌فرض، عکس، نشانی بیرونی که پیش‌فرض نشان داده می‌شود، و axe.
- [ ] T052 [US2] ساختن `frontend/src/components/account/AvatarUploader.tsx` و `AvatarUploader.test.tsx` (US2/AC10 تا AC12):
  - انتخاب فایل (`accept="image/png,image/jpeg"`) و `checkAvatarFile`. هر خطا پیام ترجمه‌شده می‌گیرد و هیچ درخواستی فرستاده نمی‌شود.
  - پیش‌نمایش با `URL.createObjectURL`، که پس از استفاده آزاد می‌شود.
  - «ذخیره»، به ترتیب:
    1. `POST /me/avatar/upload-url`
    2. فرستادن فرم multipart به `url`، با `fields` و سپس `file`
    3. `PUT /me/avatar`
    4. به‌روزرسانی cache `["me"]`
  - نوار پیشرفت، و حفظ آواتار قبلی اگر هر قدم شکست بخورد (Edge Cases).
  - «حذف عکس» با `DELETE /me/avatar`.
  - خطاهای `image_too_large`، `invalid_image` و `upload_missing` پیام ترجمه‌شده می‌گیرند.
  - **تست:** هر قدم با fetch جعلی، شکست آپلود که آواتار قبلی را نگه می‌دارد، حذف، فایل نامعتبر که هیچ fetchی نمی‌سازد، و axe.
- [ ] T053 [US2] ساختن `frontend/src/app/[locale]/login/page.tsx` و `register/page.tsx`، با تست‌های کنارشان (US2/AC1 تا AC4، AC7):
  - فرم با برچسب و پیام کنار فیلد.
  - ارسال به `/session/login` یا `/session/register`، و سپس `setSession`.
  - رفتن به `returnTo` امن (T024)، یا `/{locale}`.
  - `invalid_credentials` پیام عمومی می‌گیرد که نمی‌گوید کدام اشتباه است. `email_taken` و `too_many_attempts` پیام خودشان را می‌گیرند.
  - قاعده‌های رمز همان بکند‌اند: ۸ تا ۱۲۸ نویسه، و نام ۱ تا ۱۰۰ نویسه.
  - **تست:** هر پیام، returnTo امن و ناامن، و axe.
- [ ] T054 [US2] ساختن `frontend/src/app/[locale]/account/page.tsx` و `account.test.tsx`، درون `RequireAuth` (FR-015، US2/AC8):
  - نام با `PATCH /me` فقط با `full_name`. سایت `avatar_url` را هرگز در `PATCH` نمی‌فرستد.
  - `AvatarUploader`.
  - دکمه‌ی «خروج»: `POST /session/logout`، سپس `clearSession` و پیام به زبانه‌های دیگر، و رفتن به `/{locale}` (US2/AC6).
- [ ] T055 [US2] افزودن کلیدهای `account.*` و `auth.*` به `frontend/messages/fa.json` و `en.json`، از جمله پیام‌های `too_large` («حداکثر ۵ مگابایت»)، `wrong_type` («فقط PNG یا JPEG») و `not_image`.

**Checkpoint**: quickstart، سناریوهای ۶، ۹، ۱۰، ۱۵ تا ۱۹. pytest بکند و تست‌های سایت سبز باشند.

---

## Phase 5: User Story 3 - رزرو با نگه‌داشت ۱۵ دقیقه‌ای و پرداخت (Priority: P1)

**Goal**: از صفحه‌ی آگهی تا رزرو قطعی، با شمارش معکوس و پرداخت شبیه‌سازی‌شده.

**Independent Test**: با حساب دمو یک اقامتگاه آزاد را رزرو کنید. شمارش معکوس را ببینید، پرداخت کنید، و ببینید رزرو قطعی شده و نشانی دقیق دیده می‌شود (quickstart، سناریوهای ۶ تا ۸).

- [ ] T056 [P] [US3] ساختن `frontend/src/lib/bookingDraft.ts` و `bookingDraft.test.ts` (R13، data-model، «پیش‌نویس رزرو»):
  - `sessionStorage`، کلید `cv-booking-draft`.
  - `idempotency_key` با `crypto.randomUUID()`، فقط هنگام ساخت یا تغییر فیلدهای انتخاب.
  - پاک شدن پس از پرداخت یا لغو.
  - `try`/`catch` روی هر دسترسی، برای مرورگری که storage را بسته است.
  - **تست:** کلید با فرستادن دوباره ثابت می‌ماند و با تغییر عوض می‌شود، و هیچ توکنی ذخیره نمی‌شود.
- [ ] T057 [P] [US3] ساختن `frontend/src/lib/bookingView.ts` و `bookingView.test.ts` (data-model، «نمای رزرو»):
  - `remainingMs(booking, now, skew)` و `canPay`.
  - `canCancel`: `status ∈ {pending, confirmed}` و امروزِ شهر پیش از `check_in`.
  - `cancelDeadline`.
  - `canReview`: `completed` و امروزِ شهر ≤ `check_out + 14`.
  - `group`: `upcoming` یا `past`.
  - `nightsBetween`، و `priceBreakdown`: شب‌ها × قیمت + نظافت، با محاسبه‌ی decimal مثل بکند (FR-023).
  - `preCheck(listing, draft, today)`: ظرفیت، حیوان، خروج پس از ورود، ورود نه پیش از امروزِ شهر، و بیشینه‌ی ۳۶۵ شب (FR-024).
  - **تست:** هر مرز: روز ورود به وقت تهران و نیویورک، روز چهاردهم و پانزدهم پس از خروج، و پایان مهلت با اختلاف ساعت.
- [ ] T058 [P] [US3] ساختن `frontend/src/components/booking/PriceBreakdown.tsx` و `HoldCountdown.tsx`، با تست‌هایشان:
  - **`HoldCountdown`:** از `hold_expires_at` و `skew`، هر ثانیه به‌روز می‌شود. `aria-live="polite"` فقط در دقیقه‌ی ۵، دقیقه‌ی ۱ و صفر اعلام می‌کند. در صفر `onExpire` را صدا می‌زند (FR-026، R12).
  - **`PriceBreakdown`:** با `formatMoney`.
  - **تست:** با تایمر جعلی، اعلام‌ها فقط در همان سه لحظه، و صفر.
- [ ] T059 [US3] ساختن `frontend/src/components/listing/BookingBox.tsx` و `BookingBox.test.tsx`، و استفاده از آن در `frontend/src/app/[locale]/listings/[id]/page.tsx`:
  - تاریخ‌ها و مهمان‌ها، `PriceBreakdown`، و `preCheck` با پیام کنار فیلد.
  - «رزرو»: پیش‌نویس ساخته می‌شود و به `/{locale}/book/{listingId}` می‌رود. اگر کاربر وارد نشده، `RequireAuth` او را به ورود می‌برد و برمی‌گرداند (US2/AC7).
  - برای آگهی خود کاربر، پیام `own_listing` (US3/AC6).
- [ ] T060 [US3] ساختن `frontend/src/app/[locale]/book/[listingId]/page.tsx` و `book.test.tsx`، درون `RequireAuth` (US3/AC1، AC4 تا AC6):
  - پیش‌نویس را می‌خواند، خلاصه و جمع را نشان می‌دهد.
  - «تأیید»: `POST /bookings` با `Idempotency-Key` پیش‌نویس، و با موفقیت رفتن به `/{locale}/trips/{id}`.
  - **خطاها:**
    - `dates_unavailable`: «این تاریخ‌ها همین الان رزرو شد»، و بازگشت به آگهی.
    - `capacity_exceeded`، `own_listing`، `invalid_dates` و `idempotency_key_reused` پیام خودشان را می‌گیرند.
  - دکمه هنگام ارسال غیرفعال است. اگر ارسال دوباره شد، همان کلید فرستاده می‌شود (US3/AC5).
  - **تست:** دو کلیک فقط یک کلید می‌فرستد، و هر خطا.
- [ ] T061 [US3] ساختن `frontend/src/app/[locale]/trips/[bookingId]/page.tsx` و `tripDetail.test.tsx`، درون `RequireAuth` (US3/AC2، AC3، AC7، FR-027، FR-028):
  - `GET /bookings/{id}`، و `skew` از سرآیند `Date`.
  - **`pending`:**
    - `HoldCountdown` و `PriceBreakdown`.
    - متن «پرداخت شبیه‌سازی است و هیچ اطلاعات کارتی خواسته نمی‌شود».
    - «پرداخت» با `POST /bookings/{id}/pay`.
    - در صفر یا با `hold_expired`، پیام «مهلت پرداخت تمام شد» و پیوند «رزرو دوباره»، که پیش‌نویس تازه با کلید تازه می‌سازد.
  - **`confirmed` یا `completed`:**
    - نشانی دقیق از `address`.
    - ساعت ورود و خروج به وقت `listing.timezone` با نام منطقه.
  - بخش لغو در US4 (T064) به همین فایل اضافه می‌شود.
  - **تست:** پرداخت موفق، `hold_expired`، برگشت به نگه‌داشت با مهلت باقی‌مانده، و axe.
- [ ] T062 [US3] افزودن کلیدهای `booking.*` به `frontend/messages/fa.json` و `en.json`.

**Checkpoint**: quickstart، سناریوهای ۶ تا ۸. سه story P1 با هم کوچک‌ترین محصول قابل استفاده‌اند.

---

## Phase 6: User Story 4 - سفرهای من و لغو (Priority: P2)

**Goal**: فهرست رزروها، جدا شده به آینده و گذشته، با جزئیات و لغو تا پیش از روز ورود.

**Independent Test**: یک رزرو قطعی آینده را در فهرست ببینید، لغوش کنید، و ببینید وضعیتش «لغوشده» شده است. برای رزروی که روز ورودش رسیده، دکمه‌ی لغو نباشد (quickstart، سناریوی ۱۱).

- [ ] T063 [US4] ساختن `frontend/src/app/[locale]/trips/page.tsx` و `trips.test.tsx`، درون `RequireAuth` (FR-029، US4/AC1، AC5):
  - `GET /me/bookings` با صفحه‌بندی، و گروه‌بندی با `bookingView.group`.
  - هر ردیف: عکس و نام آگهی، تاریخ‌ها با `formatDate` در تقویم زبان، وضعیت ترجمه‌شده، و جمع.
  - حالت خالی، با پیوند به جستجو.
  - **تست:** گروه‌بندی، تقویم شمسی و میلادی، حالت خالی، و axe.
- [ ] T064 [US4] افزودن بخش لغو به `frontend/src/app/[locale]/trips/[bookingId]/page.tsx`، و ساختن `frontend/src/components/booking/CancelDialog.tsx` با تستش (FR-030، US4/AC2 تا AC4):
  - `cancelDeadline` به‌صورت «تا پایان روز X به وقت Y».
  - دکمه فقط وقتی `canCancel` برقرار است.
  - دیالوگ تأیید با متن «بدون جریمه و بازپرداخت».
  - `POST /bookings/{id}/cancel`، و برای `invalid_booking_state` پیام «این رزرو دیگر لغوشدنی نیست».
  - **تست:** روز پیش از ورود و خود روز ورود به وقت شهر، دیالوگ، خطای هم‌زمانی، و axe.
- [ ] T065 [US4] افزودن کلیدهای `trips.*` به `frontend/messages/fa.json` و `en.json`.

**Checkpoint**: quickstart، سناریوی ۱۱.

---

## Phase 7: User Story 5 - ثبت نظر پس از اقامت (Priority: P3)

**Goal**: نظر با امتیاز کلی، شش امتیاز جزئی و متن، تا ۱۴ روز پس از خروج.

**Independent Test**: با یک رزرو «انجام‌شده»ی دمو نظر بدهید و آن را در صفحه‌ی آگهی ببینید. نظر دوم برای همان رزرو ممکن نباشد (quickstart، سناریوی ۱۲).

- [ ] T066 [US5] ساختن `frontend/src/app/[locale]/trips/[bookingId]/review/page.tsx` و `review.test.tsx`، درون `RequireAuth` (FR-031، US5/AC1 تا AC3):
  - فرم امتیاز کلی و شش امتیاز جزئی، هر کدام ۱ تا ۵: `cleanliness`، `accuracy`، `check_in`، `communication`، `location` و `value`. هر امتیاز یک گروه radio با برچسب است، و با صفحه‌کلید کار می‌کند.
  - متن نظر.
  - فیلد ناقص، پیام کنارش را می‌گیرد و چیزی فرستاده نمی‌شود.
  - `POST /bookings/{id}/review`.
  - `already_reviewed` و `review_window_closed` پیام خودشان را می‌گیرند. پس از `already_reviewed`، گزینه‌ی نظر برای همان رزرو در cache پنهان می‌شود (data-model).
  - پس از موفقیت، رفتن به صفحه‌ی آگهی.
  - **تست:** هر پیام، فرم ناقص، و axe.
- [ ] T067 [US5] افزودن پیوند «ثبت نظر» به `frontend/src/app/[locale]/trips/page.tsx` و `trips/[bookingId]/page.tsx`، فقط وقتی `canReview` برقرار است.
- [ ] T068 [US5] افزودن کلیدهای `review.*` به `frontend/messages/fa.json` و `en.json`.

**Checkpoint**: quickstart، سناریوی ۱۲.

---

## Phase 8: Polish & Cross-Cutting Concerns

### بررسی سراسری

- [ ] T069 بررسی دسترس‌پذیری و جهت در همه‌ی صفحه‌ها (FR-008، FR-009، SC-002، SC-004):
  - هر `*.test.tsx` صفحه axe را در هر دو زبان اجرا کند، و هیچ یافته‌ی سطح A یا AA نماند.
  - بررسی دستی در Chrome با عرض ۳۶۰ و ۱۲۸۰ در `/fa` و `/en`: هیچ اسکرول افقی، آیکن جهت‌دار برعکس، و کار کامل با صفحه‌کلید.
- [ ] T070 [P] جستجوی متن انگلیسی در نسخه‌ی فارسی (SC-002): یک تست در `frontend/src/messages.test.ts` بررسی کند که هیچ مقدار `fa.json` حرف لاتین ندارد، جز فهرست مجاز نام‌های فنی (`PNG`، `JPEG`، `OpenStreetMap`) که در خود تست آمده‌اند.
- [ ] T071 [P] بررسی FR-036 در `frontend/src/`: `grep` روی `console.` و لاگ‌ها، و حذف هر لاگی که ایمیل، رمز، توکن یا نشانی را می‌نویسد. قاعده‌ی ESLint `no-console` (به‌جز `console.error` با پیام ثابت) در `frontend/eslint.config.mjs` هم اضافه شود.

### e2e و stack

- [ ] T072 ساختن `e2e/tests/web.spec.ts` روی stack، با سرویس `web` (R5، R19):
  - **proxy:** `GET http://localhost:3001/api/v1/search/listings?…` همان نتیجه‌ی API را بدهد. `GET http://localhost:3001/metrics` و `/docs` پاسخ 404 بدهند.
  - **IP جدا:** دو کاربر با `X-Forwarded-For` متفاوت، هر کدام ۵ ورود ناموفق از راه `/session/login`. فقط کاربری که از سقف گذشته `429` بگیرد، و دیگری `401`. این ثابت می‌کند محدودیت تلاش IP واقعی را می‌شمارد. اگر Next.js سرآیند را عبور ندهد، این تست شکست می‌خورد و T022 اصلاح می‌شود.
  - **جعل IP از بیرون:** درخواست مستقیم به `:8000` با `X-Forwarded-For` جعلی همچنان با IP خودش شمرده شود.
  - **مسیرهای auth بسته:** `POST http://localhost:3001/api/v1/auth/login` و `/auth/refresh` پاسخ 404 بدهند (R19).
  - **CSP:** پاسخ `/fa` سرآیند `Content-Security-Policy` با `nonce-` داشته باشد، و همان nonce در تگ‌های `<script>` صفحه باشد (R21).
  - **نشست:** `/session/login` کوکی `cv_refresh` را با `HttpOnly` و `SameSite=Strict` بگذارد، و `Origin` نادرست `403` بگیرد.
  - **آواتار:** آپلود واقعی PNG کوچک از راه `upload-url`، presigned POST به MinIO و `PUT /me/avatar`. سپس `GET` همان `avatar_url` پاسخ 200 بدهد.
  - **پاک‌سازی:** همه‌ی کاربرها با پیشوند e2e ساخته شوند، مثل تست‌های موجود.
- [ ] T073 به‌روزرسانی `e2e/README.md` و `e2e/tests/helpers.ts`: نشانی سایت (`WEB = http://localhost:3001`) و توضیح `web.spec.ts`.
- [ ] T074 اجرای همه‌ی بررسی‌ها:
  - `cd backend && uv run pytest`، با پوشش ≥ ۹۰٪، و ruff، mypy و lint-imports.
  - `cd frontend` و همه‌ی مراحل CI (quickstart).
  - `docker compose up --build` و سپس `cd e2e && npm test` (۵۱ تست پیشین و تست‌های تازه).
  - نتیجه با عدد در همین task ثبت شود.

### اندازه‌گیری (SC-003)

- [ ] T075 اندازه‌گیری Lighthouse، Mobile، طبق quickstart، روی `caravansara_bulk`. API موقتاً با `CARAVANSARA_DATABASE_URL=postgresql+asyncpg://caravansara:caravansara@db:5432/caravansara_bulk docker compose up -d --no-deps api` به bulk وصل می‌شود، و پس از اندازه‌گیری با `docker compose up -d --no-deps api` به پایگاه داده‌ی اصلی برمی‌گردد. Lighthouse فقط می‌خواند، و هیچ داده‌ای در bulk نوشته یا پاک نمی‌شود.
  - صفحه‌ها: `/fa`، `/fa/search` (لندن با تاریخ) و صفحه‌ی یک آگهی.
  - ثبت LCP، TBT/INP و CLS در `specs/005-frontend-guest/measurements.md`.
  - اگر هدف برآورده نشد، علت اندازه‌گیری‌شده و اصلاح آن پیش از ادامه ثبت شود (اصل VII).

### مستندها (قاعده‌ی مستندسازی، constitution: Development Workflow)

- [ ] T076 [P] در `README.md`:
  - نشانی سایت (`http://localhost:3001`)، و فرمان‌های `frontend/`.
  - badge شمار تست‌ها و پوشش، به‌روز با T074.
  - نمودار معماری، با سرویس `web`: `docs/images/readme/diagrams/architecture.mmd` و ساختن دوباره‌ی `architecture.svg`. اگر ابزار ساخت تصویر اجازه نگیرد، فرمانش برای مالک پروژه ثبت می‌شود.
- [ ] T077 [P] در `CONTEXT.md`، `backend/README.md` و ساختن `frontend/README.md`:
  - ساختار `frontend/` و فرمان‌ها.
  - قاعده‌های نشست و قفل.
  - تست‌ها.
  - «قدم بعد»: صفحه‌های میزبان (کار 006).
- [ ] T078 در `docs/backend-design.md`:
  - **بخش تازه‌ی «فرانت‌اند وب»:** پشته، نشست (کوکی، قفل، `Origin`)، proxy و یک مبدأ، IP واقعی و `FORWARDED_ALLOW_IPS`، رندر سرور و کاربر، تقویم شمسی، وقت شهر، تومان، ترجمه‌ی کاتالوگ‌ها، CSP، تست‌ها و CI. هر ساختار با دلیل و اثر، از جدول future-work.
  - **بخش «آپلود عکس»:** گسترش به «آپلود عکس (آگهی و آواتار)»، با جدول دو نوع عکس کنار هم: سقف (۱۰ MB و ۵ MB)، نوع‌ها، پیشوند کلید، بررسی‌های سرور، کدهای خطا، و پاک شدن فایل قبلی. سقف و نوع‌های عکس آگهی، که امروز در سند نیستند، هم اضافه شوند.
  - **جدول API و جدول خطا:** سه endpoint آواتار، رفتار تازه‌ی `PATCH /me`، و `image_too_large`، `invalid_image` و `invalid_avatar_url`.
  - **«زیرساخت و تحویل»:** سرویس `web`، شبکه‌ی `app`، و CORS storage در production.
  - **«راهبرد تست»:** Vitest، axe، و پوشش ۹۰٪ `src/lib`.
  - **اندازه‌های SC-003:** از T075.
  - ساختن دوباره‌ی `docs/backend-design.pdf`، با همان روش markdown → HTML → Chrome headless که پیش‌تر استفاده شد.
- [ ] T079 در `docs/future-work.md`، بخش ۱:
  - کارهای انجام‌شده‌ی بخش مهمان از فهرست برداشته شوند.
  - جدول «ساختارهای تازه‌ی بخش مهمان» برداشته شود، چون به `backend-design.md` رفته است.
  - صفحه‌های میزبان و پنل مدیر بمانند.
  - کارهای باقی‌مانده بمانند: فیلد «نظر دارد»، سنجش مرورگر در Grafana، lifecycle فایل‌های رهاشده‌ی `avatars/`، و CORS storage در production.
  - جدول «ترتیب پیشنهادی» به‌روز شود.

### بررسی نهایی

- [ ] T080 اجرای quickstart از اول تا آخر روی stack تازه‌ساخته (`docker compose down` بدون `-v`، چون داده‌ی دمو و bulk پاک نمی‌شود، و سپس `up --build`). هر ۲۰ سناریو انجام شود، و نتیجه در همین task ثبت شود. دو زمان هم در `specs/005-frontend-guest/measurements.md` ثبت شود:
  - **SC-009:** فاصله‌ی پایان `docker compose up` تا اولین پاسخ 200 از `http://localhost:3001/fa`. هدف: کمتر از ۲ دقیقه.
  - **SC-001:** زمان یک کاربر تازه روی عرض ۳۶۰ پیکسل، از صفحه‌ی اول تا رزرو قطعی (جستجو، انتخاب، ثبت‌نام، پرداخت)، بدون راهنما. هدف: کمتر از ۵ دقیقه. دستی است، طبق اصل IV، و اگر ممکن باشد با کسی جز سازنده انجام شود.
- [ ] T081 اجرای `/speckit-converge` تا Converged، پیش از pull request (constitution).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** هیچ وابستگی‌ای ندارد.
- **Foundational (Phase 2)** به Setup وابسته است، و همه‌ی storyها را متوقف می‌کند.
  - T018، یعنی کلاینت، پیش از T020 و T021 است.
  - T019، یعنی نشست، پیش از T020 و T025 است.
  - T011 پیش از T012 است.
- **US1 (Phase 3)** فقط به Phase 2 وابسته است.
- **US2 (Phase 4)** فقط به Phase 2 وابسته است. بخش بکند آن (T043 تا T049) هیچ وابستگی‌ای به فرانت‌اند ندارد، و می‌تواند هم‌زمان با Phase 2 شروع شود. T048 پیش از T050 تا T054 است، چون `schema.d.ts` باید endpointهای آواتار را داشته باشد.
- **US3 (Phase 5)** به US1 (صفحه‌ی آگهی، T041) و US2 (ورود، T053) وابسته است.
- **US4 (Phase 6)** به US3 (صفحه‌ی جزئیات رزرو، T061) وابسته است.
- **US5 (Phase 7)** به US4 (فهرست سفرها، T063) وابسته است.
- **Polish (Phase 8)** پس از همه‌ی storyها است.

### User Story Dependencies

- US1 و US2 مستقل‌اند و هر کدام جدا آزمودنی‌اند.
- US3 به US1 و US2 تکیه دارد، چون رزرو از صفحه‌ی آگهی و با حساب انجام می‌شود.
- US4 و US5 به رزروی که US3 ساخته تکیه دارند. با داده‌ی دمو، که رزروهای انجام‌شده و آینده دارد، هر دو بدون US3 هم آزمودنی‌اند، به‌جز ساختن رزرو تازه.

### Within Each User Story

- قاعده‌ها (`src/lib`) و تست‌هایشان پیش از کامپوننت‌ها می‌آیند.
- کامپوننت‌ها پیش از صفحه‌ها می‌آیند.
- کلیدهای ترجمه‌ی هر story در آخرین task همان story اضافه می‌شوند، تا دو فایل ترجمه در هر phase یک بار باز شوند.
- در بکند آواتار، تست‌ها اول و شکست‌خورده‌اند (T043، T044). سپس config، storage و identity، و در آخر قرارداد.

### Parallel Opportunities

- **Phase 1:** T004 و T005.
- **Phase 2:** T008، T010، T012 تا T017، T021، T024، T025 و T029، همه در فایل‌های جدا.
- **US1:** T030 تا T033، و T035 تا T037، و T040.
- **US2:** بخش بکند (T043 تا T049) هم‌زمان با کل Phase 2 و US1. سپس T050 و T051 هم‌زمان.
- **US3:** T056 تا T058.
- **Polish:** T070، T071، T076 و T077.

---

## Parallel Example: User Story 1

```bash
# پس از Phase 2، با هم:
Task: "T030 [US1] searchParams.ts + test"
Task: "T031 [US1] DateRangePicker (شمسی و میلادی) + test"
Task: "T032 [US1] CityCombobox + test"
Task: "T033 [US1] GuestPicker + test"
Task: "T035 [US1] ResultCard + test"
Task: "T036 [US1] ResultsMap + test"
Task: "T037 [US1] FiltersPanel + test"
```

## Parallel Example: User Story 2 (بکند و فرانت‌اند)

```bash
# هم‌زمان با Phase 2 فرانت‌اند:
Task: "T043 [US2] backend/tests/test_avatar.py (شکست‌خورده)"
# سپس به ترتیب: T044 → T045 → T046 → T047 → T048 → T049
# پس از T048، با هم:
Task: "T050 [US2] lib/avatar.ts + test"
Task: "T051 [US2] UserAvatar + test"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Phase 1 و Phase 2 را کامل کنید، و checkpoint را ببینید: سایت خالی و راست‌به‌چپ روی ۳۰۰۱.
2. US1: جستجو و آگهی. اینجا یک نسخه‌ی قابل نمایش بدون حساب وجود دارد.
3. US2: حساب و آواتار. بکند آواتار از ابتدای Phase 2 جلو برود.
4. US3: رزرو و پرداخت. **اینجا کوچک‌ترین محصول قابل استفاده آماده است**: پیدا کردن، وارد شدن و رزرو کردن (SC-001).

### Incremental Delivery

- پس از US4: مهمان رزروهایش را می‌بیند و لغو می‌کند.
- پس از US5: چرخه‌ی مهمان کامل است.
- Polish: e2e، اندازه‌گیری، مستندها، quickstart کامل، و converge.

### Notes

- **commit:** فقط با درخواست مالک پروژه، بدون هیچ امضای AI.
- **داده:** `caravansara_demo` و `caravansara_bulk` هرگز پاک نمی‌شوند. `docker compose down -v` اجرا نمی‌شود.
- **ابزار یا بسته‌ی تازه:** اگر نصب از اینترنت اجازه نگیرد، کار متوقف می‌شود و از مالک پروژه پرسیده می‌شود.
- **کد و متن:** کد، commit و PR به انگلیسی است. متن رابط کاربری از فایل ترجمه می‌آید و هیچ قاعده‌ی داخلی یا اصطلاح فنی به کاربر نشان داده نمی‌شود.
