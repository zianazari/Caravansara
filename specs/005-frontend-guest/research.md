# Research: فرانت‌اند وب، بخش ۱: پایه و جریان مهمان

هر بند این سند می‌گوید چه تصمیم گرفته شد، چرا، چه گزینه‌هایی کنار رفت، و هر فرض چطور سنجیده شد (constitution، Development Workflow). سنجش‌ها در 2026-11-08 انجام شدند.

## R1. API موجود همه‌ی جریان‌ها را پوشش می‌دهد، جز آپلود آواتار

- **Decision:** همه‌ی جریان‌ها با API امروز ساخته می‌شوند، جز آپلود آواتار (FR-038 تا FR-040). آواتار سه endpoint تازه، دو کد خطای تازه و یک تنظیم تازه در ماژول `identity` لازم دارد (R20). این تغییر فقط افزودنی است: هیچ مسیر، فیلد یا کد خطای موجودی حذف یا عوض نمی‌شود، و `openapi.json` با `export-openapi` به‌روز می‌شود (اصل III).
- **Rationale:** هر داستان spec، جز آواتار، با endpointهای امروز شدنی است:
  - **حساب:** `register`، `login`، `refresh`، `logout`، و `GET`/`PATCH /me`.
  - **کاتالوگ:** `cities?q=`، `countries` و `amenities`.
  - **جستجو:** `search/listings` و `search/filters`، با پارامترهای `city_id`، `lat`، `lng`، `radius_km`، `check_in`، `check_out`، `adults`، `children`، `infants`، `pets`، `amenity_ids`، `sort`، `limit` و `offset`.
  - **آگهی:** `listings/{id}`، و `listings/{id}/reviews`.
  - **رزرو:** `POST /bookings` با سرآیند `Idempotency-Key`، `pay`، `cancel`، `me/bookings` و `bookings/{id}`.
  - **نظر:** `POST /bookings/{id}/review`.

  برای آواتار، API امروز فقط `PATCH /me` با فیلد `avatar_url` دارد، که هر نشانی دلخواهی را می‌پذیرد. راه آپلود ندارد.
- **How checked:** همه‌ی مسیرها، پارامترها و schemaها را با یک اسکریپت Python از خود `backend/openapi.json` خواندم. چند واقعیت که طراحی به آن‌ها تکیه دارد:
  - `ListingOut.city` از نوع `CityOut` است و `timezone` دارد.
  - `BookingOut.listing` از نوع `BookingListing` است و `timezone` دارد.
  - `BookingOut.hold_expires_at` مهلت نگه‌داشت است.
  - `BookingOut.address` (از نوع `BookingAddress`) فقط پس از پرداخت پر است.
  - `SearchResult.pin` همان پین عمومی است، و `total_price` فقط با تاریخ‌ها می‌آید.
  - `FilterCounts` فیلدهای `total` و `amenities[].listings` را دارد.
  - صفحه‌بندی حداکثر `limit=100` دارد (`core/pagination.py`).
  - **آواتار امروز:** `ProfileUpdate.avatar_url` از نوع `AnyHttpUrl` است (`identity/schemas.py:67`). ستون `users.avatar_url` از نوع `TEXT` است (`identity/models.py:22`). در `caravansara_demo` هیچ کاربری عکس ندارد: کوئری `count(avatar_url) = 0` از ۲۰۴۳ کاربر.
- **Alternatives considered:**
  - **endpoint تازه برای کوکی نشست در API:** کنار رفت، چون R3 همین را بدون تغییر API می‌دهد.
  - **آپلود آواتار با همان `PATCH /me` و نشانی دلخواه:** سیستم نمی‌تواند اندازه و قالب فایلی را که روی سرور دیگری است بسنجد (FR-038).

## R2. پشته و نسخه‌ها

- **Decision:**
  - **فریم‌ورک و کامپوننت‌ها:** Next.js 16 (App Router، خروجی `standalone`) روی React 19، با TypeScript 5.9 در حالت `strict`، Tailwind CSS 4 و shadcn/ui (Radix).
  - **ترجمه و داده:** next-intl 4، TanStack Query 5، و `openapi-typescript` 7 همراه `openapi-fetch` برای کلاینت API.
  - **نقشه و تقویم:** MapLibre GL 5 برای نقشه، و `jalaali-js` 2 برای تبدیل تقویم.
  - **تست و کیفیت کد:** Vitest 4 با Testing Library و jsdom، `vitest-axe` برای دسترس‌پذیری، و ESLint و Prettier.
  - **Node:** نسخه‌ی 24 LTS در image و CI.
  - **نسخه‌ی دقیق:** هر بسته با نسخه‌ی دقیق (بدون `^`) در `package.json` می‌آید، با `package-lock.json`. نسخه‌ای انتخاب می‌شود که دست‌کم دو هفته از انتشارش گذشته باشد.
- **Rationale:**
  - این پشته همان است که constitution («Technology and Domain Constraints») و future-work بخش ۱ تعیین کرده‌اند.
  - **TypeScript 5.9 و نه 7:** lint پروژه به `typescript-eslint` تکیه دارد، و این بسته TypeScript 7 را نمی‌پذیرد (پایین‌تر، How checked).
  - **نسخه‌ی دقیق:** build و CI را تکرارپذیر می‌کند، مثل `uv.lock` در بکند.
  - **دو هفته از انتشار:** بسته‌ی تازه‌منتشرشده بیشتر در معرض حمله‌ی زنجیره‌ی تأمین است.
- **How checked:**
  - **TypeScript:** `npm view typescript-eslint@latest peerDependencies` (نسخه‌ی 8.72.1) مقدار `"typescript": ">=4.8.4 <6.1.0"` را داد. `eslint-config-next@16.4.5` به `typescript-eslint ^8.56.0` و `eslint-plugin-jsx-a11y ^6.10.0` وابسته است. پس TypeScript 7 lint را می‌شکند، و `jsx-a11y` نصب جدا نمی‌خواهد.
  - با `npm view`، در 2026-11-08: next 16.4.5 (منتشرشده در 2026-11-03، پس هنوز دو هفته نشده و هنگام اجرا نسخه‌ی 16.4.x مناسب انتخاب می‌شود)، next-intl 4.14.9، tailwindcss 4.3.5، maplibre-gl 5.x، openapi-typescript 7.13.0، vitest 4.x، react 19.3.1 و typescript 5.9.3.
  - **پیش‌نیازهای وابستگی:** `npm view next@16.4.5 engines peerDependencies` نشان داد Node ≥ 20.9 و React 19 لازم است. next-intl 4 هم Next 16 را می‌پذیرد.
  - **Node محلی:** v25.2.1 است، ولی image و CI روی 24 LTS ثابت می‌شوند.
