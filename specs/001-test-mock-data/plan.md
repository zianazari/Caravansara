# Implementation Plan: داده‌ی تست و ماک بیشتر و متنوع‌تر

**Branch**: `001-test-mock-data` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-test-mock-data/spec.md`

## Summary

سه نوع داده ساخته می‌شود، و هیچ‌کدام شمای پایگاه داده یا API را تغییر نمی‌دهد.

**۱. داده‌ی دمو** (`db/seed_demo.sql`، در git) بزرگ‌تر و متنوع‌تر می‌شود:
- ۹ شهر در ۷ کشور و ۶ ارز: London و New York City از Inside Airbnb، و Tehran، Isfahan و Shiraz با ۴۰ آگهی فارسی دست‌نوشته.
- ۱۲۵ آگهی و تا ۱۵ نظر واقعی برای هر شهر Inside Airbnb.
- ۳ تا ۸ عکس ساختگی برای هر آگهی، که در git هستند و هنگام بارگذاری در MinIO قرار می‌گیرند.
- ۷ حالت مرزی با تاریخ نسبی در منطقه‌ی زمانی شهر.

**۲. داده‌ی حجیم** با فرمان تازه‌ی `caravansara seed-bulk` ساخته می‌شود:
- از روی پروفایل آماری شهرها (`db/bulk/city_profiles.json`، در git)، با RNG جداگانه برای هر آگهی.
- در یک تراکنش، با `COPY` و همه‌ی قیدها روشن، در پایگاه داده‌ی جدای `caravansara_bulk` روی همان سرور.
- پایگاه داده‌ی توسعه را هدف قرار نمی‌دهد و چیزی را پاک نمی‌کند.

**۳. ابزار `Factory`** در تست‌های بکند جای `insert_booking` و `UPDATE`های دستی را می‌گیرد.

`caravansara seed` افزایشی می‌شود، تا شهرهای تازه بدون پاک شدن داده به پایگاه داده‌ی موجود برسند.

## Technical Context

**Language/Version**:
- Python 3.13 (بکند، با uv)
- اسکریپت‌های `db/`: Python 3.9 به بالا، فقط کتابخانه‌ی استاندارد. استثنا: `build_demo_photos.py`، که Pillow را با `uv run --with` می‌گیرد.

**Primary Dependencies**:
- موجود: asyncpg (برای `COPY`)، boto3 (برای MinIO) و Alembic.
- **هیچ وابستگی اجرایی تازه‌ای اضافه نمی‌شود.** Pillow فقط در زمان توسعه و فقط برای ساختن یک‌باره‌ی ۸ عکس به کار می‌رود.

**Storage**:
- PostgreSQL 16 + PostGIS: پایگاه داده‌ی `caravansara` بدون تغییر، به‌علاوه‌ی پایگاه داده‌ی تازه‌ی `caravansara_bulk` روی همان سرور.
- MinIO: کلیدهای `demo/listings/...`.

**Testing**:
- pytest با testcontainers (PostgreSQL + PostGIS و MinIO واقعی).
- تست‌های تازه: `test_demo_data.py`، `test_devdata_bulk.py` و `test_factories.py`.
- زمان‌سنجی SC-001 و SC-002 با دست، طبق [quickstart.md](quickstart.md).

**Target Platform**: Linux container (image بکند)، و لپ‌تاپ توسعه (macOS) با Docker.

**Project Type**: web-service (بکند FastAPI). این قابلیت ابزار CLI و داده اضافه می‌کند.

**Performance Goals**:
- دمو: کمتر از ۲ دقیقه.
- داده‌ی حجیم: ۱۰ هزار آگهی در کمتر از ۳ دقیقه، و ۱۰۰ هزار آگهی با ۲ میلیون رزرو در کمتر از ۳۰ دقیقه، روی لپ‌تاپ توسعه.

**Constraints**:
- هیچ قید یا trigger یا ایندکسی خاموش نمی‌شود (FR-006).
- بارگذاری حجیم یک تراکنش است (FR-007).
- حافظه‌ی تولیدکننده مستقل از اندازه است (تولید جریانی).
- رشد مخزن کمتر از ۲۰ مگابایت است (برآورد: حدود ۷ مگابایت).
- `total_price` ریالی زیر سقف `NUMERIC(10,2)` می‌ماند (R6).

**Scale/Scope**:
- دمو: ۷۹۰ آگهی، حدود ۱۲ هزار رزرو، حدود ۱۰ هزار نظر و حدود ۳٬۹۰۰ عکس.
- حجیم: ۱۰۰ هزار آگهی، حدود ۳۶۰ هزار کاربر، حدود ۳ میلیون رزرو و حدود ۱٫۲ میلیون نظر.

همه‌ی پرسش‌های باز در [research.md](research.md) پاسخ گرفته‌اند. هیچ NEEDS CLARIFICATION باقی نمانده است.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل | وضعیت | چرا |
| --- | --- | --- |
| I. پایگاه داده نگهبان قانون‌هاست | ✅ | هر دو بارگذاری (دمو و حجیم) همه‌ی قیدها و triggerها را روشن نگه می‌دارند (R9). `Factory` رزرو را با `INSERT` عادی می‌سازد، و قیدها همان‌طور بررسی می‌شوند. هیچ تغییر وضعیت تازه‌ای در کد برنامه نیست. |
| II. مونولیت ماژولار با مرز اجباری | ⚠️ استثنا، در Complexity Tracking | بسته‌ی تازه‌ی `caravansara.devdata` ابزار است، نه ماژول کسب‌وکار. router، service، repository، models و schemas ندارد، که اصل II برای هر ماژول MUST می‌داند. پس استثناست و در Complexity Tracking آمده است. جدول‌ها را مثل `seed_demo.sql` مستقیم پر می‌کند، و فقط `caravansara.core` را import می‌کند. یک قرارداد import-linter تازه تضمین می‌کند که هیچ ماژول کسب‌وکار یا `core` آن را import نکند، و خودش هم هیچ ماژول کسب‌وکاری را import نکند. Redis، صف یا سرویس تازه‌ای اضافه نمی‌شود. |
| III. قرارداد API اول | ✅ | API تغییر نمی‌کند، و `openapi.json` همان می‌ماند. قرارداد فرمان‌های CLI در [contracts/cli.md](contracts/cli.md) است. |
| IV. تست روی زیرساخت واقعی | ⚠️ استثنا، در Complexity Tracking | هر معیار پذیرش یک تست روی PostgreSQL و MinIO واقعی دارد (R14). بخش «تعداد» در US1-1 و «نسبت‌ها» در US1-5 هم تست خودکار دارند (T009: میانگین رزرو هر آگهی و پیش‌فرض `--listings`). فقط بخش «زمان» در US1-5 و SC-001/SC-002 با دست اندازه گرفته می‌شود، که استثناست و در Complexity Tracking آمده است. پوشش ≥ ۹۰٪ می‌ماند، چون `devdata` با بارگذاری کوچک تست می‌شود. |
| V. حریم خصوصی و امنیت | ✅ | همه‌ی اشخاص ساختگی‌اند، با ایمیل `@example.com`. نام میزبان واقعی جایگزین می‌شود. `photo_sources.csv` (نشانی عکس‌های واقعی میزبان‌ها) حذف می‌شود. `seed-bulk` در production اجرا نمی‌شود. تنها راز، رمز شناخته‌شده‌ی دمو است، که همین امروز هم در مخزن است. |
| VI. مشاهده‌پذیری | ✅ | endpoint یا job تازه‌ای نیست. فرمان‌های CLI پیشرفت کار را با همان `configure_logging` لاگ می‌کنند. متریک تازه‌ای لازم نیست، چون این فرمان‌ها رویداد کسب‌وکار نیستند. |
| VII. ساده، و اول اندازه‌گیری | ✅ | راه ساده انتخاب شده: پایگاه داده‌ی جدا روی همان سرور، عکس‌های ثابت در git، و کلاس factory بدون کتابخانه. زمان بارگذاری حجیم با triggerهای روشن اول اندازه گرفته می‌شود. فقط اگر از ۳۰ دقیقه بیشتر شد، تصمیم با عدد بازبینی می‌شود (R9). |
| محدودیت‌های فنی (Alembic منبع شما) | ✅ | migration تازه‌ای نیست. catalog داده است، و `seed_locations.sql` افزایشی می‌شود (R7). |
| یک فرمان `docker compose` | ✅ | `migrate` در compose همچنان `seed` را اجرا می‌کند و شهرهای تازه را اضافه می‌کند. `seed-bulk` و `seed-demo` با `docker compose run --rm migrate …` اجرا می‌شوند. |
| روند کار (اسناد) | ✅ | تصمیم‌ها به `docs/backend-design.md` و PDF آن منتقل می‌شوند. بخش ۲ از `docs/future-work.md` حذف می‌شود، و یافته‌ی سقف ریال (R6) به آن اضافه می‌شود. README، CONTEXT و `db/demo/README.md` به‌روز می‌شوند. |

**بازبینی بعد از طراحی (Phase 1)**: data-model، قراردادها و quickstart هیچ نقض تازه‌ای نساختند. دو استثنا (اصل II برای `devdata`، و اصل IV برای زمان‌سنجی) در Complexity Tracking آمده‌اند. طبق Governance تصمیم آن‌ها با مالک است، و مالک (Zia) هر دو را در 2026-11-05 پذیرفت.

## Project Structure

### Documentation (this feature)

```text
specs/001-test-mock-data/
├── plan.md              # این فایل
├── research.md          # Phase 0: تصمیم‌های R1 تا R14
├── data-model.md        # Phase 1: داده‌ی دمو، حالت‌های مرزی، پروفایل، داده‌ی حجیم، factory
├── quickstart.md        # Phase 1: درستی‌سنجی دستی و زمان‌سنجی
├── contracts/
│   ├── cli.md           # seed، seed-demo، seed-bulk و اسکریپت‌های db/
│   └── test-factory.md  # رابط Factory در تست‌ها
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/caravansara/
│   ├── cli.py                   # seed افزایشی؛ seed-demo با عکس؛ seed-bulk
│   ├── core/storage.py          # + put_bytes(key, data, content_type) برای عکس‌های دمو
│   └── devdata/                 # تازه: ابزار داده‌ی توسعه (فقط core را import می‌کند)
│       ├── __init__.py
│       ├── profiles.py          # خواندن و درستی‌سنجی city_profiles.json
│       ├── bulk.py              # تولید جریانی و یکسان ردیف‌ها (بدون I/O)
│       ├── load.py              # ساخت/انتخاب پایگاه داده‌ی bulk، قفل‌های ایمنی، COPY در یک تراکنش
│       └── photos.py            # قرار دادن عکس‌های دمو در bucket
├── tests/
│   ├── factories.py             # تازه: Factory
│   ├── conftest.py              # + fixture factory
│   ├── helpers.py               # - insert_booking
│   ├── test_demo_data.py        # تازه
│   ├── test_devdata_bulk.py     # تازه
│   ├── test_factories.py        # تازه
│   ├── test_cli.py              # تعداد ردیف‌های دمو و seed افزایشی
│   └── test_bookings.py, test_jobs.py, test_database_rules.py, test_concurrency.py  # انتقال به factory
└── pyproject.toml               # قرارداد import-linter برای devdata

