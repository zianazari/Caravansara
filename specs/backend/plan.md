# Implementation Plan: بکند، کارهای ۰۰۱ تا ۰۰۴

این فایل `plan.md` چهار کار بکند را، که با Spec Kit ساخته و merge شده‌اند، کنار هم دارد: هر کار یک بخش، به ترتیب شماره. متن هر بخش همان متن پوشه‌ی اصلی آن کار (`specs/NNN-name/`) است، که در 2026-11-09 در این پوشه ادغام شد. شناسه‌ها (`FR-001`، `SC-001`، `T001`، `R1`، `US1`) همان‌اند که در قالب‌های Spec Kit، و درون بخش هر کار معنی دارند. پس ارجاع از بیرون به این شکل است: «`specs/backend`، کار ۰۰۴، research R5».

## 001. داده‌ی تست و ماک بیشتر و متنوع‌تر

**Branch**: `001-test-mock-data` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/backend/spec.md` (001)

### Summary

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

### Technical Context

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

### Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل | وضعیت | چرا |
| --- | --- | --- |
| I. پایگاه داده نگهبان قانون‌هاست | ✅ | هر دو بارگذاری (دمو و حجیم) همه‌ی قیدها و triggerها را روشن نگه می‌دارند (R9). `Factory` رزرو را با `INSERT` عادی می‌سازد، و قیدها همان‌طور بررسی می‌شوند. هیچ تغییر وضعیت تازه‌ای در کد برنامه نیست. |
| II. مونولیت ماژولار با مرز اجباری | ⚠️ استثنا، در Complexity Tracking | بسته‌ی تازه‌ی `caravansara.devdata` ابزار است، نه ماژول کسب‌وکار. router، service، repository، models و schemas ندارد، که اصل II برای هر ماژول MUST می‌داند. پس استثناست و در Complexity Tracking آمده است. جدول‌ها را مثل `seed_demo.sql` مستقیم پر می‌کند، و فقط `caravansara.core` را import می‌کند. یک قرارداد import-linter تازه تضمین می‌کند که هیچ ماژول کسب‌وکار یا `core` آن را import نکند، و خودش هم هیچ ماژول کسب‌وکاری را import نکند. Redis، صف یا سرویس تازه‌ای اضافه نمی‌شود. |
| III. قرارداد API اول | ✅ | API تغییر نمی‌کند، و `openapi.json` همان می‌ماند. قرارداد فرمان‌های CLI در [contracts/cli.md](contracts.md) است. |
| IV. تست روی زیرساخت واقعی | ⚠️ استثنا، در Complexity Tracking | هر معیار پذیرش یک تست روی PostgreSQL و MinIO واقعی دارد (R14). بخش «تعداد» در US1-1 و «نسبت‌ها» در US1-5 هم تست خودکار دارند (T009: میانگین رزرو هر آگهی و پیش‌فرض `--listings`). فقط بخش «زمان» در US1-5 و SC-001/SC-002 با دست اندازه گرفته می‌شود، که استثناست و در Complexity Tracking آمده است. پوشش ≥ ۹۰٪ می‌ماند، چون `devdata` با بارگذاری کوچک تست می‌شود. |
| V. حریم خصوصی و امنیت | ✅ | همه‌ی اشخاص ساختگی‌اند، با ایمیل `@example.com`. نام میزبان واقعی جایگزین می‌شود. `photo_sources.csv` (نشانی عکس‌های واقعی میزبان‌ها) حذف می‌شود. `seed-bulk` در production اجرا نمی‌شود. تنها راز، رمز شناخته‌شده‌ی دمو است، که همین امروز هم در مخزن است. |
| VI. مشاهده‌پذیری | ✅ | endpoint یا job تازه‌ای نیست. فرمان‌های CLI پیشرفت کار را با همان `configure_logging` لاگ می‌کنند. متریک تازه‌ای لازم نیست، چون این فرمان‌ها رویداد کسب‌وکار نیستند. |
| VII. ساده، و اول اندازه‌گیری | ✅ | راه ساده انتخاب شده: پایگاه داده‌ی جدا روی همان سرور، عکس‌های ثابت در git، و کلاس factory بدون کتابخانه. زمان بارگذاری حجیم با triggerهای روشن اول اندازه گرفته می‌شود. فقط اگر از ۳۰ دقیقه بیشتر شد، تصمیم با عدد بازبینی می‌شود (R9). |
| محدودیت‌های فنی (Alembic منبع شما) | ✅ | migration تازه‌ای نیست. catalog داده است، و `seed_locations.sql` افزایشی می‌شود (R7). |
| یک فرمان `docker compose` | ✅ | `migrate` در compose همچنان `seed` را اجرا می‌کند و شهرهای تازه را اضافه می‌کند. `seed-bulk` و `seed-demo` با `docker compose run --rm migrate …` اجرا می‌شوند. |
| روند کار (اسناد) | ✅ | تصمیم‌ها به `docs/backend-design.md` و PDF آن منتقل می‌شوند. بخش ۲ از `docs/future-work.md` حذف می‌شود، و یافته‌ی سقف ریال (R6) به آن اضافه می‌شود. README، CONTEXT و `db/demo/README.md` به‌روز می‌شوند. |

**بازبینی بعد از طراحی (Phase 1)**: data-model، قراردادها و quickstart هیچ نقض تازه‌ای نساختند. دو استثنا (اصل II برای `devdata`، و اصل IV برای زمان‌سنجی) در Complexity Tracking آمده‌اند. طبق Governance تصمیم آن‌ها با مالک است، و مالک (Zia) هر دو را در 2026-11-05 پذیرفت.

### Project Structure

#### Documentation (this feature)

```text
specs/backend
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