- **Alternatives considered:**
  - **Vite به‌جای Next.js:** کنار رفت، چون رندر سمت سرور برای موتور جستجو (FR-022) و route handler برای کوکی (R3) را ندارد.
  - **date-fns-jalali:** کتابخانه‌ی کامل تاریخ است، در حالی که فقط تبدیل تقویم لازم است. `jalaali-js` کوچک است و فقط همین کار را می‌کند.

## R3. نشست: نشست بلندمدت در کوکی HttpOnly، نشست کوتاه‌مدت در حافظه

- **Decision:**
  - **مسیرهای نشست:** route handlerهای Next.js در `/session/*`، سمت سرور، `login`، `register`، `refresh` و `logout` را به API می‌فرستند.
  - **کوکی:** `refresh_token` در کوکی `cv_refresh` با `HttpOnly`، `Secure` (در production)، `SameSite=Strict`، `Path=/session` و عمر برابر `refresh_token_days` (۳۰ روز) گذاشته می‌شود.
  - **مرورگر:** فقط `access_token` و `expires_in` به مرورگر برمی‌گردد و در حافظه‌ی صفحه می‌ماند، نه در `localStorage` و نه در کوکی.
- **Rationale:**
  - **FR-012 و SC-006:** اسکریپت صفحه به کوکی `HttpOnly` دسترسی ندارد، پس XSS نشست بلندمدت را نمی‌دزدد.
  - **`SameSite=Strict` و `Path=/session`:** کوکی را فقط به مسیرهای نشست همین سایت می‌فرستند. پس هیچ درخواست دیگری آن را حمل نمی‌کند، و CSRF روی آن مسیرها شدنی نیست. یک بررسی `Origin` هم روی هر `POST /session/*` گذاشته می‌شود.
  - **access token در حافظه:** کوتاه‌عمر است (`access_token_minutes` = ۱۵)، پس اگر دزدیده شود زود بی‌اثر می‌شود.
- **How checked:**
  - `identity/schemas.py`: `TokensOut` هر دو توکن را در بدنه‌ی JSON می‌دهد، و `RefreshIn` توکن را در بدنه می‌گیرد. پس سرور Next.js می‌تواند آن را بگیرد و در کوکی بگذارد.
  - `core/config.py`: `access_token_minutes = 15` و `refresh_token_days = 30`.
- **Alternatives considered:**
  - **access token هم در کوکی، با proxy همه‌ی درخواست‌ها:** هر درخواست را دو بار از سرور می‌گذراند و CSRF روی همه‌ی مسیرها را مسئله می‌کند.
  - **`localStorage`:** XSS آن را می‌خواند، و spec آن را منع کرده است.

## R4. تازه کردن هم‌زمان در چند زبانه نباید همه‌ی نشست‌ها را باطل کند

- **Decision:**
  - تازه کردن نشست فقط در مرورگر و فقط با `navigator.locks.request("cv-refresh", ...)` انجام می‌شود. پس در هر لحظه فقط یک زبانه تازه می‌کند. زبانه‌های دیگر پس از گرفتن قفل، اگر token تازه‌ای در `BroadcastChannel("cv-session")` آمده باشد، همان را برمی‌دارند.
  - صفحه‌های نیازمند حساب سمت کاربر رندر می‌شوند، و رندر سمت سرور هرگز تازه نمی‌کند.
- **Rationale:** این مهم‌ترین خطر طراحی است. اگر دو زبانه هم‌زمان با یک refresh token درخواست بدهند، دومی توکن باطل‌شده را نشان می‌دهد. بکند این را دزدی می‌داند و همه‌ی نشست‌های کاربر را باطل می‌کند (اصل V). نتیجه این است که کاربر با باز کردن دو زبانه بیرون انداخته می‌شود. چون همه‌ی تازه کردن‌ها از یک مرورگر می‌آیند، قفل مرورگر کافی است و قفل سمت سرور لازم نیست.
- **How checked:** `identity/service.py:101-115` را خواندم: `if row.revoked_at is not None: await repo.revoke_all_tokens(...)`. پنجره‌ی مهلت یا توکن جایگزین هم وجود ندارد.
- **Alternatives considered:**
  - **پنجره‌ی مهلت چندثانیه‌ای در بکند:** امنیت اصل V را ضعیف می‌کند و تغییر API و constitution است.
  - **تازه کردن در رندر سمت سرور:** چند نسخه‌ی سرور را هم درگیر می‌کند و قفل مشترک لازم دارد. کنار رفت.

## R5. یک مبدأ: سایت `/api/*` را به API می‌فرستد

- **Decision:**
  - **مسیر API:** مرورگر فقط با سایت حرف می‌زند. `rewrites` در Next.js مسیر `/api/v1/*` را به `API_INTERNAL_URL` می‌فرستد (`http://api:8000` در compose). پس `CARAVANSARA_CORS_ORIGINS` خالی می‌ماند.
  - **عکس‌ها:** از `CARAVANSARA_MEDIA_BASE_URL` مستقیم بار می‌شوند، و فقط تصویر هستند.
  - **سرویس `web`:** در `docker-compose.yml` روی پورت ۳۰۰۱ است.
- **Rationale:**
  - **FR-032:** بدون CORS، پیکربندی کمتر است و هیچ مبدأ دیگری لازم نیست.
  - **فقط `/api/v1/*`:** چون فقط همین مسیر proxy می‌شود، `/metrics` و `/docs` از راه سایت در دسترس نیستند (اصل V).
  - **پورت ۳۰۰۱:** Grafana از قبل ۳۰۰۰ را گرفته است.
- **How checked:**
  - `docker-compose.yml`: سرویس `grafana` روی `3000:3000` و `api` روی `8000:8000` است.
  - `main.py:101`: CORS فقط وقتی `cors_origins` پر باشد اضافه می‌شود، و پیش‌فرض `[]` است.
  - `x-app` در compose: `CARAVANSARA_MEDIA_BASE_URL=http://localhost:9000/caravansara-media`.
- **Alternatives considered:** CORS با مبدأ سایت. تنظیم بیشتری در هر محیط لازم دارد، و preflight هر درخواست را کندتر می‌کند.

## R6. کلاینت تولیدشده و بررسی همگامی در CI

- **Decision:**
  - **تولید:** `openapi-typescript ../backend/openapi.json -o src/api/schema.d.ts` فایل نوع‌ها را می‌سازد، و این فایل commit می‌شود.
  - **کلاینت:** `openapi-fetch` با همین نوع‌ها، کلاینت را می‌سازد.
  - **بررسی در CI:** فایل را دوباره تولید می‌کند و با `git diff --exit-code` مقایسه می‌کند. پس از آن `tsc --noEmit` اجرا می‌شود.
- **Rationale:**
  - **FR-033:** هر تغییر قرارداد یا build را خراب می‌کند یا در diff دیده می‌شود.
  - **commit کردن فایل:** تغییر قرارداد را در بررسی PR آشکار می‌کند، مثل خود `openapi.json`.
