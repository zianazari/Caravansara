# Quickstart: بررسی ایندکس‌ها

## پیش‌نیاز

- `docker compose up -d` (با `pg_stat_statements` در `shared_preload_libraries`، بعد از این کار).
- داده‌ی حجیم: `docker compose run --rm migrate caravansara seed-bulk` (اگر نیست)، یا برای `caravansara_bulk` موجود: `migrate` روی آن.

## ۱. اندازه‌گیری پیش از تغییر (خط پایه)

«پیش» روی همان پایگاه داده‌ای گرفته می‌شود که «پس» روی آن گرفته می‌شود، و پشت‌سرهم. دلیلش این است که روی لپ‌تاپ عدد با وضعیت برق تا دو برابر عوض می‌شود. SQL قبلی برنامه از `captured-sql.json` در یک پوشه‌ی جدا بازسازی می‌شود.

```bash
cd backend
CARAVANSARA_DATABASE_URL=…/caravansara_bulk uv run alembic downgrade 0003      # بدون ایندکس‌های این کار
uv run caravansara measure-queries --database caravansara_bulk --catalog <فهرست قدیمی> --out ../specs/003-index-review/before.json
```

انتظار: جستجو با تاریخ، رزروهای آگهی و job پایان اقامت ✗ هستند.

## ۲. اعمال migration و اندازه‌گیری دوباره

```bash
CARAVANSARA_DATABASE_URL=…/caravansara_bulk uv run caravansara migrate      # 0003 → 0005، با CONCURRENTLY
uv run caravansara measure-queries --database caravansara_bulk --out ../specs/003-index-review/after.json
```

انتظار: هیچ کوئری‌ای، بعد از تکرار با `--runs 9`، بیش از ۱۰٪ کندتر نیست، جز موردی که دلیلش ثبت شده (SC-004). کوئری‌هایی که هنوز ✗ هستند، در `measurements.md` و `docs/backend-design.md` دلیل دارند.

## ۳. نوشتن

`write_1000_bookings` در همان فهرست است. نتیجه: ۶۶ → ۱۱۳ ms، یعنی نگه‌داری سه ایندکس تازه، زیر هدف ۳۰۰ ms و با دلیل ثبت‌شده.

## ۴. آمار کوئری‌ها در Grafana

```bash
docker compose --profile observability up -d
```

Grafana (http://localhost:3000) → داشبورد Caravansara → پنل «Costly queries (pg_stat_statements)»: زمان کل، تعداد اجرا و میانگین برای ده کوئری پرهزینه.

## ۵. تست‌ها

```bash
uv run pytest -q
```

تست‌های تازه:

| تست | چه چیزی را ثابت می‌کند |
| --- | --- |
| پوشش فهرست | هر تابع repository و job در فهرست هست یا دلیل کنار گذاشتن دارد (SC-001) |
| اعتبار فهرست | هر SQL فهرست روی پایگاه داده‌ی تست با `EXPLAIN` اجرا می‌شود |
| `measure-queries` | خروجی درست روی داده‌ی کوچک؛ هیچ ردیفی عوض نمی‌شود؛ قفل production |
| migration `0003` | ایندکس‌ها ساخته و با downgrade حذف می‌شوند، و داده عوض نمی‌شود |
| استفاده از ایندکس | با `enable_seqscan = off`، نقشه‌ی هر کوئری هدف از ایندکس تازه استفاده می‌کند |
| همه‌ی تست‌های فعلی | بدون تغییر پاس (SC-006)، از جمله مسابقه‌ها و job پایان اقامت در تغییر ساعت تابستانی |