#### Source Code (repository root)

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

### Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| اصل II: بسته‌ی `caravansara.devdata` ساختار router/service/repository/models/schemas ندارد | ابزار توسعه است، نه ماژول کسب‌وکار: جدول‌ها را با `COPY` مستقیم پر می‌کند، مثل `seed_demo.sql`، و API ندارد. باید در image بکند باشد، تا با `docker compose run` اجرا شود. مرزش با یک قرارداد import-linter تضمین می‌شود (فقط `core` را import می‌کند، و هیچ ماژولی آن را import نمی‌کند). | اسکریپت جدا در `db/` فایل CSV میانی چندگیگابایتی می‌ساخت (خلاف FR-005)، و به psql و Python با asyncpg روی میزبان نیاز داشت. ساختن router و service خالی فقط شکل را رعایت می‌کرد، و کد بی‌مصرف می‌ساخت. |
| اصل IV: زمان بارگذاری (بخش زمان US1-5، SC-001، SC-002) تست خودکار CI ندارد | زمان به سخت‌افزار وابسته است، و بارگذاری پیش‌فرض تا ۳۰ دقیقه طول می‌کشد. زمان‌ها طبق quickstart با دست اندازه گرفته و در `docs/backend-design.md` ثبت می‌شوند (T018، T045). بخش‌های غیرزمانی همان معیارها تست خودکار دارند (T009، T010). | اجرای بارگذاری پیش‌فرض در CI: هر PR را حدود ۳۰ دقیقه کند می‌کرد، و زمان runner اشتراکی GitHub عددی ناپایدار و بی‌ارتباط با لپ‌تاپ توسعه می‌داد. |

---

## 002. قیمت ریالی بدون سرریز