- **How checked:** `backend/openapi.json` نسخه‌ی `3.1.0` دارد (فیلد `openapi` خود فایل). توضیح بسته در `npm view openapi-typescript@7.13.0 description readme` می‌گوید «OpenAPI 3.0 & 3.1» را پشتیبانی می‌کند.
- **Alternatives considered:** نوشتن نوع‌ها با دست. هر تغییر API را بی‌صدا رد می‌کند.

## R7. کدهای خطا و ترجمه

- **Decision:**
  - **فایل‌های ترجمه:** `messages/fa.json` و `messages/en.json` هر کدام یک بخش `errors` دارند، با یک کلید برای هر کد خطا، و کلید `unknown` برای هر کد ناشناخته.
  - **تست همگامی:** یک تست Vitest کدها را از کد بکند جمع می‌کند و با هر دو فایل ترجمه مقایسه می‌کند. کدها با الگوی ثابت سازنده‌های `AppError` در `backend/src/caravansara/**/*.py` پیدا می‌شوند.
- **Rationale:** SC-007 را ثابت می‌کند. کد تازه‌ای که در بکند بیاید و ترجمه نداشته باشد، CI فرانت‌اند را می‌شکند.
- **کدهای تازه:** `invalid_image`، `image_too_large` و `invalid_avatar_url` (R20) هم به فایل‌های ترجمه اضافه می‌شوند، و همین تست آن‌ها را می‌گیرد.
- **How checked:** `openapi.json` فهرست کدها را ندارد، فقط چند مثال دارد: جستجوی `"code":` فقط `dates_unavailable` را یافت. پس منبع واقعی کد بکند است.
  - کدها با grep روی سازنده‌های `Conflict`، `Forbidden`، `Unprocessable`، `Unauthorized`، `NotFound`، `AppError` و `TooMany` و روی `core/errors.py` جمع شدند: `already_reviewed`، `amount_too_large`، `bad_request`، `capacity_exceeded`، `dates_unavailable`، `email_taken`، `hold_expired`، `http_error`، `idempotency_key_reused`، `invalid_booking_state`، `invalid_credentials`، `invalid_dates`، `invalid_search_area`، `invalid_token`، `method_not_allowed`، `not_found`، `own_listing`، `review_window_closed`، `token_expired`، `too_many_attempts`، `unknown_amenity`، `unknown_city` و `validation_error`، به‌اضافه‌ی دو کد پیش‌فرض `core/errors.py`: `forbidden` و `unauthorized`.
  - کدهای میزبان و admin هم در این فهرست هستند: `invalid_photo_order`، `invalid_storage_key`، `upload_missing`، `not_listing_host`، `listing_*` و `unknown_amenity`. ترجمه‌ی آن‌ها از همین حالا نوشته می‌شود تا تست ساده بماند، و کار 006 از آن استفاده می‌کند.
- **Alternatives considered:** افزودن فهرست کدها به `openapi.json`. این تغییر قرارداد بکند است و جایش کار جداست. اگر بعداً انجام شود، تست به آن منبع منتقل می‌شود.

## R8. تقویم شمسی و قالب عدد

- **Decision:**
  - **نمایش:** تاریخ در فارسی با `Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext")` و در انگلیسی با `en-GB` نمایش داده می‌شود.
  - **تقویم انتخاب تاریخ:** شبکه‌ی ماه شمسی با `jalaali-js` ساخته می‌شود. تبدیل‌ها (`toJalaali` و `toGregorian`) در یک ماژول کوچک `lib/calendar.ts` هستند، و همیشه رشته‌ی `YYYY-MM-DD` میلادی به API فرستاده می‌شود.
  - **عدد:** `Intl.NumberFormat` با زبان صفحه قالب عدد را می‌سازد. ورودی عدد ارقام `۰-۹` و `٠-٩` را به لاتین برمی‌گرداند.
- **Rationale:**
  - **FR-004 و FR-005:** `Intl` در Node و همه‌ی مرورگرهای امروزی تقویم persian دارد، پس نمایش کتابخانه نمی‌خواهد. فقط ساختن شبکه‌ی ماه و تبدیل دقیق به کتابخانه نیاز دارد.
  - **SC-008:** تبدیل هر روز ۱۴۰۰ تا ۱۴۱۰ با رفت‌وبرگشت و با `Intl` مقایسه می‌شود.
- **How checked:** در خود image، با `docker run --rm node:24-slim node -e …`، در 2026-11-08: Node v24.22.2 با ICU 78.3.
  - **تقویم:** `Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-arabext")` برای 2026-03-21 خروجی «۱ فروردین ۱۴۰۵» داد.
  - **نام کشور:** `Intl.DisplayNames(["fa"], {type: "region"}).of("SE")` خروجی «سوئد» داد.
  - **حرف اول:** `Intl.Segmenter("fa")` حرف اول «آرش» را «آ» داد.
  - **مبلغ:** `Intl.NumberFormat("fa", {style: "currency", currency: "EUR"})` خروجی «‎€۱۲۰٫۰۰» داد.
  - **منطقه‌ی زمانی:** `timeZone: "America/New_York"` با نام منطقه کار کرد.
- **Alternatives considered:** نوشتن الگوریتم تبدیل با دست. خطر خطا در سال کبیسه دارد، در حالی که `jalaali-js` آزموده‌شده و کوچک است.

## R9. منطقه‌ی زمانی شهر آگهی

- **Decision:** ماژول `lib/cityTime.ts` همه‌ی محاسبه‌های زمانی را با `Intl.DateTimeFormat({ timeZone })` و timezone شهر انجام می‌دهد. این ماژول سه چیز می‌سازد:
  - «امروزِ شهر»: کمینه‌ی تاریخ ورود.
  - «آخرین لحظه‌ی لغو»: آغاز روز ورود به وقت شهر، منهای یک لحظه.
  - نمایش ساعت ورود و خروج با نام منطقه.
- **Rationale:**
  - **FR-006 و قاعده‌ی constitution:** این قاعده به وقت شهر حساب می‌شود، نه به وقت سرور یا مرورگر.
  - **لغو تا پیش از روز ورود:** بکند لغو را فقط پیش از روز `check_in` به وقت شهر می‌پذیرد (قواعد کسب‌وکار، `docs/backend-design.md`)، پس صفحه همان مرز را نشان می‌دهد.
- **How checked:**
  - `CityOut.timezone` و `BookingListing.timezone` در قرارداد هستند (R1).
  - شهرهای دمو منطقه‌های گوناگون دارند: `Asia/Tehran`، `Europe/*` و `America/New_York`. این را با کوئری روی `caravansara_demo` دیدم.
- **Alternatives considered:** کتابخانه‌ی `@date-fns/tz`. سه تابع ساده با `Intl` و تست کافی است (اصل VII).

## R10. مبلغ و ارز

