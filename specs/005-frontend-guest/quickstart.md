# Quickstart: فرانت‌اند وب، بخش ۱

این راهنما نشان می‌دهد چطور کار را از ابتدا تا انتها سنجید. نشانی صفحه‌ها و route handlerها در [contracts/web.md](contracts/web.md) است، و قواعد وضعیت‌ها در [data-model.md](data-model.md).

## پیش‌نیاز

- Docker، و Node 24 برای اجرای محلی سایت بیرون از Docker.
- پایگاه داده با داده‌ی دمو. برای پایگاه داده‌ی خالی:

```bash
docker compose up --build -d
docker compose run --rm migrate caravansara seed-demo
```

- حساب دمو: همان مهمان دمو در `db/demo/README.md`.

## اجرا

```bash
# کل سیستم، با سایت (SC-009)
docker compose up --build
# سایت: http://localhost:3001  (/fa پیش‌فرض)، API و Swagger: http://localhost:8000/docs

# یا فقط سایت، بیرون از Docker، روی API در حال اجرا
cd frontend && npm ci && API_INTERNAL_URL=http://localhost:8000 npm run dev
```

## بررسی‌های خودکار (همان CI)

```bash
cd frontend
npm run gen:api && git diff --exit-code src/api/schema.d.ts   # FR-033
npm run lint && npm run format:check && npm run typecheck
npm run test -- --coverage   # Vitest: قاعده‌ها، کامپوننت‌ها، axe، ترجمه‌ها و کدهای خطا
npm run build

cd ../backend
uv run pytest tests/test_avatar.py tests/test_openapi_contract.py   # آواتار روی MinIO واقعی، و قرارداد (۳۹ عملیات)
```

نتیجه‌ی مورد انتظار: همه سبز، و پوشش `src/lib` و `src/api` دست‌کم ۹۰٪.

تست‌های e2e فعلی API هم روی stack بالا اجرا می‌شوند (`cd e2e && npm test`)، به‌اضافه‌ی آزمون IP پشت سایت (research R19).

## سناریوهای دستی، روی stack و داده‌ی دمو

| # | کار | نتیجه‌ی مورد انتظار | داستان |
| --- | --- | --- | --- |
| 1 | `http://localhost:3001` را باز کنید | به `/fa` می‌رود، راست‌به‌چپ با Vazirmatn | FR-001 |
| 2 | «تهران» را تایپ کنید، تاریخ‌ها را در تقویم شمسی و ۲ بزرگسال را انتخاب کنید، و جستجو کنید | کارت‌ها با قیمت کل به تومان و ارقام فارسی؛ پین‌ها روی نقشه | US1/AC1–2، FR-007 |
| 3 | امکان «Wifi» را در فیلتر بزنید | نتایج کم می‌شوند، و شمار کنار هر امکان دیده می‌شود | US1/AC3 |
| 4 | نشانی صفحه را در زبانه‌ی تازه باز کنید | همان نتایج و همان فیلترها | FR-020 |
| 5 | یک آگهی را باز کنید و کد صفحه را ببینید (view-source) | محتوا در HTML هست؛ نشانی دقیق و مختصات واقعی نیست | FR-018، FR-022، SC-005 |
| 6 | «رزرو» را بدون ورود بزنید | به ورود می‌رود؛ پس از ورود به همان آگهی با همان انتخاب‌ها برمی‌گردد | US2/AC7 |
| 7 | رزرو کنید | صفحه‌ی پرداخت با شمارش معکوس ۱۵ دقیقه | US3/AC1 |
| 8 | پرداخت کنید | رزرو «قطعی»؛ نشانی دقیق و ساعت ورود به وقت تهران | US3/AC2، FR-006 |
| 9 | DevTools: Application → Local Storage، Session Storage و Cookies | هیچ توکنی؛ `cv_refresh` با پرچم HttpOnly | SC-006 |
| 10 | سایت را در دو زبانه باز کنید، ۱۶ دقیقه صبر کنید، و در هر دو کاری بکنید | هر دو وارد می‌مانند (یک تازه کردن) | research R4 |
| 11 | «سفرهای من» → رزرو آینده → لغو | وضعیت «لغوشده»، و پیام «بدون جریمه و بازپرداخت» | US4/AC3 |
| 12 | با رزرو «انجام‌شده»ی دمو نظر بدهید | نظر در صفحه‌ی آگهی می‌آید | US5/AC1 |
| 13 | همه‌ی کارهای بالا را در `/en` تکرار کنید | چپ‌به‌راست، تقویم میلادی؛ قیمت ریالی با برچسب «Toman» | FR-001، FR-005 |
| 14 | در DevTools عرض را روی ۳۶۰ پیکسل بگذارید | هیچ اسکرول افقی‌ای نیست | SC-002 |
| 15 | با کاربر تازه، سرصفحه و پروفایل را ببینید | آواتار پیش‌فرض: حرف اول نام روی رنگ، که برای همان کاربر همیشه یکی است | US2/AC9، FR-037 |
| 16 | در پروفایل یک JPEG کمتر از ۵ مگابایت را انتخاب و تأیید کنید | پیش‌نمایش دیده می‌شود؛ پس از تأیید، عکس در سرصفحه هم هست | US2/AC10 |
| 17 | یک PNG شش مگابایتی، یک WebP، و یک فایل متنی که نامش را `.png` گذاشته‌اید انتخاب کنید | هر سه پیش از آپلود با پیام روشن رد می‌شوند | US2/AC11 |
| 18 | عکس دیگری آپلود کنید، سپس «حذف عکس» را بزنید | عکس تازه، سپس آواتار پیش‌فرض، جای قبلی را می‌گیرد؛ در کنسول MinIO (`:9001`) فایل‌های قبلی زیر `avatars/<id>/` پاک شده‌اند | US2/AC12، FR-039 |
| 19 | در Swagger، `PATCH /me` را با `{"avatar_url": "https://example.com/a.png"}` بفرستید | `422 invalid_avatar_url`، و آواتار عوض نمی‌شود | FR-041، SC-010 |
| 20 | خروج | صفحه‌های حساب به ورود می‌روند؛ refresh در API باطل شده است | US2/AC6 |

## اندازه‌گیری سرعت (SC-003، دستی طبق اصل IV)

۱. API را موقتاً به `caravansara_bulk` وصل کنید:

   ```bash
   CARAVANSARA_DATABASE_URL=postgresql+asyncpg://caravansara:caravansara@db:5432/caravansara_bulk docker compose up -d --no-deps api
   ```

   Lighthouse فقط می‌خواند، پس داده‌ی bulk تغییر نمی‌کند.

۲. Lighthouse را در حالت Mobile، با throttling پیش‌فرض، روی این سه صفحه اجرا کنید:
   - `/fa/search?city_id=<London>&check_in=…&check_out=…&adults=2`
   - صفحه‌ی یک آگهی
   - `/fa`

۳. LCP، INP (یا TBT) و CLS را در `measurements.md` و `docs/backend-design.md` ثبت کنید. هدف: LCP ≤ ۲.۵ ثانیه، INP ≤ ۲۰۰ میلی‌ثانیه، CLS ≤ ۰.۱.

۴. API را برگردانید: `docker compose up -d --no-deps api`.
