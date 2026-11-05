# Implementation Plan: قیمت ریالی بدون سرریز

**Branch**: `002-rial-price-columns` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-rial-price-columns/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

رزرو چندشبه با قیمت ریالی امروز خطای ۵۰۰ می‌دهد، چون جمع رزرو در ستون `NUMERIC(10,2)` جا نمی‌شود (research R1). راه: migration `0002` که پنج ستون مبلغ را `NUMERIC(14,2)` می‌کند (فقط metadata، بدون بازنویسی جدول؛ R3). سقف ورودی قیمت از ۱۰ رقم به یک میلیارد می‌رسد، و در `openapi.json` دیده می‌شود (R4). بررسی جمع رزرو پیش از درج، با کد تازه‌ی `amount_too_large` (R5). و داده‌ی دمو ایران با قیمت واقعی بازار (R7).

## Technical Context

**Language/Version**: Python 3.13 (uv)

**Primary Dependencies**: FastAPI، Pydantic v2، SQLAlchemy 2 async + asyncpg، Alembic

**Storage**: PostgreSQL 16 + PostGIS؛ فقط نوع پنج ستون عوض می‌شود

**Testing**: pytest + testcontainers (PostgreSQL و MinIO واقعی)، پوشش ≥ ۹۰٪

**Target Platform**: Linux container (`docker compose`)

**Project Type**: web-service (بکند API)

**Performance Goals**: migration روی پایگاه داده‌ی حجیم (۱۰۰ هزار آگهی، ۳ میلیون رزرو) فوری، چون جدول بازنویسی نمی‌شود (R3)

**Constraints**: هیچ مبلغی پاسخ ۵۰۰ ندهد؛ downgrade بدون از دست رفتن داده؛ شکل پاسخ‌های API ثابت بماند

**Scale/Scope**: ۵ ستون، ۱ migration، ۱ کد خطای تازه، ۴۰ آگهی دمو

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل | وضعیت | دلیل |
| --- | --- | --- |
| I. پایگاه داده نگهبان قانون‌های حیاتی | ✅ | ظرفیت ستون نگهبان نهایی مبلغ است. بررسی `amount_too_large` در کد فقط برای پیام روشن است (R5). این قانون مسابقه‌ای نیست، پس قید تازه‌ای لازم ندارد. |
| II. مونولیت ماژولار | ✅ | ماژول تازه‌ای نیست. `MAX_PRICE` در `listings` و `MAX_STORED_AMOUNT` در `bookings` می‌مانند، و هیچ import تازه‌ای بین ماژول‌ها نیست. |
| III. قرارداد API اول | ✅ | تغییر در spec شروع شد و در `openapi.json` دیده می‌شود (`maximum`، [contracts/api.md](contracts/api.md)). کد تازه‌ی `amount_too_large` در جدول خطای سند طراحی ثبت می‌شود. هیچ کدی عوض یا حذف نمی‌شود. |
| IV. تست روی زیرساخت واقعی | ✅ | هر سناریوی پذیرش تست خودکار روی PostgreSQL واقعی دارد ([quickstart.md](quickstart.md)). downgrade در هر دو حالت (جا می‌شود / جا نمی‌شود) آزموده می‌شود. معیار زمانی‌ای در spec نیست. |
| V. حریم خصوصی و امنیت | ✅ | داده‌ی شخصی تازه‌ای نیست. |
| VI. مشاهده‌پذیری | ✅ | endpoint یا job تازه‌ای نیست. `amount_too_large` رویداد کسب‌وکاری برای پایش نیست، چون با تنظیم پیش‌فرض رخ نمی‌دهد؛ مثل بقیه‌ی ۴۲۲ها در متریک درخواست دیده می‌شود. |
| VII. ساده، و اول اندازه‌گیری | ✅ | ساده‌ترین راه: پهن کردن نوع، نه تغییر مدل پول (R2). |
| Alembic منبع schema؛ downgrade آزموده | ✅ | migration `0002` با downgrade و تست؛ `db/schema.sql` و DBML به‌روز می‌شوند (R8). |
| یک فرمان `docker compose` | ✅ | سرویس `migrate` همان `0002` را اجرا می‌کند. |
| روند کار (اسناد) | ✅ | تصمیم‌ها به `docs/backend-design.md` و PDF آن می‌روند. بخش ۲ از `docs/future-work.md` حذف می‌شود. README و CONTEXT به‌روز می‌شوند. |

**بازبینی بعد از طراحی (Phase 1)**: data-model، قرارداد و quickstart هیچ نقضی نساختند. Complexity Tracking خالی است.

## Project Structure

### Documentation (this feature)

```text
specs/002-rial-price-columns/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── api.md           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

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

## Complexity Tracking

خالی: Constitution Check هیچ نقضی ندارد.