- **Decision:**
  - **ریال:** مبلغ `IRR` بر ۱۰ تقسیم می‌شود، گرد نمی‌شود، با برچسب «تومان» در فارسی و «Toman» در انگلیسی، و بدون اعشار (تصمیم مالک پروژه، 2026-11-08).
  - **ارزهای دیگر:** با `Intl.NumberFormat(locale, { style: "currency", currency })` نمایش داده می‌شوند.
  - **محاسبه:** مبلغ از API رشته‌ی decimal است. تقسیم بر ۱۰ روی رشته (با BigInt) انجام می‌شود، نه با `number`، تا رقمی از دست نرود.
- **Rationale:**
  - **FR-007.** ستون‌ها `NUMERIC(14,2)` هستند، و بزرگ‌ترین مبلغ ۳۶۶ میلیارد است که در `number` جا می‌شود. با این حال رشته‌ی decimal را با `number` حساب نمی‌کنیم، چون اعشار دودویی خطای گرد کردن می‌دهد.
  - **ارزهای مختلف در یک صفحه:** هر کارت ارز خودش را دارد (Edge Cases).
- **How checked:**
  - **ارزهای دمو:** `caravansara_demo` شش ارز دارد: EUR ۲۵۰، USD/GBP/SEK/DKK هر کدام ۱۲۵، و IRR ۴۰ (کوئری روی `listings`).
  - **نوع داده‌ی مبلغ:** در `openapi.json` مبلغ‌ها (مثلاً `SearchResult.total_price`) از نوع `string` هستند، چون Pydantic `Decimal` را در JSON رشته می‌دهد.
- **Alternatives considered:** نمایش ریال، که مالک پروژه رد کرد.

## R11. نام شهر، کشور و امکانات در فارسی

- **Decision:**
  - **کاتالوگ‌های ثابت سایت:** ترجمه می‌شوند.
    - **امکانات:** ۳۱ امکان، با نام و دسته در فایل ترجمه، کلیدخورده با نام انگلیسی.
    - **نوع اقامتگاه.**
    - **کشورها:** با `Intl.DisplayNames(locale, { type: "region" })`.
    - **شهرها:** نقشه‌ی ترجمه‌ی شهرهای موجود. اگر شهری ترجمه نداشته باشد، نام API نشان داده می‌شود.
  - **محتوای میزبان:** عنوان، توضیح و محله همان‌طور که نوشته شده نمایش داده می‌شوند.
- **Rationale:**
  - **FR-002:** API نام‌ها را انگلیسی می‌دهد، ولی کاربر فارسی نباید متن انگلیسی سیستم ببیند.
  - **محتوای کاربر:** متن میزبان «متن سیستم» نیست و ترجمه نمی‌شود. آگهی‌های فارسی دمو (`db/demo/fa_listings.json`) هم فارسی‌اند.
- **How checked:**
  - کوئری روی `caravansara_demo`: نام شهرها انگلیسی‌اند (`Tehran`، `Shiraz`، `Isfahan`، `Stockholm`، ...)، و ۳۱ امکان با نام انگلیسی هستند (`Hot water`، `Shampoo`، ...).
  - تستی همه‌ی امکانات `GET /amenities` دمو را با فایل ترجمه مقایسه می‌کند.
- **Alternatives considered:** افزودن ستون نام فارسی به پایگاه داده. این تغییر schema و API است و جایش کار جداست. ترجمه‌ی سمت سایت برای کاتالوگ ثابت کافی است.

## R12. شمارش معکوس نگه‌داشت

- **Decision:**
  - **مهلت:** مهلت از `hold_expires_at` می‌آید.
  - **اختلاف ساعت:** اختلاف ساعت دستگاه با سرور از سرآیند `Date` همان پاسخ API حساب می‌شود.
  - **نمایش:** شمارش هر ثانیه به‌روز می‌شود، ولی صفحه‌خوان فقط در دقیقه‌های ۵ و ۱ و در صفر باخبر می‌شود (`aria-live="polite"`).
  - **پایان مهلت:** در صفر دکمه‌ی پرداخت غیرفعال می‌شود. پاسخ `hold_expired` همچنان مرجع نهایی است.
- **Rationale:**
  - **FR-026:** ساعت دستگاه ممکن است چند دقیقه جلو یا عقب باشد.
  - **FR-009:** اعلام هر ثانیه برای صفحه‌خوان مزاحم است.
- **How checked:** uvicorn سرآیند `Date` را در هر پاسخ می‌فرستد، و این از پاسخ‌های e2e فعلی دیده می‌شود. هنگام اجرا با یک تست کامپوننت سنجیده می‌شود.
- **Alternatives considered:** افزودن فیلد زمان سرور به پاسخ. این تغییر API است و سرآیند `Date` کافی است.

## R13. Idempotency-Key و پیش‌نویس رزرو

- **Decision:**
  - **کلید:** با `crypto.randomUUID()` ساخته می‌شود، همراه پیش‌نویس رزرو در `sessionStorage` (آگهی، تاریخ‌ها و مهمان‌ها). این کلید در فرستادن دوباره‌ی همان پیش‌نویس ثابت می‌ماند، و با هر تغییر پیش‌نویس عوض می‌شود.
  - **برگشت از ورود:** پس از ورود، پیش‌نویس از همان‌جا بازیابی می‌شود.
- **Rationale:**
  - **FR-025 و FR-014.**
  - **چرا `sessionStorage` و نه `localStorage`:** `sessionStorage` فقط در همان زبانه است، و با بستن آن پاک می‌شود. پیش‌نویس هم راز نیست، پس FR-012 را نقض نمی‌کند.
- **How checked:** پارامتر `Idempotency-Key` در `POST /bookings` در قرارداد هست. بکند کلید تکراری با محتوای دیگر را با `422 idempotency_key_reused` رد می‌کند (`docs/backend-design.md`، قرارداد خطا).

## R14. رندر و موتور جستجو

- **Decision:** صفحه‌ها به دو دسته تقسیم می‌شوند:
  - **صفحه‌های جستجو و آگهی:** Server Componentها، که داده را سمت سرور و بدون توکن از API می‌گیرند (FR-022). `generateMetadata` عنوان و توضیح هر آگهی را می‌سازد.
  - **صفحه‌های حساب، رزرو، سفرها و نظر:** Client Componentها با TanStack Query، چون توکن فقط در مرورگر است (R3 و R4).
  - **نقشه:** فقط سمت کاربر و با `dynamic(..., { ssr: false })` بار می‌شود. اگر بار نشود، فهرست بدون نقشه کار می‌کند (Edge Cases).
- **Rationale:** سرعت اولین نمایش و دیده شدن در موتور جستجو (SC-003)، بدون اینکه توکنی به سرور Next.js برسد.
- **How checked:** endpointهای جستجو، آگهی و نظرها برای آگهی عمومی بدون توکن کار می‌کنند.
  - **جستجو:** در `openapi.json` هیچ `security` ندارد.
  - **آگهی و نظرها:** `HTTPBearer` دارند، ولی توکن برای آن‌ها اختیاری است (کار 004). `curl` بدون توکن روی stack محلی برای `GET /listings/1` و `GET /listings/1/reviews` پاسخ 200 داد.
  - پاسخ API سرآیند `date` را دارد (R12).

