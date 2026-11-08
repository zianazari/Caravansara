# Contract: سایت وب (مسیرها، route handlerها و تنظیمات)

این کار API بکند را عوض نمی‌کند (research R1)، و قرارداد آن همان `backend/openapi.json` است. این سند قرارداد خود سایت است: نشانی صفحه‌ها، مسیرهای نشست، و تنظیمات اجرا.

## نشانی صفحه‌ها

همه‌ی صفحه‌ها زیر پیشوند زبان هستند. `/` و هر نشانی بدون زبان با 307 به `/fa/...` می‌رود.

| مسیر | رندر | حساب لازم | داستان |
| --- | --- | --- | --- |
| `/{locale}` | سرور | نه | US1: صفحه‌ی اول با فرم جستجو |
| `/{locale}/search?…` | سرور (فهرست) + کاربر (نقشه، فیلترها) | نه | US1: پارامترها در data-model، «انتخاب جستجو» |
| `/{locale}/listings/{id}?check_in&check_out&adults&children&infants&pets` | سرور | نه | US1: صفحه‌ی آگهی؛ 404 ترجمه‌شده برای آگهی ناموجود یا غیرعمومی |
| `/{locale}/login?returnTo=` | کاربر | نه | US2 |
| `/{locale}/register?returnTo=` | کاربر | نه | US2 |
| `/{locale}/account` | کاربر | بله | US2: پروفایل، نام و آواتار. آپلود مستقیم از مرورگر به نشانی presigned در storage انجام می‌شود (contracts/api.md) |
| `/{locale}/book/{listingId}` | کاربر | بله | US3: تأیید و ساخت نگه‌داشت از پیش‌نویس |
| `/{locale}/trips` | کاربر | بله | US4 |
| `/{locale}/trips/{bookingId}` | کاربر | بله | US3 (پرداخت و شمارش معکوس)، US4 (جزئیات و لغو) |
| `/{locale}/trips/{bookingId}/review` | کاربر | بله | US5 |

`{locale}` یکی از `fa` یا `en` است. هر مقدار دیگر 404 می‌گیرد.