**Branch**: `002-rial-price-columns` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/backend/spec.md` (002)

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

### Summary

رزرو چندشبه با قیمت ریالی امروز خطای ۵۰۰ می‌دهد، چون جمع رزرو در ستون `NUMERIC(10,2)` جا نمی‌شود (research R1). راه: migration `0002` که پنج ستون مبلغ را `NUMERIC(14,2)` می‌کند (فقط metadata، بدون بازنویسی جدول؛ R3). سقف ورودی قیمت از ۱۰ رقم به یک میلیارد می‌رسد، و در `openapi.json` دیده می‌شود (R4). بررسی جمع رزرو پیش از درج، با کد تازه‌ی `amount_too_large` (R5). و داده‌ی دمو ایران با قیمت واقعی بازار (R7).

### Technical Context

**Language/Version**: Python 3.13 (uv)

**Primary Dependencies**: FastAPI، Pydantic v2، SQLAlchemy 2 async + asyncpg، Alembic

**Storage**: PostgreSQL 16 + PostGIS؛ فقط نوع پنج ستون عوض می‌شود

**Testing**: pytest + testcontainers (PostgreSQL و MinIO واقعی)، پوشش ≥ ۹۰٪

**Target Platform**: Linux container (`docker compose`)

**Project Type**: web-service (بکند API)

**Performance Goals**: migration روی پایگاه داده‌ی حجیم (۱۰۰ هزار آگهی، ۳ میلیون رزرو) فوری، چون جدول بازنویسی نمی‌شود (R3)

**Constraints**: هیچ مبلغی پاسخ ۵۰۰ ندهد؛ downgrade بدون از دست رفتن داده؛ شکل پاسخ‌های API ثابت بماند

**Scale/Scope**: ۵ ستون، ۱ migration، ۱ کد خطای تازه، ۴۰ آگهی دمو

### Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل | وضعیت | دلیل |
| --- | --- | --- |
| I. پایگاه داده نگهبان قانون‌های حیاتی | ✅ | ظرفیت ستون نگهبان نهایی مبلغ است. بررسی `amount_too_large` در کد فقط برای پیام روشن است (R5). این قانون مسابقه‌ای نیست، پس قید تازه‌ای لازم ندارد. |
| II. مونولیت ماژولار | ✅ | ماژول تازه‌ای نیست. `MAX_PRICE` در `listings` و `MAX_STORED_AMOUNT` در `bookings` می‌مانند، و هیچ import تازه‌ای بین ماژول‌ها نیست. |
| III. قرارداد API اول | ✅ | تغییر در spec شروع شد و در `openapi.json` دیده می‌شود (`maximum`، [contracts/api.md](contracts.md)). کد تازه‌ی `amount_too_large` در جدول خطای سند طراحی ثبت می‌شود. هیچ کدی عوض یا حذف نمی‌شود. |
| IV. تست روی زیرساخت واقعی | ✅ | هر سناریوی پذیرش تست خودکار روی PostgreSQL واقعی دارد ([quickstart.md](quickstart.md)). downgrade در هر دو حالت (جا می‌شود / جا نمی‌شود) آزموده می‌شود. معیار زمانی‌ای در spec نیست. |
| V. حریم خصوصی و امنیت | ✅ | داده‌ی شخصی تازه‌ای نیست. |
| VI. مشاهده‌پذیری | ✅ | endpoint یا job تازه‌ای نیست. `amount_too_large` رویداد کسب‌وکاری برای پایش نیست، چون با تنظیم پیش‌فرض رخ نمی‌دهد؛ مثل بقیه‌ی ۴۲۲ها در متریک درخواست دیده می‌شود. |
| VII. ساده، و اول اندازه‌گیری | ✅ | ساده‌ترین راه: پهن کردن نوع، نه تغییر مدل پول (R2). |
| Alembic منبع schema؛ downgrade آزموده | ✅ | migration `0002` با downgrade و تست؛ `db/schema.sql` و DBML به‌روز می‌شوند (R8). |
| یک فرمان `docker compose` | ✅ | سرویس `migrate` همان `0002` را اجرا می‌کند. |
| روند کار (اسناد) | ✅ | تصمیم‌ها به `docs/backend-design.md` و PDF آن می‌روند. بخش ۲ از `docs/future-work.md` حذف می‌شود. README و CONTEXT به‌روز می‌شوند. |

**بازبینی بعد از طراحی (Phase 1)**: data-model، قرارداد و quickstart هیچ نقضی نساختند. Complexity Tracking خالی است.

### Project Structure

#### Documentation (this feature)

```text
specs/backend
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── api.md           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

#### Source Code (repository root)