## R15. CI و Docker

- **Decision:**
  - **CI:** یک job تازه به نام `frontend` در `.github/workflows/ci.yml`، روی Node 24 با `npm ci`، این مراحل را اجرا می‌کند:
    1. تولید دوباره‌ی کلاینت و `git diff --exit-code`
    2. `eslint`
    3. `prettier --check`
    4. `tsc --noEmit`
    5. `vitest run --coverage`
    6. `next build`
  - **image:** `frontend/Dockerfile` چندمرحله‌ای است و خروجی `standalone` را با کاربر غیر root روی Node 24 slim اجرا می‌کند.
  - **job `image`:** image سایت را هم build می‌کند.
- **Rationale:**
  - **FR-034 و FR-032.**
  - **کاربر غیر root:** همان روش image بکند است.
- **How checked:** `ci.yml` امروز سه job دارد (`checks`، `image` و `observability`) و هیچ مرحله‌ی Node ندارد. e2e در CI اجرا نمی‌شود، و این از خواندن فایل دیده شد.
- **Alternatives considered:** CI جدا برای سایت. کنار رفت، چون یک pull request باید هر دو را سبز ببیند.

## R16. دروازه‌ی پوشش تست برای فرانت‌اند

- **Decision:**
  - **کد منطقی:** آستانه‌ی پوشش Vitest برای `src/lib/**` و `src/api/**` ۹۰٪ است. این بخش‌ها قاعده‌ها را دارند: تقویم، زمان شهر، مبلغ، خطا، نشست و پیش‌نویس.
  - **کامپوننت‌ها:** پوشش آن‌ها گزارش می‌شود اما دروازه نیست، و هر سناریوی پذیرش یک تست کامپوننت دارد.
- **Rationale:**
  - **پوشش ۹۰٪:** اصل IV پوشش ۹۰٪ را برای بکند گفته است، و دروازه‌ی فرانت‌اند را تعیین نکرده است. پس هم‌ارز آن را روی کدی می‌گذاریم که قاعده دارد.
  - **کامپوننت‌ها:** درصد پوشش UI، بدون تست مرورگر (Playwright، کار بعدی)، معیار خوبی از درستی نیست.
- **How checked:** متن اصل IV در `.specify/memory/constitution.md`: «Coverage MUST stay at or above 90%» در بند ابزارهای بکند آمده است.

## R17. دسترس‌پذیری و سرعت

- **Decision:**
  - **دسترس‌پذیری:** هر تست کامپوننت صفحه `axe` را با `vitest-axe` اجرا می‌کند، و هر یافته‌ی سطح A یا AA تست را می‌شکند (SC-004).
  - **SC-003:** با Lighthouse در حالت موبایل روی stack و داده‌ی حجیم، دستی و طبق quickstart، اندازه گرفته و در `docs/backend-design.md` ثبت می‌شود. اصل IV سنجش زمان روی سخت‌افزار را دستی مجاز می‌داند.
- **Rationale:** کنتراست و جهت فقط در مرورگر واقعی کامل سنجیده می‌شوند، و تست مرورگر کار بعدی است. `axe` در jsdom بیشتر خطاهای ساختاری را می‌گیرد: برچسب فیلد، نقش‌ها و ترتیب سرتیترها.

## R18. سنجش صفحه در مانیتورینگ

- **Decision:** ارسال خطاهای مرورگر و Core Web Vitals به Grafana، که در future-work بخش ۱ آمده، در این کار نیست و در future-work باقی می‌ماند.
- **Rationale:** این کار یک endpoint دریافت در API لازم دارد، و آن تغییر قرارداد است (اصل III). با R1، که می‌گوید API عوض نمی‌شود، نمی‌خواند. اصل VI برای endpoint یا job تازه‌ی بکند است، و این کار هیچ‌کدام را نمی‌سازد.
- **How checked:** هیچ endpoint دریافت متریک از مرورگر در `openapi.json` نیست.

## R19. IP واقعی کاربر پشت سایت، برای محدودیت تلاش

- **Decision:**
  - **شبکه‌ی compose:** یک شبکه‌ی `app` با subnet ثابت در `docker-compose.yml` تعریف می‌شود، و سرویس `web` نشانی ثابت `ipv4_address` روی آن می‌گیرد.
  - **اعتماد به سایت:** سرویس `api` متغیر `FORWARDED_ALLOW_IPS` را برابر همان یک نشانی می‌گیرد. پس uvicorn فقط از سایت `X-Forwarded-For` را می‌پذیرد.
  - **مسیرهای نشست:** route handlerهای `/session/*` سرآیند `X-Forwarded-For` را با IP کاربر می‌فرستند.
  - **proxy `/api/v1`:** همین را از Next.js می‌گیرد.
- **Rationale:** محدودیت تلاش (اصل V) با `request.client.host` می‌شمارد. پشت سایت، این نشانی برای همه‌ی کاربران IP خود سایت است. با سقف امروز، کل سایت فقط ۱۰ ثبت‌نام در ساعت و ۳۰ ورود در پنجره می‌پذیرفت. اعتماد به `*` هم درست نیست: پورت ۸۰۰۰ در توسعه باز است، و هر کس می‌توانست IP جعلی بفرستد و محدودیت را دور بزند.
- **How checked:**
  - `core/deps.py:19`: `request.client.host`.
  - `core/config.py`: `register_max_per_ip = 10`، `login_max_per_ip = 30`، `login_max_failures = 5`.
  - `cli.py` در `serve`، `uvicorn.run(...)` را بدون `forwarded_allow_ips` صدا می‌زند.
  - uvicorn 0.54.0: `forwarded_allow_ips=None`، که به متغیر `FORWARDED_ALLOW_IPS` و در نبود آن به `127.0.0.1` برمی‌گردد. `ProxyHeadersMiddleware` فقط از میزبان مورد اعتماد سرآیند را می‌خواند، و راست‌ترین نشانی نامطمئن را برمی‌دارد.
  - **مستقل از رفتار proxy خود Next.js:** proxy `/api/v1` مسیرهای `/api/v1/auth/*` را عبور نمی‌دهد (404). پس ورود و ثبت‌نام، که محدودیت تلاش دارند، فقط از route handlerهای `/session/*` می‌گذرند، و آن‌ها `X-Forwarded-For` را خودشان می‌گذارند. اینکه `rewrites` خودش این سرآیند را اضافه می‌کند یا نه، دیگر برای محدودیت تلاش مهم نیست. تست e2e (T072) هر دو را می‌سنجد: دو ورود ناموفق از دو IP پشت سایت جدا شمرده شوند، و `/api/v1/auth/login` از سایت 404 بدهد.