**قاعده‌ی `returnTo`:** فقط مسیری را می‌پذیرد که با `/` شروع شود، با `//` یا `/\` شروع نشود، و پیشوند زبان داشته باشد. هر مقدار دیگر به `/{locale}` تبدیل می‌شود (FR-014: جلوگیری از open redirect).

## مسیر proxy به API

| مسیر سایت | مقصد | نکته |
| --- | --- | --- |
| `/api/v1/:path*` | `${API_INTERNAL_URL}/api/v1/:path*` | فقط همین پیشوند proxy می‌شود. `/metrics`، `/docs` و `/health` از سایت در دسترس نیستند (اصل V) |
| `/api/v1/auth/*` | — (404) | ورود، ثبت‌نام، refresh و logout فقط از `/session/*` می‌گذرند، تا refresh token هرگز به اسکریپت صفحه نرسد و محدودیت تلاش همیشه IP واقعی را ببیند (R3، R19) |

## route handlerهای نشست

همه `POST` هستند. پاسخ JSON است، و خطا همان شکل خطای API را دارد: `{"error": {"code", "message"}}`. هر درخواستی که `Origin` آن با مبدأ سایت یکی نباشد، `403` با کد `bad_origin` می‌گیرد.

| مسیر | بدنه | کار | پاسخ موفق |
| --- | --- | --- | --- |
| `/session/login` | `LoginIn` | `POST /auth/login`؛ کوکی `cv_refresh` را می‌گذارد | `200 { access_token, expires_in }` |
| `/session/register` | `RegisterIn` | `POST /auth/register`؛ کوکی را می‌گذارد | `201 { access_token, expires_in, user }` |
| `/session/refresh` | — | `refresh_token` را از کوکی می‌خواند و `POST /auth/refresh` را صدا می‌زند؛ کوکی تازه می‌گذارد | `200 { access_token, expires_in }`؛ بدون کوکی یا با رد شدن: `401 invalid_token` و پاک شدن کوکی |
| `/session/logout` | — | `POST /auth/logout` با توکن کوکی؛ کوکی را پاک می‌کند، حتی اگر API خطا بدهد | `204` |

**کوکی `cv_refresh`:** `HttpOnly`، `SameSite=Strict`، `Path=/session`، `Max-Age` برابر ۳۰ روز، و `Secure` وقتی `NODE_ENV=production` است (data-model، «نشست»).

خطاهای API، مثل `invalid_credentials`، `email_taken`، `too_many_attempts` و `validation_error`، با همان وضعیت و کد برگردانده می‌شوند. پس صفحه پیام ترجمه‌شده را نشان می‌دهد.

**rate limit:** route handler نشانی IP کاربر را در `X-Forwarded-For` به API می‌فرستد. API این سرآیند را فقط از نشانی ثابت سرویس `web` می‌پذیرد (`FORWARDED_ALLOW_IPS`، research R19). بدون آن، همه‌ی ورودها از نشانی سرور Next.js می‌آمد، و محدودیت تلاش همه‌ی کاربران را با هم می‌بست.

## تنظیمات اجرا (متغیرهای محیط سایت)

| متغیر | پیش‌فرض در compose | کاربرد |
| --- | --- | --- |
| `API_INTERNAL_URL` | `http://api:8000` | مقصد proxy و درخواست‌های سمت سرور (فقط سمت سرور) |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | `http://localhost:9000/caravansara-media` | مبدأ مجاز تصویرها برای `next/image` |
| `NEXT_PUBLIC_MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | کاشی raster نقشه، بدون کلید پولی. در production ارائه‌دهنده‌ی جدا (R22) |
| `PORT` | `3001` | پورت سایت (۳۰۰۰ مال Grafana است، research R5) |

هیچ رازی در متغیرهای `NEXT_PUBLIC_*` نیست، چون این متغیرها در کد مرورگر قرار می‌گیرند.

**سیاست امنیت محتوا (CSP، R21):** `src/proxy.ts` برای هر صفحه nonce می‌سازد. بندهای کامل در research R21 آمده‌اند. `img-src` و `connect-src` مبدأ storage (`NEXT_PUBLIC_MEDIA_BASE_URL`) و مبدأ کاشی نقشه را مجاز می‌کنند: اولی برای نمایش عکس‌ها و کاشی، دومی برای آپلود آواتار با presigned POST و دریافت کاشی. `worker-src blob:` هم برای MapLibre است. `Referrer-Policy` برابر `strict-origin-when-cross-origin` است، که سیاست کاشی OSM آن را می‌پذیرد.

## سرویس `web` در `docker-compose.yml`

- **build:** `frontend/Dockerfile` (خروجی `standalone`، Node 24 slim، کاربر غیر root).
- **ports:** `3001:3001`.
- **depends_on:** `api` (healthy).
- **شبکه:** شبکه‌ی `app` با subnet ثابت. `web` نشانی `ipv4_address` ثابت دارد، و `api` متغیر `FORWARDED_ALLOW_IPS` را برابر همان نشانی می‌گیرد (research R19). سرویس‌های دیگر هم به همین شبکه می‌پیوندند، تا نام‌های `db`، `minio` و `api` مثل امروز کار کنند.
- **healthcheck:** درخواست به `http://localhost:3001/fa`.
- با همان `docker compose up --build` بالا می‌آید (FR-032).

## CI: job `frontend` در `.github/workflows/ci.yml`

۱. `npm ci` (Node 24)
۲. تولید دوباره‌ی `src/api/schema.d.ts` از `backend/openapi.json` و `git diff --exit-code` (FR-033)
۳. `npm run lint` (ESLint) و `npm run format:check` (Prettier)
۴. `npm run typecheck` (`tsc --noEmit`)
۵. `npm run test -- --coverage` (Vitest؛ آستانه‌ی ۹۰٪ برای `src/lib` و `src/api`، research R16)
۶. `npm run build`

job `image` هم `frontend/Dockerfile` را build می‌کند.