```text
backend/
├── migrations/versions/
│   └── 0002_wider_price_columns.py      # تازه: پنج ستون → NUMERIC(14,2)، با downgrade
├── src/caravansara/
│   ├── listings/
│   │   ├── models.py                    # Numeric(14, 2)
│   │   └── schemas.py                   # MAX_PRICE، Money با le
│   └── bookings/
│       ├── models.py                    # Numeric(14, 2)
│       ├── rules.py                     # MAX_STORED_AMOUNT و بررسی جمع
│       └── service.py                   # صدا زدن بررسی پیش از درج
├── openapi.json                         # maximum (export-openapi)
└── tests/
    ├── test_migrations.py               # downgrade با مقدار بزرگ و بدون آن
    ├── test_listings.py                 # سقف در ساخت و ویرایش
    ├── test_bookings.py                 # ۳۶۵ شب × ۱۰۰ میلیون؛ سقف × بیشترین طول؛ amount_too_large
    ├── test_search.py                   # جمع جستجو = جمع رزرو
    ├── test_unit.py                     # بررسی جمع در rules
    └── test_demo_data.py                # قیمت ریالی بیش از سقف قدیم

db/
├── schema.sql، schema.dbml              # NUMERIC(14,2)
├── seed_demo.sql                        # بازسازی‌شده
└── demo/
    ├── fa_listings.json                 # قیمت‌های تازه (R7)
    ├── build_demo_seed.py               # بازه‌ی قیمت، ۱–۱۴ شب، بررسی سقف تازه
    └── README.md                        # بازه‌ی قیمت ایران

docs/backend-design.md (+ PDF)، docs/future-work.md، README.md، CONTEXT.md
```

**Structure Decision**: همان ساختار فعلی بکند (`backend/src/caravansara/<module>/`). فقط فایل migration تازه است.

### Complexity Tracking

خالی: Constitution Check هیچ نقضی ندارد.

---

## 003. بررسی ایندکس‌ها با اندازه‌گیری