- **Alternatives considered:**
  - **تنظیم تازه‌ی `CARAVANSARA_*` در بکند:** متغیر خود uvicorn همین کار را بدون کد می‌کند (اصل VII).
  - **محدودیت تلاش در خود سایت:** شمارش دوم و جدا می‌سازد، و پایگاه داده دیگر همه‌ی تلاش‌ها را نمی‌بیند.

## R20. آپلود آواتار: همان روش عکس آگهی، با سقف ۵ مگابایت و بررسی محتوا

- **Decision:** سه endpoint تازه در ماژول `identity` (جزئیات در [contracts/api.md](contracts/api.md)):
  1. **`POST /me/avatar/upload-url`:**
     - بدنه: `{ "content_type": "image/png" | "image/jpeg" }`.
     - پاسخ: یک presigned POST برای کلید `avatars/{user_id}/{uuid}.{png|jpg}`.
     - policy آن قالب را ثابت می‌کند و اندازه را به `1..max_avatar_bytes` محدود می‌کند.
  2. **`PUT /me/avatar`:**
     - بدنه: `{ "storage_key": … }`.
     - بررسی‌ها، به ترتیب:
       - کلید با `avatars/{user_id}/` شروع شود (`invalid_storage_key`).
       - فایل وجود داشته باشد (`upload_missing`).
       - اندازه‌ی واقعی آن (`head_object`) از سقف بیشتر نباشد (`image_too_large`).
       - ۸ بایت اول آن امضای PNG (`89 50 4E 47 0D 0A 1A 0A`) یا JPEG (`FF D8 FF`) باشد (`invalid_image`).
     - فایل ردشده از storage پاک می‌شود.
     - پس از موفقیت، `avatar_url` به نشانی عمومی فایل تازه تغییر می‌کند. فایل قبلی کاربر، اگر زیر `avatars/{user_id}/` باشد، پس از commit پاک می‌شود.
     - پاسخ: `UserOut`.
  3. **`DELETE /me/avatar`:** `avatar_url` را `null` می‌کند و فایل را پاک می‌کند. پاسخ: `UserOut`.

  تنظیم تازه‌ی `CARAVANSARA_MAX_AVATAR_BYTES` با پیش‌فرض ۵٬۲۴۲٬۸۸۰ بایت است. `Storage.presigned_upload` سقف را به‌صورت پارامتر می‌گیرد، و عکس آگهی همان ۱۰ مگابایت را نگه می‌دارد. دو تابع کوچک هم به `Storage` اضافه می‌شود: اندازه‌ی فایل (`size`) و چند بایت اول آن (`read_head`).

  **آواتار پیش‌فرض** در سایت ساخته می‌شود و ذخیره نمی‌شود: حرف اول نام (با `Intl.Segmenter`، که حرف فارسی را درست جدا می‌کند) روی یکی از ۸ رنگ. رنگ از `user.id % 8` انتخاب می‌شود، و هر رنگ با متن سفید کنتراست AA دارد.
- **Rationale:**
  - **همان روش عکس آگهی:** presigned POST فایل را از API عبور نمی‌دهد (constitution، Technology Constraints) و تست‌هایش از قبل هست.
  - **بررسی دوباره بعد از آپلود:** policy اندازه را در MinIO می‌بندد، اما قالب را فقط از سرآیند اعلام‌شده می‌داند. پس سرور اندازه و محتوای واقعی فایل را دوباره می‌سنجد (FR-038، SC-010).
  - **پاک کردن فایل قبلی پس از commit:** اگر commit شکست بخورد، کاربر به عکسی که دیگر نیست اشاره نمی‌کند (FR-039).
  - **آواتار پیش‌فرض بدون فایل:** نه storage می‌خواهد، نه migration، و برای ۲۰۴۳ کاربر دمو فوراً کار می‌کند.
- **How checked:**
  - **روش عکس آگهی:** `core/storage.py:44-55`: `presigned_upload` با `content-length-range` و `max_photo_bytes` (۱۰ MB). `listings/service.py:341-346`: پیشوند کلید، `invalid_storage_key` و `upload_missing`. `ImageType` (`listings/schemas.py:209`) WebP را هم می‌پذیرد. پس آواتار نوع جدای خودش را می‌گیرد: `AvatarType`، فقط PNG و JPEG.
  - **کد خطای تازه:** `invalid_image` و `image_too_large` امروز در بکند نیستند (فهرست R7).
  - **CORS در MinIO:** مرورگر مستقیم به MinIO می‌فرستد. درخواست `OPTIONS` به `http://localhost:9000/caravansara-media` با `Origin: http://localhost:3001` پاسخ `204` و `Access-Control-Allow-Origin: http://localhost:3001` گرفت. پس MinIO در توسعه آپلود از سایت را می‌پذیرد. production این را در CDN یا storage خودش تنظیم می‌کند، که در `docs/backend-design.md` ثبت می‌شود.
- **`PATCH /me` (تصمیم مالک پروژه، 2026-11-08، FR-041):** فقط `null` یا نشانی زیر `{media_base_url}/avatars/{user_id}/` را می‌پذیرد، و با همان تابع service از همان بررسی‌های `PUT` می‌گذرد. هر نشانی دیگر `422 invalid_avatar_url` می‌گیرد.
  - **دلیل:** نشانی بیرونی دو مشکل دارد. اول، هر بیننده‌ی نظرها یا صفحه‌ی آگهی، IP و زمان بازدیدش را به آن سرور می‌دهد (اصل V). دوم، قاعده‌ی اندازه و قالب FR-038 را دور می‌زند.
  - **How checked:** فقط دو تست نشانی بیرونی می‌فرستند: `backend/tests/test_identity.py:108` و `e2e/tests/auth.spec.ts:91`. کوئری روی هر سه پایگاه داده: `caravansara` ۱۱ ردیف دارد که همه `https://example.com/avatar.png` از e2e‌اند. `caravansara_demo` (۲۰۴۳ کاربر) و `caravansara_bulk` (۳۵۹٬۸۴۹ کاربر) صفر دارند. پس هیچ داده‌ی واقعی شکسته نمی‌شود، و migration لازم نیست.
  - **لایه‌ی دوم:** سایت فقط `avatar_url`ای را نشان می‌دهد که با `NEXT_PUBLIC_MEDIA_BASE_URL` شروع شود. هر نشانی قدیمی دیگر آواتار پیش‌فرض می‌گیرد، پس داده‌ی کهنه هم هیچ درخواستی به سرور بیرونی نمی‌سازد. CSP (`img-src`) هم همین را در مرورگر می‌بندد.
