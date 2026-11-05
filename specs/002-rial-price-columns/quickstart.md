# Quickstart: بررسی قیمت ریالی بدون سرریز

## پیش‌نیاز

- `docker compose up -d` (پایگاه داده، MinIO و API).
- `cd backend && uv sync`.

## ۱. تست‌ها

```bash
cd backend
uv run pytest tests/test_migrations.py tests/test_bookings.py tests/test_listings.py tests/test_search.py tests/test_unit.py -q
uv run pytest -q   # همه، با پوشش ≥ ۹۰٪
```

انتظار: همه پاس. تست‌های تازه:

| تست | چه چیزی را ثابت می‌کند |
| --- | --- |
| رزرو ۳۶۵ شبه با ۱۰۰ میلیون ریال | US1، SC-001: جمع ۳۶٬۵۰۵٬۰۰۰٬۰۰۰٫۰۰ |
| سقف قیمت با بیشترین طول اقامت | US2-3، SC-003 |
| قیمت ۱۰۰۰۰۰۰۰۰۰٫۰۱ در ساخت و ویرایش | US2-1، US2-2، SC-002 |
| `amount_too_large` با `max_nights` بزرگ | FR-004 |
| جمع جستجو برابر جمع رزرو | US1-3، FR-009 |
| upgrade، downgrade با مقدار بزرگ (متوقف)، downgrade بدون مقدار بزرگ | FR-005، SC-004 |
| دمو: آگهی و رزرو ریالی بیش از سقف قدیم | US3، SC-005 |

## ۲. ارتقای پایگاه داده‌ی توسعه

```bash
docker compose run --rm migrate          # 0001 → 0002
docker compose exec db psql -U caravansara -c "\d listings" | grep -E "price_per_night|cleaning_fee"
```

انتظار: `numeric(14,2)`، و همه‌ی آگهی‌ها و رزروهای قبلی همان مبلغ‌ها را دارند.

## ۳. داده‌ی دمو

```bash
python3 db/demo/build_demo_seed.py       # seed_demo.sql تازه، با قیمت‌های تازه‌ی ایران
```

داده‌ی دمو در پایگاه داده‌ی جدای `caravansara_demo` بارگذاری و با API بررسی می‌شود. انتظار: بدون خطا، گران‌ترین آگهی تهران ۱۰۰٬۰۰۰٬۰۰۰ ریال برای هر شب، و دست‌کم یک رزرو ریالی با جمع بیش از ۹۹٬۹۹۹٬۹۹۹٫۹۹.

## ۴. دستی با API

1. با یک حساب میزبان، آگهی تهران با `price_per_night: "100000000.00"`، `cleaning_fee: "5000000.00"` و `currency: "IRR"` بسازید.
2. با حساب مهمان، `POST /bookings` برای ۳۶۵ شب. انتظار: ۲۰۱ و `total_price: "36505000000.00"`.
3. `PATCH` همان آگهی با `price_per_night: "1000000000.01"`. انتظار: ۴۲۲ `validation_error`.