**Branch**: `003-index-review` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/backend/spec.md` (003)

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

### Summary

خط پایه روی داده‌ی حجیم (research R1) نشان می‌دهد که تقریباً همه‌ی هزینه در سه جاست:
- **جستجو:** تا ۲٫۴ ثانیه. علت پرس‌وجوی جدا برای هر آگهی در anti-join، و خواندن ۳۹۰ مگابایت `listings` است.
- **رزروهای آگهیِ میزبان:** ۴۰۰ میلی‌ثانیه، چون روی `bookings.listing_id` ایندکس نیست.
- **job پایان اقامت:** هر دقیقه ۱٫۴ ثانیه، چون کل جدول رزرو را می‌خواند.

بقیه‌ی کوئری‌ها زیر ۵ میلی‌ثانیه‌اند.

راه این کار:
1. یک فهرست کوئری تکرارپذیر (`db/bulk/queries/`) و فرمان `caravansara measure-queries` با روش ثابت: ۱ اجرای گرم‌کننده، بعد میانه‌ی ۵ اجرا (R2، R10).
2. `pg_stat_statements` همیشه روشن، با پنل Grafana (R9).
3. آزمایش نامزدهای ایندکس و دو بازنویسی کوئری با همان نتیجه (data-model §۳).
4. migrationهای `0003` (extension)، `0004` (ایندکس‌های خواندن) و `0005` (ایندکس‌های job)، فقط برای تغییرهایی که اندازه‌گیری سودشان را نشان دهد. هر story migration خودش را دارد.
5. ثبت هر تصمیم با عدد پیش و پس در سند طراحی.

### Technical Context

**Language/Version**: Python 3.13 (uv)

**Primary Dependencies**: FastAPI، SQLAlchemy 2 async + asyncpg، Alembic؛ postgres-exporter v0.17.1، Grafana

**Storage**: PostgreSQL 16.4 + PostGIS؛ extension تازه‌ی `pg_stat_statements`؛ ایندکس‌های تازه یا حذف‌شده روی `bookings`، `listings` و `listing_amenities`

**Testing**: pytest + testcontainers؛ زمان‌ها با دست و طبق quickstart (اصل IV، 1.1.0)

**Target Platform**: Linux container (`docker compose`)

**Project Type**: web-service (بکند API) + ابزار توسعه

**Performance Goals**: میانه‌ی هر کوئری مهم ≤ ۵۰ ms با cache گرم روی داده‌ی حجیم (FR-005)؛ هیچ کوئری مهمی بیش از ۱۰٪ کندتر نشود (SC-004)

**Constraints**: رفتار API و `openapi.json` ثابت (FR-009)؛ قیدهای حیاتی دست نمی‌خورند (FR-010، اصل I)؛ هیچ داده‌ای در migration عوض نمی‌شود (FR-008)

**Scale/Scope**: حدود ۳۰ کوئری در فهرست، ۷ نامزد ایندکس، ۲ بازنویسی کوئری، ۳ migration، ۱ فرمان CLI، ۱ پنل داشبورد

### Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل | وضعیت | دلیل |
| --- | --- | --- |
| I. پایگاه داده نگهبان قانون‌ها | ✅ | ایندکس‌های پشت `EXCLUDE`، `UNIQUE` و کلید خارجی حذف یا عوض نمی‌شوند (R7). Hash جای `idempotency_key` را نمی‌گیرد، چون unique را پشتیبانی نمی‌کند. تست‌های مسابقه بدون تغییر پاس می‌شوند. |
| II. مونولیت ماژولار | ✅ | ابزار در `caravansara.devdata` است، بسته‌ی ابزاری که فقط `core` را import می‌کند (قاعده‌ی 1.1.0) و در production اجرا نمی‌شود. بازنویسی کوئری‌ها در repository همان ماژول‌ها (`search`، `bookings`) می‌ماند. |
| III. قرارداد API اول | ✅ | API عوض نمی‌شود. `openapi.json` همان می‌ماند، و تست قرارداد این را ثابت می‌کند. فرمان CLI قرارداد خودش را دارد ([contracts/cli.md](contracts.md)). |
| IV. تست روی زیرساخت واقعی | ✅ | بخش‌های غیرزمانی تست خودکار روی PostgreSQL واقعی دارند: پوشش فهرست، اعتبار SQL، استفاده از ایندکس با `enable_seqscan = off`، migration و downgrade، و ثابت ماندن داده با `measure-queries`. زمان‌ها با دست و طبق quickstart اندازه گرفته و در سند طراحی ثبت می‌شوند، که قاعده‌ی 1.1.0 اجازه می‌دهد. |
| V. حریم خصوصی و امنیت | ✅ | `pg_stat_statements` متن کوئری را با پارامترهای جایگزین‌شده (`$1`) نگه می‌دارد، نه مقدارها. پس ایمیل یا رمز در آمار نمی‌آید. exporter و Grafana مثل قبل فقط داخل compose هستند. |
| VI. مشاهده‌پذیری | ✅ | پنل تازه از متریک‌هایی ساخته می‌شود که exporter واقعاً می‌دهد، و `tests/test_monitoring_config.py` آن را بررسی می‌کند (R9). |
| VII. ساده، و اول اندازه‌گیری | ✅ | همین کار است: هر ایندکس از اندازه‌گیری شروع و با اندازه‌گیری تمام می‌شود. نامزدی که سود ندارد ساخته نمی‌شود. کش در این کار نیست. |
| Alembic؛ downgrade آزموده | ✅ | migrationهای `0003` تا `0005` با downgrade و تست. `db/schema.sql` و DBML به‌روز می‌شوند. |
| یک فرمان `docker compose` | ✅ | فقط `command` سرویس `db` و exporter عوض می‌شوند. همان یک فرمان کافی است. |
| روند کار (1.2.0) | ✅ | research با منبع واقعی سنجیده شد (R1–R10، با روش هر عدد). کارهای هر فایل در `tasks.md` کنار هم می‌آیند. converge پیش از PR اجرا می‌شود. branch با دست ساخته شده است. |

**بازبینی بعد از طراحی (Phase 1)**: data-model، قرارداد و quickstart نقضی نساختند. Complexity Tracking خالی است.

### Project Structure

#### Documentation (this feature)

```text
specs/backend
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── cli.md           # Phase 1 output (/speckit-plan command)
├── data/003-captured-sql.json    # SQL واقعی برنامه، ضبط‌شده در research (R1)
├── measurements.md, data/003-before.json, data/003-after.json   # اندازه‌گیری‌ها و آزمایش‌ها (implement)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