- **Alternatives considered:**
  - **حذف کامل `avatar_url` از `PATCH /me`:** شکننده‌تر است، و کاری اضافه بر `PUT`/`DELETE` نمی‌کند. مالک پروژه محدود کردن را برگزید.
  - **migration برای پاک کردن نشانی‌های بیرونی:** migration تنظیم `media_base_url` را نمی‌داند، داده‌ی واقعی‌ای هم برای پاک کردن نیست، و سایت نشانی‌های بیرونی را از قبل نادیده می‌گیرد.
  - **آپلود از راه API (multipart به FastAPI):** فایل از API می‌گذرد، که constitution آن را برای عکس‌ها منع کرده است.
  - **کوچک کردن خودکار عکس بزرگ در مرورگر:** spec گفته فایل بزرگ رد شود و بی‌صدا کوچک یا بریده نشود (Edge Cases).
  - **ذخیره‌ی کلید در ستون جدا:** کلید از `avatar_url` با حذف `media_base_url` به دست می‌آید، پس migration لازم نیست (اصل VII).
- **محدودیت‌های پذیرفته‌شده:**
  - **فایل رهاشده:** فایلی که آپلود شده ولی هرگز با `PUT` ثبت نشده، در storage می‌ماند. قاعده‌ی lifecycle برای پاک کردن فایل‌های رهاشده‌ی `avatars/` به future-work می‌رود.

## R21. سیاست امنیت محتوا (CSP) با nonce

- **Decision:**
  - **proxy:** `src/proxy.ts` (نام تازه‌ی `middleware.ts` در Next.js 16) برای هر درخواست صفحه یک nonce تصادفی می‌سازد (`crypto.randomUUID()` به base64)، و پس از middleware زبان (next-intl)، سرآیند CSP را روی پاسخ می‌گذارد. nonce در سرآیند درخواست `x-nonce` به Next.js می‌رسد، تا اسکریپت‌های خودش را با آن علامت بزند.
  - **بندهای CSP:**
    - `default-src 'self'`
    - `script-src 'self' 'nonce-…' 'strict-dynamic'`، و در توسعه `'unsafe-eval'` هم.
    - `style-src 'self' 'unsafe-inline'`
    - `img-src 'self' data: blob:`، مبدأ media و مبدأ کاشی نقشه.
    - `connect-src 'self'`، مبدأ media (آپلود آواتار) و مبدأ کاشی نقشه.
    - `worker-src blob:` (MapLibre)
    - `font-src 'self'`
    - `frame-ancestors 'none'`
    - `base-uri 'self'`
    - `form-action 'self'`
- **Rationale:**
  - Next.js اسکریپت‌های inline برای hydration دارد، پس `script-src 'self'` تنها سایت را از کار می‌اندازد. nonce تنها راه بستن اسکریپت تزریقی بدون `'unsafe-inline'` است.
  - `'unsafe-inline'` برای style پذیرفته می‌شود، چون MapLibre و Radix سبک inline روی عنصرها می‌گذارند. خطر style تزریقی بسیار کمتر از اسکریپت است.
  - nonce رندر ایستا را می‌بندد. این مشکلی نیست، چون صفحه‌های جستجو و آگهی هر بار داده‌ی تازه می‌خواهند (`no-store`، R14).
- **How checked:** راهنمای رسمی Next.js، nextjs.org/docs/app/guides/content-security-policy (به‌روزشده در 2026-03-20)، در 2026-11-08 خوانده شد:
  - **فایل:** فایل `proxy.ts` است و تابع `proxy(request)` را export می‌کند.
  - **انتقال nonce:** nonce در `x-nonce` و CSP در سرآیند درخواست و پاسخ گذاشته می‌شود.
  - **اعمال خودکار:** Next.js «nonce را از CSP استخراج می‌کند» و روی اسکریپت‌های framework، bundleها و inlineهای خودش می‌گذارد.
  - **رندر پویا:** «you must use dynamic rendering to add nonces». روش پیشنهادی `await connection()` است.
  - **`'unsafe-eval'`:** فقط در توسعه.
  - **matcher:** `api`، `_next/static`، `_next/image`، `favicon.ico` و prefetch را کنار می‌گذارد.

  هنگام اجرا هم هر صفحه در Chrome بدون خطای CSP در کنسول باز شود، و تست e2e سرآیند `Content-Security-Policy` را در پاسخ `/fa` بسنجد (T072).
- **Alternatives considered:**
  - **`'unsafe-inline'` برای script:** CSP را در برابر XSS بی‌اثر می‌کند، در حالی که هدف FR-012 همین است.
  - **بدون CSP:** لایه‌ی دوم FR-041 (بستن تصویر بیرونی) و محافظت توکن در حافظه را از دست می‌دهد.

## R22. نقشه: سبک raster از کاشی‌های OpenStreetMap

