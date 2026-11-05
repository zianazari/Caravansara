---

description: "Task list template for feature implementation"
---

# Tasks: قیمت ریالی بدون سرریز

**Input**: Design documents from `/specs/002-rial-price-columns/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: لازم‌اند. اصل IV قانون اساسی برای هر قاعده‌ی کسب‌وکار و هر سناریوی پذیرش تست خودکار می‌خواهد، و برای migration تست downgrade.

**Organization**: کارها بر اساس user story دسته‌بندی شده‌اند. در هر فاز، کارهایی که یک فایل را تغییر می‌دهند کنار هم آمده‌اند، تا هر فایل یک بار باز و بررسی شود.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: می‌تواند هم‌زمان اجرا شود (فایل جدا، بدون وابستگی به کار ناتمام)
- **[Story]**: user story مربوط (US1، US2، US3)

## Path Conventions

- بکند: `backend/src/caravansara/`، تست‌ها: `backend/tests/`، migrationها: `backend/migrations/versions/`
- داده و schema: `db/`
- اسناد: `docs/`، `README.md`، `CONTEXT.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: نقطه‌ی شروع روشن، تا هر شکست بعدی به همین کار نسبت داده شود.

- [X] T001 در `backend/` اجرای `uv run pytest -q` روی همین branch (پیش از هر تغییر) پاس شود و تعداد تست و پوشش یادداشت شود (امروز ۲۰۲ تست، ۹۸٫۰٪)؛ `uv run alembic heads` فقط `0001` را نشان دهد.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: ستون‌های پهن‌تر. همه‌ی storyها به آن وابسته‌اند، چون بدون آن هیچ مبلغ بزرگ‌تری ذخیره نمی‌شود.

**⚠️ CRITICAL**: هیچ کار user storyای پیش از پایان این فاز شروع نمی‌شود.

- [X] T002 [P] نوشتن تست‌های migration در `backend/tests/test_migrations.py`، در همان پایگاه داده‌ی جدای `migration_check` که تست فعلی می‌سازد (FR-005، SC-004):
  - بعد از `migrate`، هر پنج ستون (`listings.price_per_night`، `listings.cleaning_fee`، `bookings.nightly_price`، `bookings.cleaning_fee`، `bookings.total_price`) در `information_schema.columns` دارای `numeric_precision = 14` و `numeric_scale = 2` باشند.
  - مقدارهای موجود حفظ شوند: پیش از `0002` (با `command.upgrade(config, "0001")`) یک آگهی و یک رزرو با مبلغ‌های `99999999.99` و `12.34` درج شود، بعد از `upgrade head` همان مقدارها خوانده شوند.
  - downgrade به `0001` وقتی همه‌ی مقدارها جا می‌شوند انجام شود و نوع به `numeric(10,2)` برگردد.
  - downgrade وقتی یک `total_price = 36505000000.00` ذخیره است با خطای `22003` (`numeric field overflow`) شکست بخورد، هر پنج ستون همچنان `numeric(14,2)` بمانند، `alembic_version` همچنان `0002` باشد و مقدار ردیف عوض نشده باشد.
  - تست فعلی `test_downgrade_and_upgrade_again` (`base` و برگشت) همچنان پاس شود.