#### Source Code (repository root)

```text
backend/
├── migrations/versions/0003_pg_stat_statements.py   # US1: extension
├── migrations/versions/0004_read_indexes.py        # US2: ایندکس‌های پذیرفته‌ی جستجو و رزرو آگهی، با downgrade
├── migrations/versions/0005_job_indexes.py         # US3: ایندکس job و حذف ایندکس بی‌استفاده، با downgrade
├── src/caravansara/
│   ├── cli.py                                 # زیرفرمان measure-queries
│   ├── devdata/measure.py                     # تازه: خواندن فهرست، اجرا، گزارش
│   ├── search/repository.py                   # بازنویسی anti-join (اگر سود داشت)، با همان نتیجه
│   └── bookings/repository.py                 # کران امن در complete_finished_stays
└── tests/
    ├── test_query_catalog.py                  # پوشش و اعتبار فهرست
    ├── test_measure_queries.py                # فرمان، بدون تغییر داده، قفل production
    ├── test_migrations.py                     # 0003 up/down
    └── test_index_usage.py                    # نقشه‌ی هر کوئری هدف از ایندکس تازه استفاده می‌کند

db/
├── bulk/queries/                              # تازه: catalog.json، params.sql، <name>.sql
├── schema.sql، schema.dbml                    # ایندکس‌های تازه
└── README.md                                  # ایندکس‌ها

docker-compose.yml                             # db: shared_preload_libraries؛ exporter: --collector.stat_statements
observability/grafana/dashboards/caravansara.json  # پنل کوئری‌های پرهزینه
docs/backend-design.md (+ PDF)، docs/future-work.md، README.md، CONTEXT.md
```

**Structure Decision**: همان ساختار فعلی. ابزار در بسته‌ی ابزار موجود (`devdata`) قرار می‌گیرد، نه ماژول تازه، چون همان قرارداد import-linter را دارد.

### Complexity Tracking

خالی: Constitution Check هیچ نقضی ندارد.

---

## 004. تأیید آگهی توسط مدیر سیستم (admin)