db/
├── seed_locations.sql           # + GB, US, IR و ۵ شهر؛ ON CONFLICT DO NOTHING
├── seed_amenities.sql           # ON CONFLICT DO NOTHING
├── seed_demo.sql                # بازسازی‌شده
├── demo/
│   ├── build_demo_seed.py       # ۶ شهر، ۱۲۵ آگهی، ۱۵ نظر، عکس‌ها، فارسی، حالت‌های مرزی
│   ├── build_demo_photos.py     # تازه (Pillow، فقط توسعه)
│   ├── fa_listings.json         # تازه: ۴۰ آگهی فارسی
│   ├── photos/                  # تازه: ۸ JPEG + manifest.json
│   ├── photo_sources.csv        # حذف (R3)
│   └── README.md                # منبع، محتوا، فهرست حالت‌های مرزی، فرمان‌ها
└── bulk/
    ├── build_city_profiles.py   # تازه
    ├── city_profiles.json       # تازه
    └── README.md                # تازه

docker-compose.yml               # فقط توضیح فرمان‌های seed-demo/seed-bulk در سرآیند
docs/backend-design.md (+ PDF), docs/future-work.md, README.md, CONTEXT.md
```

**Structure Decision**: ساختار موجود مخزن حفظ می‌شود: بکند در `backend/`، و داده و اسکریپت‌های ساخت آن در `db/`.

- **کد اجرایی** (`seed-bulk` و قرار دادن عکس‌ها) در بسته‌ی `caravansara.devdata` است، تا در image بکند باشد و با `docker compose run` بدون نصب چیزی روی میزبان اجرا شود.
- **اسکریپت‌های بازسازی** (`build_*`) در `db/` می‌مانند، چون فقط هنگام عوض شدن منبع اجرا می‌شوند و به cache حجیم Inside Airbnb نیاز دارند، که نباید در image باشد.
- **فرانت‌اند** در این قابلیت نیست.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| اصل II: بسته‌ی `caravansara.devdata` ساختار router/service/repository/models/schemas ندارد | ابزار توسعه است، نه ماژول کسب‌وکار: جدول‌ها را با `COPY` مستقیم پر می‌کند، مثل `seed_demo.sql`، و API ندارد. باید در image بکند باشد، تا با `docker compose run` اجرا شود. مرزش با یک قرارداد import-linter تضمین می‌شود (فقط `core` را import می‌کند، و هیچ ماژولی آن را import نمی‌کند). | اسکریپت جدا در `db/` فایل CSV میانی چندگیگابایتی می‌ساخت (خلاف FR-005)، و به psql و Python با asyncpg روی میزبان نیاز داشت. ساختن router و service خالی فقط شکل را رعایت می‌کرد، و کد بی‌مصرف می‌ساخت. |
| اصل IV: زمان بارگذاری (بخش زمان US1-5، SC-001، SC-002) تست خودکار CI ندارد | زمان به سخت‌افزار وابسته است، و بارگذاری پیش‌فرض تا ۳۰ دقیقه طول می‌کشد. زمان‌ها طبق quickstart با دست اندازه گرفته و در `docs/backend-design.md` ثبت می‌شوند (T018، T045). بخش‌های غیرزمانی همان معیارها تست خودکار دارند (T009، T010). | اجرای بارگذاری پیش‌فرض در CI: هر PR را حدود ۳۰ دقیقه کند می‌کرد، و زمان runner اشتراکی GitHub عددی ناپایدار و بی‌ارتباط با لپ‌تاپ توسعه می‌داد. |