- [X] T003 ساختن `backend/migrations/versions/0002_wider_price_columns.py` (`revision = "0002"`، `down_revision = "0001"`): upgrade با دو دستور `op.execute`، یکی برای هر جدول: `ALTER TABLE listings ALTER COLUMN price_per_night TYPE NUMERIC(14,2), ALTER COLUMN cleaning_fee TYPE NUMERIC(14,2)` و `ALTER TABLE bookings ALTER COLUMN nightly_price TYPE NUMERIC(14,2), ALTER COLUMN cleaning_fee TYPE NUMERIC(14,2), ALTER COLUMN total_price TYPE NUMERIC(14,2)`. downgrade همان‌ها با `NUMERIC(10,2)`. docstring دلیل (research R1–R3) و رفتار downgrade را بگوید: «اگر مقداری جا نشود، PostgreSQL با 22003 متوقف می‌شود و تراکنش برمی‌گردد؛ چیزی گرد یا کوتاه نمی‌شود». قیدهای `CHECK (price_per_night > 0)` و `CHECK (cleaning_fee >= 0)` و `DEFAULT 0` دست نمی‌خورند.
- [X] T004 [P] در `backend/src/caravansara/listings/models.py` ستون‌های `price_per_night` و `cleaning_fee` را `Numeric(14, 2)` کن.
- [X] T005 [P] در `backend/src/caravansara/bookings/models.py` ستون‌های `nightly_price`، `cleaning_fee` و `total_price` را `Numeric(14, 2)` کن.
- [X] T006 [P] در `db/schema.sql` پنج ستون را `NUMERIC(14,2)` کن، با یک خط توضیح کنار `-- price + times` و `-- price snapshot…`: «14,2: ریال؛ بیشترین جمع = 1e9 × 365 + 1e9 (specs/002)». در `db/schema.dbml` همان پنج ستون را `"numeric(14,2)"` کن. `db/erd.mmd` و `db/erd.png` عوض نمی‌شوند (research R8).

**Checkpoint**: `uv run pytest tests/test_migrations.py -q` پاس شود.

---

## Phase 3: User Story 1 - رزرو طولانی با قیمت ریالی (Priority: P1) 🎯 MVP

**Goal**: آگهی با ۱۰۰ میلیون ریال برای هر شب ساخته شود و رزرو ۳۶۵ شبه‌ی آن با جمع درست ثبت شود.

**Independent Test**: آگهی با قیمت ۱۰۰٬۰۰۰٬۰۰۰ ریال ساخته، رزرو ۳۶۵ شبه ثبت، پرداخت و دوباره خوانده شود.

### Tests for User Story 1 ⚠️

> **NOTE: این تست‌ها اول نوشته می‌شوند و باید پیش از پیاده‌سازی شکست بخورند.**

- [X] T007 [P] [US1] در `backend/tests/test_bookings.py` تست `test_rial_stay_of_365_nights` (US1-1، US1-2، SC-001): با `factory.listing(price_per_night="100000000.00", cleaning_fee="5000000.00", currency="IRR")` (از راه API، تا سقف ورودی هم آزموده شود) رزرو `check_in = امروزِ شهر + 1`، `check_out = check_in + 365` با `POST /bookings`. انتظار: ۲۰۱، `nightly_price == "100000000.00"`، `cleaning_fee == "5000000.00"`، `total_price == "36505000000.00"`. سپس `POST /bookings/{id}/pay` موفق، `GET /bookings/{id}` همان سه مبلغ را برگرداند، و رزرو در فهرست رزروهای مهمان و رزروهای آگهیِ میزبان با همان `total_price` دیده شود.
- [X] T008 [P] [US1] در `backend/tests/test_search.py` تست `test_search_total_matches_booking_total_for_long_rial_stay` (US1-3، FR-009): همان آگهی ریالی، جستجو با همان `check_in` و `check_out` (۳۶۵ شب) و شهر آگهی؛ `total_price` نتیجه `"36505000000.00"` باشد و برابر `total_price` رزروی که بعد با همان تاریخ‌ها ساخته می‌شود.

### Implementation for User Story 1

- [X] T009 [US1] در `backend/src/caravansara/listings/schemas.py`: `MAX_PRICE = Decimal("1000000000.00")` با توضیح «سقف قیمت شب و هزینه‌ی نظافت در همه‌ی ارزها (specs/002، Clarification 2026-11-05)»، و `Money = Annotated[Decimal, Field(max_digits=12, decimal_places=2, le=MAX_PRICE)]`. قیدهای فعلی فیلدها (`price_per_night: gt=0`، `cleaning_fee: ge=0`، در `ListingCreate` و `ListingUpdate`) همان بمانند.

**Checkpoint**: T007 و T008 پاس شوند. US1 به‌تنهایی قابل ارائه است: خطای ۵۰۰ رزرو ریالی رفع شده است.

