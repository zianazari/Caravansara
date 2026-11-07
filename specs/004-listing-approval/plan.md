# Implementation Plan: تأیید آگهی توسط مدیر سیستم (admin)

**Branch**: `004-listing-approval` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-listing-approval/spec.md`

## Summary

آگهی تازه با وضعیت «در انتظار» ساخته می‌شود و فقط وقتی عمومی است که هم تأییدشده و هم فعال باشد.

- **حساب admin:** نوع جدایی در همان جدول `users` است (`kind = 'admin'`). فقط فرمان سرور آن را می‌سازد، و ورود و توکن خودش را دارد. توکن admin به هیچ endpoint میزبان یا مهمان نمی‌رسد، پس admin با ساختار سیستم آگهی ثبت نمی‌کند و رزرو نمی‌کند.
- **ماژول `moderation`:** ماژول تازه‌ای که صف، جزئیات (با نشانی دقیق و ثبت هر دیدن)، تأیید و رد را دارد.
- **وضعیت بازبینی و سابقه:** در `listings` می‌مانند، کنار ویرایش آگهی. ویرایش توصیفی آگهی تأییدشده آن را به صف برمی‌گرداند.
- **تصمیم‌ها:** UPDATE شرطی با `review_version`، تا دو تصمیم هم‌زمان یا ویرایش هم‌زمان هیچ نسخه‌ی بازبینی‌نشده‌ای را عمومی نکنند.
- **آگهی‌های موجود:** با پیش‌فرض ستون، بدون بازنویسی جدول، تأییدشده می‌شوند.

## Technical Context

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

## Constitution Check

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

## Project Structure

### Documentation (this feature)

```text
specs/004-listing-approval/
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

### Source Code (repository root)

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

## Complexity Tracking

هیچ نقضی نیست. دو افزوده که ممکن است اضافه به نظر برسند، با دلیل:

| افزوده | چرا لازم است | گزینه‌ی ساده‌تر و چرا رد شد |
|---|---|---|
| `review_version` | بدون آن، تأیید admin می‌توانست ویرایشی را که ندیده عمومی کند (Edge Cases، R6). | قفل ردیف به‌تنهایی: admin بین دیدن و تصمیم قفلی نگه نمی‌دارد. |
| `CARAVANSARA_ADMIN_HOST` | constitution 1.3.0: ابزار admin فقط روی زیردامنه‌ی خودش در دسترس است (R12). | سرویس API جدا: اصل II بدون عدد مانیتورینگ نمی‌پذیرد. |