- **Decision:**
  - **سبک:** `src/lib/mapStyle.ts` یک سبک MapLibre درون‌خطی می‌سازد، با یک منبع raster از `NEXT_PUBLIC_MAP_TILE_URL` (پیش‌فرض: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`)، `tileSize: 256`، `maxzoom: 19`، و ذکر منبع «© OpenStreetMap contributors» با پیوند به `https://www.openstreetmap.org/copyright`، آشکار در گوشه‌ی نقشه.
  - **متغیر:** متغیر `NEXT_PUBLIC_MAP_STYLE_URL` در contracts جایش را به همین متغیر می‌دهد.
- **Rationale:**
  - OpenStreetMap سبک برداری (style.json) منتشر نمی‌کند، و فقط کاشی raster دارد. پس «سبک کاشی OSM» یعنی همین سبک درون‌خطی.
  - کاشی raster کلید پولی نمی‌خواهد، و برای توسعه و نمایش کافی است (FR-018 فقط پین تقریبی نشان می‌دهد).
  - سیاست مصرف کاشی‌های OSM ذکر منبع و مصرف کم را می‌خواهد. پس در production باید ارائه‌دهنده‌ی کاشی جدا گذاشت، که با همین یک متغیر شدنی است و در future-work ثبت می‌شود.
- **How checked:** سیاست مصرف کاشی OSM (operations.osmfoundation.org/policies/tiles)، خوانده‌شده در 2026-11-08:
  - **نشانی:** «Use exactly: https://tile.openstreetmap.org/{z}/{x}/{y}.png». نسخه‌ی http ممنوع است، و نشانی نباید در کد ثابت باشد، که همین متغیر آن را برآورده می‌کند.
  - **ذکر منبع:** «© OpenStreetMap contributors»، با پیوند به openstreetmap.org/copyright، آشکارا روی نقشه و نه پشت دکمه.
  - **Referer:** مرورگر باید Referer معتبر بفرستد، و `no-referrer` ممنوع است. `strict-origin-when-cross-origin` ما مبدأ را می‌فرستد، پس سازگار است.
  - **cache:** مرورگر با تنظیم پیش‌فرض کافی است.
  - **ممنوع‌ها:** دانلود انبوه، پیش‌بارگذاری و حالت آفلاین. سایت هیچ‌کدام را ندارد.
  - **بدون SLA:** «If you cannot meet these requirements, please use an alternative». پس برای بار production، ارائه‌دهنده‌ی جدا در future-work ثبت می‌شود.
- **Alternatives considered:**
  - **ارائه‌دهنده‌ی سبک برداری رایگان:** وابستگی به سرویس سوم را بیشتر می‌کند.
  - **Leaflet به‌جای MapLibre:** پشته را constitution و future-work تعیین کرده‌اند.

## یافته‌های هنگام اجرا (2026-11-08)

این بندها هنگام `/speckit-implement` با کد و ابزار واقعی سنجیده شدند و تصمیم‌های بالا را دقیق‌تر می‌کنند.

- **R2، نسخه‌ها:** نسخه‌ها از روی تاریخ انتشار در `npm view <pkg> time` انتخاب شدند، با این قاعده که دست‌کم دو هفته از انتشارشان گذشته باشد. همه در `frontend/package.json` بدون `^` آمده‌اند.
  - **اصلی:** Next.js 16.4.3 (2026-10-23)، React 19.3.1، next-intl 4.14.9، TypeScript 5.9.3، Vitest 5.0.5، Vite 8.3.5، Tailwind 4.3.3 و MapLibre 5.24.0.
  - **eslint 9.39.5 و نه 10:** با eslint 10، `npm install` برای `eslint-plugin-import`، `eslint-plugin-jsx-a11y` و `eslint-plugin-react` (که `eslint-config-next` 16.4.3 می‌آورد) هشدار `ERESOLVE overriding peer dependency` داد.
  - **`axe-core` 4.14.0 و نه `vitest-axe`:** آخرین نسخه‌ی `vitest-axe` (0.1.0) از ۲۰۲۲ است.
  - **`create-next-app` و `shadcn` CLI به کار نرفتند:** `frontend/` با دست ساخته شد، تا هر نسخه دقیق و بررسی‌پذیر باشد. کامپوننت‌های پایه به سبک shadcn/ui، مستقیم روی `radix-ui` 1.8.1، در `src/components/ui/` نوشته شدند، چون CLI آن کد را از رجیستری اینترنتی می‌گیرد.
- **R5، proxy با route handler و نه `rewrites`:** docs همراه Next.js 16.4.3 (`node_modules/next/dist/docs`) و خروجی build نشان دادند که rewrites در manifest هنگام build ثابت می‌شوند. پس نشانی API در image قفل می‌شد. route handler `src/app/api/v1/[...path]/route.ts` نشانی را هنگام اجرا می‌خواند، و سرآیندها را با فهرست سفید می‌فرستد.
- **R19، نشانی ثابت سایت:** با `172.28.0.10`، `docker compose up` خطای «Address already in use» داد، چون Docker همان نشانی را پیش‌تر به container دیگری داده بود. حالا subnet یک `ip_range` (`172.28.0.0/25`) برای نشانی‌های پویا دارد، و سایت `172.28.0.250` را بیرون از آن می‌گیرد.
- **R19، سرآیند از سوی بازدیدکننده:** در `next/dist/server/base-server.js` آمده است `req.headers['x-forwarded-for'] ??= socket.remoteAddress`. یعنی Next.js سرآیندی را که خود بازدیدکننده فرستاده نگه می‌دارد. سایت راست‌ترین نشانی را برمی‌دارد، که پشت هر reverse proxy درست است. اما بدون proxy جلوی سایت، بازدیدکننده می‌تواند نشانی دلخواه بدهد. پس شرط production این است که یک reverse proxy جلوی سایت این سرآیند را بگذارد. این در `docs/backend-design.md` ثبت می‌شود.
  - **سنجش روی stack:** دو ورود ناموفق از راه `/session/login` با `X-Forwarded-For` برابر `198.51.100.21` و `.22` در `auth_attempts` جدا ثبت شدند. یک درخواست مستقیم به `:8000` با `X-Forwarded-For: 198.51.100.99` با نشانی اتصال خودش ثبت شد، نه با نشانی جعلی.
- **R21، CSP:** `curl` روی `next start` نشان داد سرآیند `content-security-policy` nonce تازه دارد، و همه‌ی `<script>`های صفحه همان nonce را دارند. nonce از `proxy.ts` به render می‌رسد، چون next-intl سرآیندهای درخواست را در rewrite خودش کپی می‌کند (`next-intl/dist/esm/development/middleware/middleware.js`).
- **R4، قفل:** کوکی میان زبانه‌ها مشترک است. پس دو تازه کردنی که قفل آن‌ها را پشت‌سرهم می‌کند خطری ندارند، چون دومی توکن چرخیده را می‌فرستد. خطر فقط دو درخواستِ هم‌زمان است. تست `session.test.ts` همین را می‌سنجد: بیشینه‌ی درخواست‌های هم‌زمان ۱ است. بازدیدکننده‌ای که وارد نشده هم پس از اولین بازسازی نشست، دیگر هیچ درخواست refresh نمی‌فرستد (`ensureToken`).
- **پیام‌ها:** `messages/fa.json` و `en.json` از یک منبع ساخته می‌شوند: `frontend/scripts/messages_source.py`، که هر کلید را با هر دو زبان دارد. پس دو فایل هرگز کلید متفاوت ندارند.
- **R3، `refresh` بی‌کوکی:** در بررسی Chrome واقعی (T069)، بازسازی نشست برای بازدیدکننده‌ای که وارد نشده بود `401` می‌گرفت و در کنسول هر صفحه خطا می‌نوشت. حالا بی‌کوکی `204` («نشستی نیست») برمی‌گردد، و `401` برای نشستی می‌ماند که API آن را رد کرده است.
- **R14، عکس‌ها:** optimizer عکس Next.js داخل container نشانی عمومی storage (`localhost:9000`) را نمی‌دید و `400` می‌داد. عکس‌ها مستقیم از storage بار می‌شوند (`images.unoptimized`)، و CSP همان یک مبدأ را مجاز می‌کند. در production، CDN اندازه‌ی مناسب را می‌دهد.
- **R17، اندازه‌گیری:** Lighthouse نصب نبود، و `npx lighthouse` کد بیرونی دانلود می‌کرد. همان سنجه‌ها با Chrome و Playwright و throttling موبایل گرفته شدند (`measurements.md`). دستور «متغیر محیطی در خط فرمان» برای بردن API به bulk کار نکرد، چون `docker-compose.yml` نشانی پایگاه داده را ثابت نوشته است. `db/bulk/compose.bulk.yml` جای آن را گرفت.
- **داده‌ی دمو:** `caravansara_demo` در migration `0001` است (`SELECT version_num FROM alembic_version`)، و API امروز با آن خطای `column l.review_status does not exist` می‌دهد. به‌روز کردن آن به future-work رفت، چون داده‌ی دمو را تغییر می‌دهد و اجازه‌ی مالک پروژه را می‌خواهد.