---

## Phase 4: User Story 2 - پیام روشن برای قیمت بیش از سقف (Priority: P2)

**Goal**: قیمت بیش از سقف ۴۲۲ با کد ثابت بگیرد، و هیچ مبلغی ۵۰۰ ندهد.

**Independent Test**: قیمت `1000000000.01` در ساخت و ویرایش آگهی ۴۲۲ بگیرد؛ سقف قیمت با بیشترین طول اقامت ثبت شود؛ جمع بیش از ظرفیت ۴۲۲ `amount_too_large` بگیرد.

### Tests for User Story 2 ⚠️

- [X] T010 [P] [US2] در `backend/tests/test_listings.py` (US2-1، US2-2، SC-002، FR-003):
  - `POST /listings` با `price_per_night: "1000000000.00"` → ۲۰۱.
  - `POST /listings` با `price_per_night: "1000000000.01"` → ۴۲۲، `error.code == "validation_error"`، و `details` شامل `loc` برابر `["body", "price_per_night"]`؛ هیچ آگهی‌ای ساخته نشود.
  - همان برای `cleaning_fee: "1000000000.01"` با `loc` `["body", "cleaning_fee"]`.
  - `PATCH /listings/{id}` با `price_per_night: "1000000000.01"` → ۴۲۲ با همان شکل، و `GET` بعدی قیمت قبلی را نشان دهد.
- [X] T011 [P] [US2] در `backend/tests/test_unit.py`، کلاس تست قواعد رزرو (US2، FR-004): تابع بررسی جمع در `rules` با `Decimal("999999999999.99")` خطا ندهد، و با `Decimal("1000000000000.00")` خطای `Unprocessable` با `code == "amount_too_large"` بدهد. همچنین `rules.total_price` با `MAX_PRICE` و ۳۶۵ شب `Decimal("366000000000.00")` بدهد.
- [X] T012 [US2] در `backend/tests/test_bookings.py` (بعد از T007، همان فایل):
  - `test_max_price_with_longest_stay` (US2-3، SC-003): آگهی با `price_per_night = cleaning_fee = "1000000000.00"`، رزرو ۳۶۵ شبه → ۲۰۱ و `total_price == "366000000000.00"`.
  - `test_total_over_storage_is_422_not_500` (FR-004، edge case تنظیم `max_nights`): یک app جدا با `create_app(prepared.model_copy(update={"max_nights": 1000, "max_days_ahead": 1500}))` و `AsyncClient(transport=ASGITransport(app))` در lifespan آن؛ آگهی با سقف قیمت و رزرو ۹۹۹ شبه → ۴۲۲، `error.code == "amount_too_large"`، و `SELECT count(*) FROM bookings` صفر باشد.

### Implementation for User Story 2

- [X] T013 [US2] در `backend/src/caravansara/bookings/rules.py`: `MAX_STORED_AMOUNT = Decimal("999999999999.99")` با توضیح «ظرفیت NUMERIC(14,2)؛ با MAX_PRICE و max_nights=365 دیده نمی‌شود (specs/002 research R5)»، و `def check_total(total: Decimal) -> None` که اگر `total > MAX_STORED_AMOUNT` باشد `Unprocessable("amount_too_large", "The total for this stay is too large to store.")` بیندازد.
- [X] T014 [US2] در `backend/src/caravansara/bookings/service.py`، در `create_booking`: جمع را یک بار در متغیر حساب کن، `rules.check_total(total)` را پیش از `expire_listing_holds` و ساختن `Booking` صدا بزن، و همان متغیر را به `total_price=` بده.
- [X] T015 [US2] در `backend/`: `uv run caravansara export-openapi` تا `openapi.json` در `ListingCreate` و `ListingUpdate` برای `price_per_night` و `cleaning_fee` مقدار `"maximum": 1000000000.0` بگیرد ([contracts/api.md](contracts/api.md)). diff فقط همین چهار تغییر را داشته باشد، و `tests/test_openapi_contract.py` پاس شود.

