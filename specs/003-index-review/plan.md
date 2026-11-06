# Implementation Plan: بررسی ایندکس‌ها با اندازه‌گیری

**Branch**: `003-index-review` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-index-review/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

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

## Technical Context

**Language/Version**: Python 3.13 (uv)

**Primary Dependencies**: FastAPI، SQLAlchemy 2 async + asyncpg، Alembic؛ postgres-exporter v0.17.1، Grafana

**Storage**: PostgreSQL 16.4 + PostGIS؛ extension تازه‌ی `pg_stat_statements`؛ ایندکس‌های تازه یا حذف‌شده روی `bookings`، `listings` و `listing_amenities`

**Testing**: pytest + testcontainers؛ زمان‌ها با دست و طبق quickstart (اصل IV، 1.1.0)

**Target Platform**: Linux container (`docker compose`)

**Project Type**: web-service (بکند API) + ابزار توسعه

**Performance Goals**: میانه‌ی هر کوئری مهم ≤ ۵۰ ms با cache گرم روی داده‌ی حجیم (FR-005)؛ هیچ کوئری مهمی بیش از ۱۰٪ کندتر نشود (SC-004)

**Constraints**: رفتار API و `openapi.json` ثابت (FR-009)؛ قیدهای حیاتی دست نمی‌خورند (FR-010، اصل I)؛ هیچ داده‌ای در migration عوض نمی‌شود (FR-008)

**Scale/Scope**: حدود ۳۰ کوئری در فهرست، ۷ نامزد ایندکس، ۲ بازنویسی کوئری، ۳ migration، ۱ فرمان CLI، ۱ پنل داشبورد

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل | وضعیت | دلیل |
| --- | --- | --- |
| I. پایگاه داده نگهبان قانون‌ها | ✅ | ایندکس‌های پشت `EXCLUDE`، `UNIQUE` و کلید خارجی حذف یا عوض نمی‌شوند (R7). Hash جای `idempotency_key` را نمی‌گیرد، چون unique را پشتیبانی نمی‌کند. تست‌های مسابقه بدون تغییر پاس می‌شوند. |
| II. مونولیت ماژولار | ✅ | ابزار در `caravansara.devdata` است، بسته‌ی ابزاری که فقط `core` را import می‌کند (قاعده‌ی 1.1.0) و در production اجرا نمی‌شود. بازنویسی کوئری‌ها در repository همان ماژول‌ها (`search`، `bookings`) می‌ماند. |
| III. قرارداد API اول | ✅ | API عوض نمی‌شود. `openapi.json` همان می‌ماند، و تست قرارداد این را ثابت می‌کند. فرمان CLI قرارداد خودش را دارد ([contracts/cli.md](contracts/cli.md)). |
| IV. تست روی زیرساخت واقعی | ✅ | بخش‌های غیرزمانی تست خودکار روی PostgreSQL واقعی دارند: پوشش فهرست، اعتبار SQL، استفاده از ایندکس با `enable_seqscan = off`، migration و downgrade، و ثابت ماندن داده با `measure-queries`. زمان‌ها با دست و طبق quickstart اندازه گرفته و در سند طراحی ثبت می‌شوند، که قاعده‌ی 1.1.0 اجازه می‌دهد. |
| V. حریم خصوصی و امنیت | ✅ | `pg_stat_statements` متن کوئری را با پارامترهای جایگزین‌شده (`$1`) نگه می‌دارد، نه مقدارها. پس ایمیل یا رمز در آمار نمی‌آید. exporter و Grafana مثل قبل فقط داخل compose هستند. |
| VI. مشاهده‌پذیری | ✅ | پنل تازه از متریک‌هایی ساخته می‌شود که exporter واقعاً می‌دهد، و `tests/test_monitoring_config.py` آن را بررسی می‌کند (R9). |
| VII. ساده، و اول اندازه‌گیری | ✅ | همین کار است: هر ایندکس از اندازه‌گیری شروع و با اندازه‌گیری تمام می‌شود. نامزدی که سود ندارد ساخته نمی‌شود. کش در این کار نیست. |
| Alembic؛ downgrade آزموده | ✅ | migrationهای `0003` تا `0005` با downgrade و تست. `db/schema.sql` و DBML به‌روز می‌شوند. |
| یک فرمان `docker compose` | ✅ | فقط `command` سرویس `db` و exporter عوض می‌شوند. همان یک فرمان کافی است. |
| روند کار (1.2.0) | ✅ | research با منبع واقعی سنجیده شد (R1–R10، با روش هر عدد). کارهای هر فایل در `tasks.md` کنار هم می‌آیند. converge پیش از PR اجرا می‌شود. branch با دست ساخته شده است. |

**بازبینی بعد از طراحی (Phase 1)**: data-model، قرارداد و quickstart نقضی نساختند. Complexity Tracking خالی است.

## Project Structure

### Documentation (this feature)

```text
specs/003-index-review/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── cli.md           # Phase 1 output (/speckit-plan command)
├── captured-sql.json    # SQL واقعی برنامه، ضبط‌شده در research (R1)
├── measurements.md, before.json, after.json   # اندازه‌گیری‌ها و آزمایش‌ها (implement)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

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

## Complexity Tracking

خالی: Constitution Check هیچ نقضی ندارد.