**Branch**: `004-listing-approval` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/backend/spec.md` (004)

### Summary

آگهی تازه با وضعیت «در انتظار» ساخته می‌شود و فقط وقتی عمومی است که هم تأییدشده و هم فعال باشد.

- **حساب admin:** نوع جدایی در همان جدول `users` است (`kind = 'admin'`). فقط فرمان سرور آن را می‌سازد، و ورود و توکن خودش را دارد. توکن admin به هیچ endpoint میزبان یا مهمان نمی‌رسد، پس admin با ساختار سیستم آگهی ثبت نمی‌کند و رزرو نمی‌کند.
- **ماژول `moderation`:** ماژول تازه‌ای که صف، جزئیات (با نشانی دقیق و ثبت هر دیدن)، تأیید و رد را دارد.
- **وضعیت بازبینی و سابقه:** در `listings` می‌مانند، کنار ویرایش آگهی. ویرایش توصیفی آگهی تأییدشده آن را به صف برمی‌گرداند.
- **تصمیم‌ها:** UPDATE شرطی با `review_version`، تا دو تصمیم هم‌زمان یا ویرایش هم‌زمان هیچ نسخه‌ی بازبینی‌نشده‌ای را عمومی نکنند.
- **آگهی‌های موجود:** با پیش‌فرض ستون، بدون بازنویسی جدول، تأییدشده می‌شوند.

### Technical Context

**Language/Version**: Python 3.13 (uv)

**Primary Dependencies**: FastAPI، Pydantic v2، SQLAlchemy 2 async + asyncpg، Alembic، argon2-cffi، PyJWT، prometheus_client

**Storage**: PostgreSQL 16 + PostGIS. Migration `0006`: دو ستون روی `users`، چهار ستون روی `listings`، دو جدول تازه (`listing_review_events`، `admin_address_views`)، سه enum (data-model.md).

**Testing**: pytest روی PostgreSQL + PostGIS و MinIO واقعی (testcontainers)؛ Playwright `e2e/` روی stack `docker compose`.

**Target Platform**: Linux containers (`docker compose`)

**Project Type**: web service (backend API، worker، CLI). پنل admin و صفحه‌های میزبان کار فرانت‌اند جدایی‌اند (spec، Assumptions).

**Performance Goals**: جستجو روی داده‌ی حجیم بیش از ۱۰٪ کند نمی‌شود (SC-008). شرط تازه پلن را عوض نمی‌کند (research R9).

**Constraints**:

- تغییرهای API فقط افزودنی‌اند (FR-017).
- migration جدول ۱۰۰ هزار آگهی را بازنویسی نمی‌کند (R5).
- downgrade هیچ آگهی بازبینی‌نشده‌ای را عمومی نمی‌کند (R16).

**Scale/Scope**: ۱۰۰٬۰۰۰ آگهی و ۳ میلیون رزرو روی bulk. چند admin. ۵ endpoint تازه‌ی admin، ۱ endpoint تازه‌ی میزبان، ۲ فرمان تازه.

هیچ NEEDS CLARIFICATION باقی نمانده است. هر فرض در research.md با کد یا پایگاه داده‌ی واقعی سنجیده شده است.

### Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل | وضعیت | چطور |
|---|---|---|
| I. پایگاه داده قاعده‌های مهم را نگه می‌دارد | ✅ | یکتایی ایمیل بین عضو و admin با همان ایندکس یکتا (R1). تصمیم و ارسال دوباره UPDATE شرطی‌اند و شمار ردیف‌ها تصمیم می‌گیرد (R6). CHECKها برای دلیل رد و `submitted_at`. سابقه با trigger فقط اضافه می‌شود (R11). |
| II. monolith ماژولی با مرز | ✅ | ماژول تازه‌ی `moderation` با پنج فایل و قرارداد import-linter خودش. فهرست قراردادهای `core`، `devdata` و همه‌ی ماژول‌ها هم به‌روز می‌شود. هیچ سرویس یا زیرساخت تازه‌ای نیست (R4، R12). `listings` رزرو زنده را با SQL ساده می‌خواند، مثل `search`، تا import دوری ساخته نشود (R8). |
| III. قرارداد اول | ✅ | contracts/api.md؛ `openapi.json` با `export-openapi` به‌روز و با `test_openapi_contract.py` سنجیده می‌شود. همه‌ی endpointها در Swagger، با مثال و خطا. سه کد خطای تازه، و هیچ کد موجودی عوض نمی‌شود. |
| IV. تست روی زیرساخت واقعی | ✅ | هر سناریوی پذیرش یک تست دارد (quickstart). مسابقه‌ی دو تصمیم و ویرایش هم‌زمان با تأیید ساخته می‌شود. upgrade و downgrade تست می‌شوند. e2e `moderation.spec.ts` فرمان را در image واقعی اجرا می‌کند. پوشش ≥ 90٪. SC-008 زمان روی سخت‌افزار است: دستی، طبق quickstart، و ثبت در `docs/backend-design.md`. |
| V. حریم خصوصی و امنیت | ✅ | نشانی دقیق فقط برای میزبان، مهمانِ پرداخت‌کرده، و admin در بازبینی، و هر دیدن admin ثبت می‌شود (R11). admin فقط با فرمان سرور ساخته می‌شود (R14). endpointهای admin با `CARAVANSARA_ADMIN_HOST` به زیردامنه محدود می‌شوند و ورود admin می‌خواهند (R12، R13). ورود admin محدودیت تلاش دارد (R3). ایمیل و نشانی در log نیستند. رمز در آرگومان فرمان نیست. `/metrics` دست نمی‌خورد. |
| VI. قابل مشاهده | ✅ | endpointهای تازه از همان middleware، با route template. شمارنده‌ی رویدادهای بازبینی و gaugeهای صف از worker، با ردیف Grafana. `test_monitoring_config.py` آن‌ها را می‌سنجد (R10). |
| VII. ساده، و اندازه‌گیری پیش از بهینه‌سازی | ✅ | ایندکس‌های جستجو دست نمی‌خورند، چون اندازه‌گیری سودی نشان نداد (R9). تنها ایندکس تازه، صف جزئی، برای خواندن صف و gauge است و روی bulk در 48 ms ساخته شد (R5). کش نیست. |
| Workflow | ✅ | research هر فرض را با منبع سنجیده است. در tasks، کارهای یک فایل کنار هم می‌آیند. converge پیش از PR. branch دستی `004-listing-approval`. |

**Re-check پس از Phase 1**: data-model و contracts هیچ اصلی را نقض نمی‌کنند، و Complexity Tracking خالی است.

### Project Structure

#### Documentation (this feature)

```text
specs/backend
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── cli.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