**Checkpoint**: T010–T012 پاس شوند، و US1 همچنان پاس باشد.

---

## Phase 5: User Story 3 - داده‌ی دمو با قیمت واقعی بازار ایران (Priority: P3)

**Goal**: آگهی‌های ایران در دمو قیمت واقعی بازار و رزرو طولانی‌تر داشته باشند.

**Independent Test**: دمو روی پایگاه داده‌ی خالی بارگذاری شود؛ بازه‌ی قیمت‌ها و دست‌کم یک قیمت شب و یک جمع ریالی بیش از ۹۹٬۹۹۹٬۹۹۹٫۹۹ بررسی شود.

### Tests for User Story 3 ⚠️

- [X] T016 [P] [US3] در `backend/tests/test_demo_data.py`، تست `test_rial_totals_fit_price_columns` را با `test_rial_prices_are_market_prices` جایگزین کن (US3-1، US3-2، SC-005):
  - قیمت شب خانه‌های کامل (`entire_place`) تهران در `[10000000, 100000000]`، و اتاق‌های (`private_room`، `shared_room`) هر سه شهر ایران در `[2500000, 10000000]`.
  - `max(price_per_night)` ریالی برابر `100000000.00` (بیش از سقف قدیم).
  - `max(total_price)` ریالی بیش از `99999999.99`، و دست‌کم یک رزرو ریالی بیش از ۴ شب.
  - همه‌ی مبلغ‌ها کمتر یا برابر `999999999999.99`.

### Implementation for User Story 3

- [X] T017 [US3] در `db/demo/fa_listings.json`، قیمت‌ها را با قاعده‌ی research R7 عوض کن (با یک اسکریپت یک‌باره، نه دستی، و ترتیب و قالب فایل همان بماند): تهران خانه‌ی کامل × ۵ و گران‌ترین آن دقیقاً `100000000`؛ اصفهان و شیراز خانه‌ی کامل × ۴؛ اتاق‌ها × ۲ با سقف `10000000`؛ `cleaning_fee` با همان ضریب آگهی خودش.
- [X] T018 [US3] در `db/demo/build_demo_seed.py`:
  - بررسی `2_500_000 <= price <= 20_000_000` → «خانه‌ی کامل `10_000_000`–`100_000_000`، اتاق `2_500_000`–`10_000_000`»، با پیام خطای همان شکل.
  - `rng.randint(1, 4)` در هر دو حلقه‌ی رزرو آگهی‌های فارسی → `rng.randint(1, 14)`.
  - `MAX_PRICE_COLUMN = 99_999_999.99` و بررسی `too_big` → `MAX_STORED_AMOUNT = 999_999_999_999.99` (`NUMERIC(14,2)`، specs/002) با همان بررسی برای هر رزرو ریالی، و بررسی تازه‌ی `price_per_night <= 1_000_000_000`.
- [X] T019 [US3] `python3 db/demo/build_demo_seed.py` را دو بار اجرا کن: `db/seed_demo.sql` بازسازی شود و md5 دو اجرا یکی باشد. جدول حالت‌های مرزی در `db/demo/README.md` و `db/demo/edge_cases.json` همان بماند، یا اگر شناسه‌ای عوض شد با خروجی سازنده به‌روز شود. اگر تعداد کاربر، آگهی یا نظر عوض شد، `backend/tests/test_cli.py` (`(2043, 790, 9523)`) با عدد تازه و دلیل آن به‌روز شود.
- [X] T020 [US3] در `db/demo/README.md` بازه‌ی قیمت آگهی‌های ایران (۲٫۵ تا ۲۰ میلیون، حداکثر ۴ شب) را با بازه‌ی تازه و منبع آن (جاباما، 2026-11-05) جایگزین کن، و جمله‌ی دلیل قدیمی (سرریز `NUMERIC(10,2)`) را حذف کن.

