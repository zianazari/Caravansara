# Implementation Plan: فرانت‌اند وب، بخش ۱: پایه و جریان مهمان

**Branch**: `005-frontend-guest` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-frontend-guest/spec.md`

## Summary

این کار سایت وب را در پوشه‌ی تازه‌ی `frontend/` می‌سازد. مهمان در آن جستجو می‌کند، آگهی می‌بیند، حساب می‌سازد، رزرو و پرداخت می‌کند، سفرهایش را می‌بیند و لغو می‌کند، و نظر می‌دهد. سایت به فارسی راست‌به‌چپ (پیش‌فرض) و انگلیسی است. API بکند فقط برای آواتار تغییر می‌کند، و این تغییر فقط افزودنی است (research R1).

- **پشته:** Next.js 16 (App Router)، TypeScript strict، Tailwind 4 و shadcn/ui، next-intl، TanStack Query، و کلاینت تولیدشده از `backend/openapi.json` (R2، R6).
- **نشست:**
  - نشست بلندمدت در کوکی `HttpOnly` است که route handlerهای `/session/*` می‌گذارند. نشست کوتاه‌مدت فقط در حافظه است (R3).
  - تازه کردن فقط در مرورگر و با قفل بین زبانه‌ها انجام می‌شود. دلیل: بکند استفاده‌ی دوباره از refresh token را دزدی می‌داند و همه‌ی نشست‌ها را باطل می‌کند (R4).
- **یک مبدأ:** سایت `/api/v1/*` را به API می‌فرستد، پس CORS لازم نیست (R5). API فقط از نشانی ثابت سایت `X-Forwarded-For` را می‌پذیرد، تا محدودیت تلاش هر کاربر را جدا بشمارد (R19).
- **رندر:** صفحه‌های جستجو و آگهی سمت سرور و بدون توکن رندر می‌شوند (موتور جستجو و سرعت). صفحه‌های حساب سمت کاربر هستند (R14).
- **قالب‌ها:**
  - تقویم شمسی در `/fa` با `Intl` و `jalaali-js` (R8).
  - وقت شهر آگهی با `Intl` و `timezone` شهر (R9).
  - ریال به تومان، با محاسبه‌ی decimal (R10).
  - ترجمه‌ی کاتالوگ‌های ثابت (R11).
- **آواتار:**
  - هر کاربر آواتار پیش‌فرض دارد: حرف اول نام روی رنگ ثابت، که در سایت ساخته می‌شود.
  - عکس خود کاربر، PNG یا JPEG تا ۵ مگابایت، با همان روش presigned POST عکس آگهی آپلود می‌شود.
  - سه endpoint تازه در `identity`، که اندازه و امضای محتوای فایل را دوباره می‌سنجند و فایل قبلی را پاک می‌کنند (R20، contracts/api.md).
- **اجرا:** سرویس `web` در `docker compose` روی پورت ۳۰۰۱، و job `frontend` در CI (R15).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) روی Node 24 LTS؛ React 19

**Primary Dependencies**: Next.js 16، next-intl 4، Tailwind CSS 4، shadcn/ui (Radix)، TanStack Query 5، openapi-typescript 7 + openapi-fetch، MapLibre GL 5، jalaali-js 2. نسخه‌ها دقیق (بدون `^`) و با `package-lock.json` (R2)

**Storage**: جدول یا ستون تازه‌ای در پایگاه داده نیست (`users.avatar_url` از قبل هست). فایل آواتار در storage، زیر `avatars/{user_id}/` است. سمت مرورگر: کوکی `cv_refresh` (HttpOnly) و پیش‌نویس رزرو در `sessionStorage` (data-model.md)

**Testing**: بکند (آواتار): pytest روی PostgreSQL و MinIO واقعی (testcontainers)، مثل بقیه‌ی بکند. فرانت‌اند: Vitest 4 + Testing Library + jsdom، `vitest-axe`؛ تست‌های e2e موجود API روی stack. تست مرورگر Playwright برای صفحه‌ها کار بعدی است (spec، Assumptions)

**Target Platform**: مرورگرهای امروزی موبایل و دسکتاپ (دو نسخه‌ی آخر Chrome، Safari، Firefox و Edge)؛ سرور Next.js در container لینوکس

**Project Type**: web application (`frontend/` کنار `backend/`)

**Performance Goals**: Core Web Vitals «خوب» روی موبایل و 4G با داده‌ی حجیم: LCP ≤ ۲.۵ ثانیه، INP ≤ ۲۰۰ میلی‌ثانیه، CLS ≤ ۰.۱ (SC-003)

**Constraints**:

- API فقط افزودنی عوض می‌شود: سه endpoint آواتار (R1، R20).
- آواتار حداکثر ۵٬۲۴۲٬۸۸۰ بایت، و فقط PNG یا JPEG است، با بررسی محتوا در سرور (FR-038).
- هیچ توکنی در جایی نیست که اسکریپت صفحه بتواند پس از بارگذاری دوباره بخواند (FR-012).
- نشانی دقیق در هیچ صفحه‌ی عمومی نیست (FR-018).
- تاریخ‌های لغو و ورود به وقت شهر آگهی هستند (FR-006).
- WCAG 2.2 AA (FR-009).
- از عرض ۳۲۰ پیکسل بدون اسکرول افقی (FR-008).

**Scale/Scope**: حدود ۱۰ صفحه، ۴ route handler، ۳ endpoint تازه‌ی API، ۲ زبان، ۳۱ امکان و حدود ۳۰ کد خطا در فایل ترجمه. داده‌ی حجیم ۱۰۰٬۰۰۰ آگهی دارد.

هیچ NEEDS CLARIFICATION باقی نمانده است. هر فرض در research.md با کد، قرارداد، پایگاه داده‌ی دمو، stack در حال اجرا یا رجیستری npm سنجیده شده است.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل | وضعیت | چطور |
|---|---|---|
| I. پایگاه داده قاعده‌های مهم را نگه می‌دارد | ✅ | سایت هیچ قاعده‌ای را جای پایگاه داده نمی‌گیرد. بررسی‌های صفحه (ظرفیت، تاریخ، لغو و نظر) فقط برای پیام روشن‌اند، و پاسخ API مرجع است (FR-024، data-model «نمای رزرو»). `Idempotency-Key` برای هر پیش‌نویس ثابت می‌ماند، پس یکتایی کلید در پایگاه داده جلوی نگه‌داشت دوم را می‌گیرد (R13). آواتار قاعده‌ی هم‌زمانی ندارد: آخرین `PUT` برنده است، و هر کاربر فقط ردیف خودش را عوض می‌کند. |
| II. monolith ماژولی با مرز | ✅ | تغییر بکند فقط در `identity` (router، service، schemas) و `core` (storage، config) است. ماژول تازه یا import تازه‌ای میان ماژول‌ها نیست، پس قراردادهای import-linter دست نمی‌خورند. `web` سرویس فرانت‌اند است که constitution در «Technology and Domain Constraints» آن را تعیین کرده، نه شکستن بکند. Redis، صف یا سرویس بکند تازه‌ای در کار نیست. |
| III. قرارداد اول | ✅ | تنها تغییر API آواتار است. این تغییر اول در spec (FR-038 تا FR-041) و در contracts/api.md آمد. سه endpoint افزودنی‌اند (۳۶ ← ۳۹ عملیات). `PATCH /me` محدودتر می‌شود: دیگر نشانی بیرونی را نمی‌پذیرد (تصمیم مالک پروژه). هیچ فیلد یا کدی حذف نمی‌شود، هیچ داده‌ی واقعی‌ای تحت تأثیر نیست (R20)، و این تغییر در توضیح PR آشکار می‌آید. و `openapi.json` با `export-openapi` و `test_openapi_contract.py` همگام می‌ماند. دو کد خطای تازه هم دارد: `image_too_large` و `invalid_image`. کلاینت از آن تولید می‌شود، و CI ناهمخوانی را رد می‌کند (R6). هر کد خطا ترجمه دارد، و تستی آن را با کد بکند می‌سنجد (R7). |
| IV. تست روی زیرساخت واقعی | ✅ | آواتار با pytest روی MinIO واقعی آزموده می‌شود: فایل بزرگ‌تر از سقف را خود MinIO با policy رد می‌کند، و پسوند دروغ، کلید کاربر دیگر، فایل نبوده، جایگزینی و پاک شدن فایل قبلی هم تست دارند (SC-010). پوشش بکند ≥ ۹۰٪ می‌ماند. هر قاعده‌ی سایت و هر سناریوی پذیرش تست Vitest دارد (FR-035، quickstart). پوشش ۹۰٪ برای `src/lib` و `src/api` (R16). تست‌های e2e فعلی روی stack، با سرویس `web`، اجرا می‌شوند. آزمون IP پشت سایت هم e2e است (R19). SC-003 زمان روی سخت‌افزار است: دستی طبق quickstart، و ثبت در `docs/backend-design.md`. |
| V. حریم خصوصی و امنیت | ✅ | نشانی دقیق فقط در صفحه‌ی رزرو پرداخت‌شده است، و نقشه پین عمومی را نشان می‌دهد (FR-018). refresh token در کوکی HttpOnly با `SameSite=Strict` است، و `Origin` بررسی می‌شود (R3). قفل تازه کردن رفتار «استفاده‌ی دوباره = ابطال همه» را حفظ می‌کند و دورش نمی‌زند (R4). فقط `/api/v1` proxy می‌شود، و `/metrics` از سایت در دسترس نیست (R5). محدودیت تلاش با IP واقعی، و اعتماد فقط به نشانی سایت (R19). `returnTo` فقط مسیر داخلی را می‌پذیرد (contracts/web.md). لاگ سایت ایمیل، توکن یا نشانی ندارد (FR-036). هیچ رازی در `NEXT_PUBLIC_*` نیست. آواتار: کاربر فقط کلید زیر پیشوند خودش را ثبت می‌کند (FR-040)، و محتوای فایل در سرور سنجیده می‌شود، نه فقط نوع اعلام‌شده. `PATCH /me` دیگر نشانی بیرونی را نمی‌پذیرد، پس IP بینندگان به سرور دیگری نمی‌رسد. سایت و CSP نشانی‌های قدیمی را هم نادیده می‌گیرند (FR-041، R20). |
| VI. قابل مشاهده | ✅ | سه endpoint تازه‌ی آواتار از همان middleware لاگ، متریک با route template و trace می‌گیرند. رویداد کسب‌وکاری که ارزش شمارنده داشته باشد ندارند. درخواست‌های سایت از همان middleware بکند می‌گذرند و در لاگ و متریک می‌آیند. سنجش مرورگر به Grafana در future-work می‌ماند، چون endpoint تازه‌ی API می‌خواهد (R18). |
| VII. ساده، و اندازه‌گیری پیش از بهینه‌سازی | ✅ | محاسبه‌ی زمان شهر با `Intl`، بدون کتابخانه‌ی منطقه‌ی زمانی (R9). کتابخانه‌ی تقویم فقط برای تبدیل است (R8). کش نیست. SC-003 با اندازه‌گیری روی داده‌ی حجیم سنجیده می‌شود. |
| Technology Constraints | ✅ | Next.js App Router، TypeScript strict، shadcn/ui، Tailwind با ویژگی‌های logical، Vitest، فارسی RTL با Vazirmatn، کلاینت از `openapi.json`، و یک فرمان `docker compose`. |
| Workflow | ✅ | research هر فرض را با منبع سنجیده است. در tasks، کارهای یک فایل کنار هم می‌آیند. converge پیش از PR. شاخه‌ی دستی `005-frontend-guest`. پس از پایان، تصمیم‌ها به `docs/backend-design.md` می‌روند و بخش ۱ از future-work کوچک می‌شود (صفحه‌های میزبان و پنل مدیر می‌مانند). |

**Re-check پس از Phase 1**: data-model و contracts هیچ اصلی را نقض نمی‌کنند. تغییرهای بیرون از `frontend/` این‌هاست:
- سرویس `web`، شبکه‌ی `app` و `FORWARDED_ALLOW_IPS` در `docker-compose.yml`.
- job `frontend` در CI.
- تغییر افزودنی API برای آواتار (contracts/api.md)، با تست‌های بکند خودش.

دو مورد اول تنظیم‌اند. سومی رفتار تازه‌ی بکند است، که از spec و قرارداد شروع شد.

## Project Structure

### Documentation (this feature)

```text
specs/005-frontend-guest/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── web.md
│   └── api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/
├── package.json, package-lock.json       # نسخه‌های دقیق (R2)
├── next.config.ts                        # output: standalone، rewrites /api/v1 (R5)، next-intl plugin
├── tsconfig.json                         # strict
├── eslint.config.mjs, .prettierrc, vitest.config.ts
├── components.json                       # shadcn/ui
├── Dockerfile                            # Node 24 slim، standalone، کاربر غیر root (R15)
├── messages/
│   ├── fa.json                           # متن‌ها، errors.*، amenities.*، cities.*، propertyTypes.*
│   └── en.json
├── public/                               # فقط فایل‌های ثابت
└── src/
    ├── app/
    │   ├── [locale]/
    │   │   ├── layout.tsx                # lang و dir، Vazirmatn (next/font)، Providers
    │   │   ├── page.tsx                  # صفحه‌ی اول + فرم جستجو
    │   │   ├── search/page.tsx           # US1 (سرور) + نقشه و فیلترها (کاربر)
    │   │   ├── listings/[id]/page.tsx    # US1، generateMetadata، not-found
    │   │   ├── login/page.tsx, register/page.tsx, account/page.tsx   # US2 (account: نام و آواتار)
    │   │   ├── book/[listingId]/page.tsx                             # US3
    │   │   ├── trips/page.tsx, trips/[bookingId]/page.tsx            # US3، US4
    │   │   └── trips/[bookingId]/review/page.tsx                     # US5
    │   └── session/{login,register,refresh,logout}/route.ts          # R3، contracts/web.md
    ├── api/
    │   ├── schema.d.ts                   # تولیدشده از backend/openapi.json (R6)
    │   ├── client.ts                     # openapi-fetch؛ access token، تازه کردن در 401
    │   └── server.ts                     # درخواست سمت سرور بدون توکن (R14)
    ├── lib/                              # قاعده‌ها، با پوشش ≥ ۹۰٪ (R16)
    │   ├── session.ts                    # حافظه، navigator.locks، BroadcastChannel (R4)
    │   ├── calendar.ts                   # شمسی ↔ میلادی (R8)
    │   ├── cityTime.ts                   # امروز شهر، مهلت لغو (R9)
    │   ├── money.ts                      # تومان و Intl (R10)
    │   ├── digits.ts                     # ارقام فارسی و عربی در ورودی (R8)
    │   ├── errors.ts                     # کد خطا → پیام (R7)
    │   ├── searchParams.ts               # نشانی ↔ انتخاب جستجو (data-model)
    │   ├── bookingDraft.ts               # sessionStorage + Idempotency-Key (R13)
    │   ├── bookingView.ts                # canPay، canCancel، canReview، گروه‌بندی
    │   ├── mapStyle.ts                   # سبک raster درون‌خطی OSM (R22)
    │   ├── returnTo.ts                   # فقط مسیر داخلی
    │   └── avatar.ts                     # حرف اول و رنگ پیش‌فرض، بررسی اندازه و امضای فایل (R20)
    ├── components/
    │   ├── ui/                           # shadcn/ui
    │   ├── search/ (SearchForm، CityCombobox، GuestPicker، FiltersPanel، ResultCard، ResultsMap)
    │   ├── listing/ (Gallery، AmenityList، Reviews، BookingBox)
    │   ├── date/ (DateRangePicker با تقویم شمسی و میلادی)
    │   ├── booking/ (HoldCountdown، PriceBreakdown، CancelDialog)
    │   ├── account/ (UserAvatar، AvatarUploader با پیش‌نمایش، حذف عکس)
    │   └── layout/ (Header، LocaleSwitch، Footer)
    ├── i18n/ (routing.ts، request.ts)
    └── proxy.ts                          # (middleware در Next.js 16) مسیر زبان (next-intl) + CSP با nonce (R21)
    tests/ (یا کنار هر فایل: *.test.ts(x))
        ├── lib/*.test.ts                 # قاعده‌ها، از جمله SC-008 (۱۴۰۰ تا ۱۴۱۰)
        ├── messages.test.ts              # هم‌کلیدی fa و en، کدهای خطای بکند (SC-007)، ۳۱ امکان
        ├── session/*.test.ts             # route handlerها: کوکی، Origin، 401
        └── components/*.test.tsx         # هر سناریوی پذیرش، axe (SC-004)، fa و en

backend/src/caravansara/
├── core/config.py                        # max_avatar_bytes (۵٬۲۴۲٬۸۸۰)
├── core/storage.py                       # presigned_upload(max_bytes)، size()، read_head()، key_from_url()
└── identity/{router,service,schemas}.py  # POST /me/avatar/upload-url، PUT و DELETE /me/avatar (contracts/api.md)
backend/tests/test_avatar.py              # روی MinIO واقعی: سقف، امضا، کلید، جایگزینی، حذف، PATCH /me با نشانی بیرونی
backend/tests/test_identity.py            # تست PATCH /me به نشانی storage تغییر می‌کند (FR-041)
e2e/tests/auth.spec.ts                    # همان: دیگر https://example.com/avatar.png نمی‌فرستد
backend/openapi.json                      # export-openapi (۳۶ ← ۳۹)
docker-compose.yml                        # سرویس web، شبکه‌ی app، FORWARDED_ALLOW_IPS روی api (R5، R19)
.github/workflows/ci.yml                  # job frontend؛ image سایت در job image (R15)
e2e/tests/web.spec.ts                     # proxy از راه سایت، IP جدا برای محدودیت تلاش (R19)
docs/backend-design.md, docs/future-work.md, README.md, CONTEXT.md   # پس از پایان (Workflow)
```

**Structure Decision**: web application، با دو پوشه‌ی جدا:
- `frontend/` جدا از `backend/` است، با ابزار و lockfile خودش، چون اکوسیستم Node و Python ابزار مشترکی ندارند.
- هر دو در یک repo هستند، تا تغییر API و صفحه‌ی مربوط در یک pull request بررسی شوند (future-work بخش ۱).
- قاعده‌ها در `src/lib` هستند و از کامپوننت‌ها جدا، تا بدون رندر و با پوشش بالا آزموده شوند (R16).

## Complexity Tracking

خالی است: هیچ اصلی نقض نمی‌شود. سه انتخاب که ممکن است اضافه به نظر برسند، دلیل دارند:

| انتخاب | چرا لازم است | گزینه‌ی ساده‌تری که کنار رفت |
|---|---|---|
| route handlerهای `/session/*` (لایه‌ی کوچک سمت سرور) | تنها راه نگه داشتن refresh token در کوکی HttpOnly بدون تغییر API (R3) | `localStorage`: با XSS دزدیده می‌شود، و spec آن را منع کرده است |
| قفل `navigator.locks` برای تازه کردن | بدون آن، دو زبانه همه‌ی نشست‌های کاربر را باطل می‌کنند (R4) | پنجره‌ی مهلت در بکند: اصل V را ضعیف می‌کند و تغییر API است |
| بررسی محتوای آواتار در سرور (`head_object` و ۸ بایت اول) | policy آپلود فقط نوع اعلام‌شده را می‌بیند، و spec محتوای واقعی را می‌خواهد (FR-038، SC-010) | تکیه بر `Content-Type`: هر فایلی با نام `.png` پذیرفته می‌شد |
| شبکه‌ی compose با نشانی ثابت برای `web` | تنها راه اعتماد به `X-Forwarded-For` فقط از سایت (R19) | اعتماد به `*`: پورت ۸۰۰۰ باز است و IP جعل‌شدنی است |

## Assumptions and limits found in research

- **«نظر دارد»:** `BookingOut` نمی‌گوید رزرو نظر دارد یا نه. پس گزینه‌ی ثبت نظر برای رزروی که نظر دارد تا اولین تلاش دیده می‌شود، و پاسخ `already_reviewed` آن را پنهان می‌کند (data-model). افزودن این فیلد تغییر API است، و پیشنهادش در future-work ثبت می‌شود.
- **پیش‌فرض نشانی بدون زبان:** همیشه به `/fa` می‌رود و زبان مرورگر را نگاه نمی‌کند، چون spec فارسی را پیش‌فرض گفته است.
- **فایل‌های رهاشده‌ی آواتار:** فایلی که آپلود شده ولی با `PUT` ثبت نشده، در storage می‌ماند. قاعده‌ی lifecycle آن در future-work است (R20).
- **ترجمه‌ی شهرها:** با فایل ترجمه انجام می‌شود. شهر تازه‌ای که به سیستم اضافه شود تا ترجمه شدن با نام انگلیسی دیده می‌شود (R11).