#### Source Code (repository root)

```text
backend/
├── migrations/versions/0006_listing_review.py        # تازه (R5، R16)
├── src/caravansara/
│   ├── core/
│   │   ├── config.py           # admin_token_minutes، admin_host
│   │   ├── security.py         # توکن admin و current_admin_id (فقط decode)
│   │   └── metrics.py          # LISTING_REVIEW_EVENTS، دو gauge صف، برچسب admin_login
│   ├── identity/               # kind، disabled_at؛ admin_login، require_active_admin، create_admin، disable_admin؛ login فقط member
│   ├── listings/               # review_status و سابقه؛ تشخیص ویرایش توصیفی؛ resubmit؛ دیدن آگهی غیرعمومی؛ سرویس‌های صف و تصمیم
│   ├── moderation/             # تازه: router، service، repository، models (admin_address_views)، schemas
│   ├── bookings/service.py     # is_public به‌جای is_active
│   ├── reviews/                # بیننده‌ی اختیاری و قاعده‌ی دیدن
│   ├── search/repository.py    # l.review_status = 'approved'
│   ├── jobs/runner.py          # gaugeهای صف در هر اجرا
│   ├── devdata/bulk.py         # review_status در COPY
│   ├── cli.py                  # create-admin، disable-admin، قفل production برای seed-demo
│   └── main.py                 # router admin
├── pyproject.toml              # قرارداد import-linter برای moderation
├── openapi.json                # export-openapi
└── tests/                      # test_listing_review.py، test_admin.py، و بقیه به‌روز
db/
├── schema.sql, schema.dbml, erd.mmd, erd.png, search_query.sql, README.md
├── demo/build_demo_seed.py, demo/README.md, demo/edge_cases.json → seed_demo.sql
└── bulk/queries/           # کوئری‌های جستجو با شرط تازه
e2e/tests/moderation.spec.ts                      # تازه
observability/grafana/dashboards/caravansara.json # ردیف Listing review
docs/backend-design.md, docs/future-work.md (بخش ۱ برداشته می‌شود), README.md, CONTEXT.md, PDF
```

**Structure Decision**: همان monolith امروز در `backend/`، با ماژول تازه‌ی `moderation`. فرانت‌اند و پنل admin در این کار نیستند.

### Complexity Tracking

هیچ نقضی نیست. دو افزوده که ممکن است اضافه به نظر برسند، با دلیل:

| افزوده | چرا لازم است | گزینه‌ی ساده‌تر و چرا رد شد |
|---|---|---|
| `review_version` | بدون آن، تأیید admin می‌توانست ویرایشی را که ندیده عمومی کند (Edge Cases، R6). | قفل ردیف به‌تنهایی: admin بین دیدن و تصمیم قفلی نگه نمی‌دارد. |
| `CARAVANSARA_ADMIN_HOST` | constitution 1.3.0: ابزار admin فقط روی زیردامنه‌ی خودش در دسترس است (R12). | سرویس API جدا: اصل II بدون عدد مانیتورینگ نمی‌پذیرد. |