**Checkpoint**: `uv run pytest tests/test_demo_data.py tests/test_cli.py -q` پاس شود.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T021 در `docs/backend-design.md`: ردیف `| 422 | amount_too_large | جمع رزرو از ظرفیت ذخیره (999,999,999,999.99) بیشتر است |` به جدول «قرارداد خطا»؛ پهنای `NUMERIC(14,2)` و سقف یک میلیاردی با دلیل در بخش طرح داده؛ و تعداد تست و پوشش تازه. بعد PDF آن (`docs/backend-design.pdf`) با همان روش قبلی (HTML، سپس Chrome `--print-to-pdf`) دوباره ساخته شود.
- [X] T022 در `docs/future-work.md` بخش ۲ (پهن کردن ستون‌های قیمت برای ریال) را حذف کن، بخش‌های بعدی و جدول «ترتیب پیشنهادی» را دوباره شماره بزن، و کار انجام‌شده را به پاراگراف اول اضافه کن.
- [X] T023 [P] در `README.md` جدول «What's next» و شمار تست و پوشش در badge؛ در `CONTEXT.md` خط «Next» و وضعیت کار.
- [X] T024 کنترل کیفیت در `backend/`: `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run lint-imports && uv run pytest -q` همه پاس، و پوشش ≥ ۹۰٪.
- [X] T025 اجرای [quickstart.md](quickstart.md) بخش ۲ تا ۴ روی stack محلی: `docker compose run --rm migrate` پایگاه داده‌ی توسعه را به `0002` ببرد، بدون پاک شدن داده (شمار آگهی و رزرو پیش و پس یکی)؛ دمو در `caravansara_demo` بارگذاری شود؛ و سه گام دستی API نتیجه‌ی گفته‌شده را بدهند.
- [X] T026 اجرای `/speckit-converge` پیش از pull request، و انجام کارهایی که اضافه می‌کند.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: بدون وابستگی.
- **Foundational (Phase 2)**: بعد از Setup؛ همه‌ی storyها را مسدود می‌کند.
- **US1 (Phase 3)**: بعد از Phase 2.
- **US2 (Phase 4)**: بعد از Phase 2. T012 بعد از T007 (همان فایل). T009 (سقف ورودی) برای T010 لازم است.
- **US3 (Phase 5)**: بعد از Phase 2 (ستون پهن برای بارگذاری دمو).
- **Polish (Phase 6)**: بعد از همه‌ی storyها.

### User Story Dependencies

- **US1 (P1)**: فقط Phase 2.
- **US2 (P2)**: Phase 2 و T009 از US1 (همان `Money`).
- **US3 (P3)**: فقط Phase 2.

### Within Each User Story

- تست‌ها اول نوشته می‌شوند و شکست می‌خورند، بعد پیاده‌سازی.
- T013 (rules) پیش از T014 (service).

### Parallel Opportunities

- T002، T004، T005 و T006 فایل‌های جدا دارند.
- T007 و T008 هم‌زمان.
- T010 و T011 هم‌زمان.
- US3 (T016–T020) می‌تواند هم‌زمان با US1 و US2 جلو برود، چون فایل مشترکی ندارد.

---

## Parallel Example: User Story 1

```text
Task: "T007 [US1] test_rial_stay_of_365_nights in backend/tests/test_bookings.py"
Task: "T008 [US1] test_search_total_matches_booking_total_for_long_rial_stay in backend/tests/test_search.py"
```

## Parallel Example: User Story 2

```text
Task: "T010 [US2] price limit tests in backend/tests/test_listings.py"
Task: "T011 [US2] check_total unit tests in backend/tests/test_unit.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 و Phase 2 (migration و مدل‌ها).
2. Phase 3 (US1): خطای ۵۰۰ رزرو ریالی رفع می‌شود.
3. **توقف و بررسی**: T007 و T008 پاس.

### Incremental Delivery

1. Setup + Foundational → ستون‌ها پهن.
2. US1 → رزرو ریالی طولانی کار می‌کند (MVP).
3. US2 → پیام روشن برای قیمت بیش از سقف، و هیچ ۵۰۰ای برای مبلغ.
4. US3 → دمو با قیمت واقعی.
5. Polish → اسناد، کنترل کیفیت، quickstart، converge، و pull request.
