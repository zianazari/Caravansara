---

description: "Task list for feature implementation"
---

# Tasks: تأیید آگهی توسط مدیر سیستم (admin)

**Input**: Design documents from `/specs/004-listing-approval/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/cli.md, quickstart.md

**Tests**: لازم‌اند. constitution اصل IV برای هر قاعده و هر سناریوی پذیرش تست خودکار می‌خواهد، و برای مسیری که فقط بازنده‌ی مسابقه اجرا می‌کند، تستی که همان مسابقه را بسازد. SC-008 زمان روی سخت‌افزار است و با دست، طبق quickstart §۵، اندازه گرفته می‌شود.

**Organization**:
- کارها بر اساس user story دسته‌بندی شده‌اند.
- کارهایی که یک فایل را تغییر می‌دهند، در هر فاز کنار هم آمده‌اند (constitution 1.2.0).
- migration `0006` کامل در Phase 2 است، تا هیچ فایل migration در دو فاز باز نشود.

**قاعده‌ی مستندسازی (مالک پروژه، 2026-11-07)**: هر ساختار تازه (ستون، جدول، تنظیم، سازوکار، تغییر رفتار) دلیل وجود و اثرش را در دو جا می‌گیرد: یک توضیح کوتاه در کد، کنار تعریفش، و بخش مربوط در `docs/backend-design.md` (T058). متن پایه‌ی هر دو جدول «ساختارهای تازه‌ی طراحی» در `docs/future-work.md` بخش ۱ است.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: می‌تواند هم‌زمان اجرا شود (فایل جدا، بدون وابستگی به کار ناتمام)
- **[Story]**: US1 تا US5

## Path Conventions

- **بکند:** `backend/src/caravansara/`
- **تست‌ها:** `backend/tests/`
- **migrationها:** `backend/migrations/versions/`
- **داده:** `db/`
- **e2e:** `e2e/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 خط پایه‌ی کار، روی همین branch و پیش از هر تغییر، در `backend/`:
  - `uv run pytest -q` پاس شود (241 تست).
  - `uv run alembic heads` فقط `0005` را نشان دهد.
- [X] T002 خط پایه‌ی سرعت (SC-008)، پیش از migration تازه:
  - فرمان: `uv run caravansara measure-queries --database caravansara_bulk --out ../specs/004-listing-approval/before.json` روی `caravansara_bulk` (هنوز در `0005`).
  - ثبت در خروجی: تعداد آگهی‌های عمومی bulk با `SELECT count(*) FROM listings WHERE is_active` (research R5: 96961).
  - ثبت در خروجی: همان شمارش روی پایگاه داده‌ی دمو، برای SC-002.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema، نوع حساب، توکن admin و قاعده‌ی «عمومی». هر story به این‌ها تکیه دارد.

**⚠️ CRITICAL**: هیچ کار storyای پیش از پایان این فاز شروع نمی‌شود.

### Migration و تست آن

- [X] T003 نوشتن تست‌های migration در `backend/tests/test_migrations.py` (اول، شکست‌خورده):
  - **upgrade از `0005`** با آگهی‌های فعال و غیرفعال: همه `approved` شوند، و `submitted_at`، `rejection_reason` همه NULL و `review_version = 0` باشند (FR-013، US5/AC1).
  - **پیش‌فرض‌ها:** آگهی تازه بدون مقدار صریح `pending` با `submitted_at` پر ساخته شود. کاربر تازه `kind = 'member'` بگیرد.
  - **CHECKها:** `pending` بدون `submitted_at` رد شود. `rejected` بدون دلیل رد شود. دلیل برای غیر `rejected` رد شود. دلیل فقط فاصله یا بلندتر از 1000 نویسه رد شود.
  - **trigger:** UPDATE یا DELETE روی `listing_review_events` خطا بدهد.
  - **downgrade به `0005`:**
    - آگهی `pending` یا `rejected` با `is_active = false` بماند.
    - ردیف `kind = 'admin'` حذف شود.
    - شمار آگهی‌ها، رزروها و نظرها عوض نشود (R16).
- [X] T004 ساختن `backend/migrations/versions/0006_listing_review.py` طبق data-model.md:
  - **typeها:** `account_kind`، `listing_review_status` و `review_action`.
  - **`users`:** `kind account_kind NOT NULL DEFAULT 'member'` و `disabled_at timestamptz`.
  - **`listings`:**
    - `review_status ... NOT NULL DEFAULT 'approved'`، سپس `SET DEFAULT 'pending'`.
    - `submitted_at timestamptz`، سپس `SET DEFAULT now()`.
    - `rejection_reason text` و `review_version integer NOT NULL DEFAULT 0`.
    - CHECKهای `listings_pending_submitted_check` و `listings_rejection_reason_check`، و ایندکس `listings_review_queue_idx ON listings (submitted_at, id) WHERE review_status = 'pending'`.
  - **`listing_review_events`:** با CHECK `(action = 'rejected') = (reason IS NOT NULL)`، ایندکس `(listing_id, created_at)` و trigger `listing_review_events_append_only`.
  - **`admin_address_views`.**
  - **downgrade:** طبق R16. اول `UPDATE listings SET is_active = false WHERE review_status <> 'approved'`، سپس `DELETE FROM users WHERE kind = 'admin'`، سپس حذف جدول‌ها، ستون‌ها و typeها.
  - **docstring بالای فایل:** چرا پیش‌فرض دو مرحله‌ای است (بدون بازنویسی جدول؛ اندازه‌ی R5)، و چرا downgrade چیزی را عمومی نمی‌کند.
  - **اجرا:** CHECK جدول `auth_attempts` هم گسترش یافت (`admin_login`)، که plan ندیده بود؛ upgrade با `ANALYZE listings` تمام می‌شود (measurements.md)؛ downgrade جدول‌های سابقه را پیش از حذف admin برمی‌دارد، چون به او ارجاع دارند.

### هسته (core)

- [X] T005 [P] در `backend/src/caravansara/core/config.py`:
  - `admin_token_minutes: int = 15`.
  - `admin_host: str = ""`، با توضیح: خالی یعنی endpointهای admin روی هر Host کار می‌کنند؛ پر یعنی فقط روی همان زیردامنه (constitution 1.3.0، R12).
- [X] T006 [P] در `backend/src/caravansara/core/security.py`:
  - `create_access_token` پارامتر `token_type` با مقدار `"access"` یا `"admin"` بگیرد، و عمر توکن admin از `admin_token_minutes` بیاید.
  - `decode_access_token` نوع مورد انتظار را بگیرد. مقدار پیش‌فرض `"access"` است، پس رفتار امروز عوض نمی‌شود.
  - dependencyهای `current_admin_id` و `CurrentAdminId` اضافه شوند. فقط decode می‌کنند، و `core` همچنان هیچ ماژولی را import نمی‌کند.
  - توضیح در کد: توکن admin به `CurrentUserId` نمی‌رسد، و همین است که admin را از ثبت آگهی و رزرو بازمی‌دارد (R1).
- [X] T007 [P] در `backend/src/caravansara/core/metrics.py`:
  - `LISTING_REVIEW_EVENTS = Counter("caravansara_listing_review_events_total", ..., ["event"])` با `submitted`، `approved` و `rejected`، که از ابتدا با 0 ساخته می‌شوند.
  - `LISTING_REVIEW_QUEUE = Gauge("caravansara_listing_review_queue", ...)`.
  - `LISTING_REVIEW_OLDEST_WAIT = Gauge("caravansara_listing_review_oldest_wait_seconds", ...)`.
  - برچسب `admin_login` در `RATE_LIMITED`.
  - توضیح در کد: gaugeها را فقط worker می‌نویسد (R10).

### identity

- [X] T008 در `backend/src/caravansara/identity/models.py`:
  - enum `AccountKind` (`member`، `admin`) و ستون‌های `kind` و `disabled_at` روی `User`.
  - توضیح در کد: چرا همان جدول، با استناد به یکتایی ایمیل (R1).
- [X] T009 در `backend/src/caravansara/identity/repository.py`: `get_user_by_email` پارامتر اختیاری `kind` بگیرد.
- [X] T010 در `backend/src/caravansara/identity/service.py`:
  - `login` فقط حساب `member` را بپذیرد. حساب admin همان `invalid_credentials` را بگیرد.
  - `admin_login(session, settings, email, password, ip)`: همان `auth_attempts` با `action = 'admin_login'`، همان سقف‌ها، و `TooManyAttempts("admin_login")`. حساب `member` یا از کار افتاده `invalid_credentials` بگیرد. خروجی `AdminTokenOut` است، بدون refresh token (R2، R3).
  - `require_active_admin(session, admin_id)`: اگر ردیف نیست، `kind <> 'admin'` است یا `disabled_at` پر است، `Unauthorized(code="invalid_token")`.
  - `create_admin(session, email, password, full_name)`: اگر هر حسابی با آن ایمیل هست، `AdminRefused("an account with this email already exists; admin accounts are always new")`. `IntegrityError` ایمیل یکتا هم همان خطا را بدهد.
  - `disable_admin(session, email)`: `AdminRefused` برای «no admin account with this email» و «this admin account is already disabled».
  - توضیح در کد کنار `require_active_admin`: چرا در هر درخواست، یعنی از کار انداختن بی‌درنگ اثر کند (R2).
- [X] T011 در `backend/src/caravansara/identity/schemas.py`: `AdminTokenOut` با `access_token`، `token_type = "bearer"` و `expires_in`، با مثال.

### listings: مدل و قاعده‌ی «عمومی»

- [X] T012 در `backend/src/caravansara/listings/models.py`:
  - enumهای `ReviewStatus` و `ReviewAction`.
  - ستون‌های `review_status`، `submitted_at`، `rejection_reason` و `review_version` روی `Listing`.
  - مدل `ListingReviewEvent`.
  - توضیح کنار `review_version`: چرا وجود دارد و چه چیزی آن را بالا می‌برد. متن پایه در future-work بخش ۱.
- [X] T013 در `backend/src/caravansara/listings/repository.py`:
  - `has_live_booking(session, listing_id, guest_id)`: یک `EXISTS` با `text()` روی `bookings`، با `status IN ('pending','confirmed','completed') AND (status <> 'pending' OR hold_expires_at > now())`.
  - توضیح در کد: چرا SQL ساده و نه `bookings.service`، یعنی import دوری (R8).
  - `add_review_event(...)`.
  - `decide(session, listing_id, version, status, reason)`: UPDATE شرطی `WHERE id = :id AND review_status = 'pending' AND review_version = :v RETURNING id` (R6).
  - `resubmit(session, listing_id, host_id)`: UPDATE شرطی `WHERE review_status = 'rejected'`.
  - `review_queue(limit, offset)`، مرتب بر `(submitted_at, id)`.
  - `review_queue_stats()`: `count(*)` و `min(submitted_at)` روی ایندکس صف.
  - **اجرا (یافته‌ی C1 analyze):** چهار کوئری اندازه‌گیری‌شده (`listing_live_booking`، `review_queue_page`، `review_queue_count`، `review_queue_stats`) و چهار تابع کنارگذاشته با دلیل به `db/bulk/queries/catalog.json` اضافه شدند، و رونوشت‌های `SELECT listings…` و `SELECT users…` ستون‌های تازه را گرفتند.
- [X] T014 در `backend/src/caravansara/listings/schemas.py`:
  - `ListingReview` (`status`، `rejection_reason`، `submitted_at`).
  - فیلد `review: ListingReview | None` در `ListingOut` و `ListingSummary`.
  - `AdminQueueItem`، `AdminQueuePage` و `AdminListingOut` طبق contracts/api.md، با مثال.
- [X] T015 در `backend/src/caravansara/listings/service.py`:
  - `ListingInfo` فیلدهای `review_status` و `is_public` (`is_active and review_status == approved`) بگیرد.
  - تابع کمکی `_visible_to(session, listing, viewer_id)`: میزبان، یا آگهی عمومی، یا `has_live_booking` (FR-002، FR-019).
  - `require_visible_listing(session, listing_id, viewer_id)` برای ماژول‌های دیگر. آگهی نادیدنی `NotFound` بگیرد.
  - `_detail` فیلد `review` را فقط برای میزبان پر کند.

### factory تست‌ها

- [X] T016 در `backend/tests/factories.py`:
  - `listing(..., approved: bool = True)`: پس از ساختن از راه API، اگر `approved` است، آگهی را با SQL مستقیم `approved` کند. تست‌های امروز جستجو، آگهی و رزرو آگهی عمومی می‌خواهند، و باید بدون تغییر پاس شوند (SC-007).
  - `admin(name)`: حساب admin را با `identity.service.create_admin` بسازد و توکن admin را با `admin_login` بگیرد.
  - توضیح کنار `approved=True`: همین دلیل.
  - **اجرا:** پیش‌فرض `approved=True` در خود `tests/helpers.py::create_listing` است، نه فقط factory، چون بیشتر تست‌ها آگهی را مستقیم با آن helper می‌سازند. پاک‌سازی دو تست (`test_search.py`، `test_jobs.py`) که آگهی را `DELETE` می‌کردند به `TRUNCATE` تبدیل شد، چون سابقه‌ی فقط افزودنی حذف آگهی را رد می‌کند.

**Checkpoint**:
- `uv run pytest -q` همه‌ی تست‌های امروز را پاس کند (SC-007).
- `uv run pytest tests/test_migrations.py -q` پاس شود.
- `uv run mypy` پاس شود.

---

## Phase 3: User Story 4 - حساب مدیر سیستم فقط با فرمان ساخته می‌شود (Priority: P1)

**Goal**: فرمان‌های `create-admin` و `disable-admin`، ورود admin، و هیچ راه عمومی به حساب admin.

**Independent Test**: فرمان admin می‌سازد. با آن وارد می‌شوند. ساختن آگهی و رزرو با آن رد می‌شود. از کار انداختن دسترسی را قطع می‌کند. ثبت‌نام یا ویرایش پروفایل با هر داده‌ای admin نمی‌سازد.

### Tests for User Story 4 ⚠️

- [X] T017 [P] [US4] نوشتن `backend/tests/test_admin.py` (اول، شکست‌خورده):
  - **US4/AC1:** `create_admin` حساب `admin` می‌سازد، و `POST /api/v1/admin/auth/login` توکن `type: admin` و `expires_in = 900` می‌دهد.
  - **US4/AC2:** ایمیل عضو موجود و ایمیل admin موجود هر دو رد شوند، و هیچ ردیفی عوض نشود. ایمیل با حروف بزرگ دیگر هم رد شود.
  - **US4/AC3:** پس از `disable_admin`، درخواست بعدی admin با همان توکن `401 invalid_token` بگیرد، ورود دوباره `401 invalid_credentials` بگیرد، و ردیف‌های سابقه‌اش بمانند.
  - **US4/AC4 و SC-005:**
    - `POST /auth/register` با `"kind": "admin"` حساب `member` بسازد.
    - `PATCH /me` با `"kind": "admin"` آن را عوض نکند.
    - هیچ مسیری در `openapi.json` جز `/admin/auth/login` با حساب admin کار نکند.
  - **US4/AC5:** توکن admin روی `POST /listings`، `POST /bookings` و `GET /me` `401 invalid_token` بگیرد.
  - **ورود عادی:** `POST /auth/login` با ایمیل و رمز درست admin `401 invalid_credentials` بگیرد.
  - **محدودیت تلاش:** پس از `login_max_failures` تلاش ناموفق، `429 too_many_attempts` و شمارنده‌ی `admin_login`. تلاش‌های ناموفق ورود عادی سقف admin را پر نکنند.
- [X] T018 [P] [US4] در `backend/tests/test_cli.py`:
  - **`create-admin`:** با `CARAVANSARA_ADMIN_PASSWORD` کد 0 و `admin created: <id>` بدهد، و ایمیل در خروجی نباشد. ایمیل موجود کد 1 و پیام contracts/cli.md را بدهد. رمز کوتاه‌تر از 8 کد 1 بدهد. بدون متغیر، `getpass` دو بار پرسیده شود (monkeypatch)، و دو رمز نابرابر کد 1 بدهد.
  - **`disable-admin`:** کد 0. ایمیل عضو، ایمیل ناموجود و حساب از کار افتاده هر کدام کد 1 بدهند.
  - **`seed-demo`:** با `environment = production`، `refused: demo data is for development only` و کد 1.

### Implementation for User Story 4

- [X] T019 [US4] در `backend/src/caravansara/cli.py`:
  - زیرفرمان‌های `create-admin --email --name` و `disable-admin --email`، طبق contracts/cli.md (R14).
  - رمز از `CARAVANSARA_ADMIN_PASSWORD`، یا `getpass` دو بار، با قاعده‌ی 8 تا 128 نویسه.
  - کد خروج 1 برای `AdminRefused` و خطای رمز.
  - قفل production برای `seed-demo`، با توضیح در کد: دمو رمزهای شناخته‌شده و یک admin دارد (R15).
  - به‌روز کردن docstring بالای فایل.
- [X] T020 [US4] ساختن ماژول `backend/src/caravansara/moderation/`:
  - **`models.py`:** `AdminAddressView`.
  - **`repository.py`:** `record_address_view`.
  - **`schemas.py`:** `AdminLoginIn`، `DecisionIn` (`review_version`) و `RejectIn` (`review_version`، `reason` با `strip` و طول 1 تا 1000).
  - **`service.py`:** فقط از راه `identity.service` و `listings.service`.
  - **`router.py`:**
    - `APIRouter(prefix="/admin", tags=["Admin"])`، با dependency `AdminId` که `CurrentAdminId` و `identity.service.require_active_admin` را پشت سر هم اجرا می‌کند.
    - dependency `admin_host_guard`: اگر `settings.admin_host` پر است و `request.url.hostname` با آن برابر نیست، `NotFound` بدهد (R12).
    - endpoint `POST /admin/auth/login`. فقط guard را دارد و `AdminId` را ندارد.
  - توضیح در router: ترتیب dependencyها یعنی پیش از ورود admin هیچ داده‌ای از آگهی برنمی‌گردد (R13).
- [X] T021 [US4] در `backend/src/caravansara/main.py`: افزودن router `moderation` به `api`.
- [X] T022 [US4] در `backend/pyproject.toml`:
  - قرارداد تازه‌ی «moderation uses other modules only through their service».
  - `caravansara.moderation` در فهرست ممنوعه‌ی `core`، قرارداد `devdata` و قرارداد «feature modules do not use devdata».
  - `moderation.models`، `.repository` و `.router` در فهرست ممنوعه‌ی قرارداد هر ماژول دیگر.

**Checkpoint**:
- `uv run pytest tests/test_admin.py tests/test_cli.py -q` پاس شود.
- `uv run lint-imports` یازده قرارداد را نگه دارد.

---

## Phase 4: User Story 1 - آگهی تازه فقط پس از تأیید عمومی می‌شود (Priority: P1) 🎯 MVP

**Goal**: آگهی در انتظار از هر مسیر عمومی پنهان است. admin صف را می‌بیند، جزئیات را با نشانی دقیق می‌بیند (و ثبت می‌شود)، و تأیید می‌کند.

**Independent Test**: میزبان آگهی می‌سازد. جستجو و صفحه آن را نشان نمی‌دهند، و رزرو رد می‌شود. admin تأیید می‌کند. حالا جستجو و رزرو کار می‌کنند.

### Tests for User Story 1 ⚠️

- [X] T023 [P] [US1] نوشتن `backend/tests/test_listing_review.py`، بخش US1 (اول، شکست‌خورده). هر مسیر عمومی یک تست دارد (SC-001):
  - **مسیرهای عمومی برای آگهی `pending`:**
    - نبودن در `GET /search/listings`، شهری و شعاعی.
    - نبودن در شمارش‌های `GET /search/filters`.
    - `404` در `GET /listings/{id}` بدون توکن، و با توکن کاربر دیگر.
    - `404` در `GET /listings/{id}/reviews`.
    - `404 not_found` در `POST /bookings`، بی‌آنکه هیچ رزروی ساخته شود (US1/AC1، AC3).
  - **دید میزبان (US1/AC2):** `GET /me/listings` و `GET /listings/{id}` برای میزبان `review.status = "pending"` نشان می‌دهند. برای بیننده‌ی دیگرِ آگهی عمومی، `review` برابر `null` است.
  - **صف (US1/AC4):** چند آگهی در انتظار با `submitted_at` متفاوت به ترتیب قدیمی‌ترین برگردند، با `total` درست. آگهی `approved` در صف نباشد.
  - **جزئیات admin:** `private_location`، `review` و `review_version` را داشته باشد. هر فراخوانی دقیقاً یک ردیف `admin_address_views` با admin، آگهی و زمان بنویسد (FR-018، SC-009).
  - **تأیید (US1/AC5):** آگهی از صف بیرون برود و در جستجو باشد. رزرو کار کند. یک ردیف سابقه‌ی `approved` با `actor_id` admin و `review_version` نوشته شود. شمارنده‌ی `approved` یکی بالا برود.
  - **آگهی تأییدشده‌ی غیرفعال (US1/AC6):** پنهان است، و پس از فعال شدن دوباره بدون بازبینی دیده می‌شود.
  - **غیر admin (US1/AC7، FR-020):** بدون توکن، با توکن عضو و با توکن admin از کار افتاده، هر چهار endpoint admin `401` بدهند. برای آگهی ناموجود هم `401` باشد، نه `404`.
  - **تأیید دوباره:** `409 listing_not_pending`.
  - **`admin_host`:** با `admin_host = "admin.example.com"`، درخواست با Host دیگر `404` بگیرد، و با همان Host کار کند.
  - **FR-019:** مهمانی با رزرو `confirmed`، `completed` یا نگه‌داشتِ نگذشته در آگهی پنهان صفحه را می‌بیند (`private_location` فقط پس از پرداخت). مهمانی با رزرو `cancelled`، `expired` یا نگه‌داشتِ گذشته `404` می‌گیرد.
  - **اجرا (یافته‌ی U1 analyze):** `private_location` در صفحه‌ی آگهی مثل قبل فقط برای میزبان است؛ مهمانِ دارای رزرو صفحه را بدون نشانی دقیق می‌بیند، و نشانی را در صفحه‌ی رزرو.
- [X] T024 [P] [US1] در `backend/tests/test_concurrency.py`: دو تأیید هم‌زمان از دو admin روی یک آگهی. دقیقاً یکی `200` بگیرد و دیگری `409 listing_not_pending`، و فقط یک ردیف سابقه نوشته شود (FR-006). این مسیر بازنده است (constitution اصل IV).
- [X] T025 [P] [US1] در `backend/tests/test_search.py`: آگهی `rejected` و `pending` در هیچ‌کدام از جستجوی شهری، شعاعی با تاریخ (هر دو راه `_HASHED_MAX_NIGHTS`) و شمارش‌ها نیامده باشد.
- [X] T026 [P] [US1] در `backend/tests/test_reviews.py`: نظرهای آگهی غیرفعال یا در انتظار برای بیننده‌ی بی‌رزرو `404` بدهد، و برای میزبان و مهمانِ دارای رزرو دیده شود. این رفتار امروز آگهی غیرفعال را عوض می‌کند (future-work بخش ۱، جدول ساختارها).

### Implementation for User Story 1

- [X] T027 [US1] در `backend/src/caravansara/listings/service.py`:
  - `create_listing` پس از flush یک ردیف سابقه‌ی `submitted` با `actor_id = host_id` بنویسد، و `LISTING_REVIEW_EVENTS.labels("submitted")` را پس از commit بالا ببرد.
  - `get_listing` به‌جای `is_active` قاعده‌ی `_visible_to` را به کار ببرد.
  - `my_listings` فیلد `review` بدهد.
  - سرویس‌های admin:
    - `review_queue(session, storage, limit, offset)`.
    - `review_detail(session, storage, listing_id)`: `AdminListingOut`، همیشه با `private_location`.
    - `approve(session, listing_id, admin_id, version)` و `reject(session, listing_id, admin_id, version, reason)`. هر دو از `repo.decide` استفاده می‌کنند. اگر هیچ ردیفی عوض نشود، وضعیت دوباره خوانده می‌شود: دیگر `pending` نیست ← `Conflict("listing_not_pending", ...)`؛ نسخه عوض شده ← `Conflict("listing_changed", ...)`. سابقه در همان تراکنش نوشته می‌شود، و شمارنده پس از commit بالا می‌رود.
  - `review_queue_stats(session)` برای worker.
  - توضیح در کد کنار `approve` و `reject`: چرا UPDATE شرطی و `review_version` (R6).
- [X] T028 [US1] در `backend/src/caravansara/moderation/service.py` و `backend/src/caravansara/moderation/router.py`:
  - `GET /admin/listings/pending` (`PageDep`)، `GET /admin/listings/{listing_id}`، `POST /admin/listings/{listing_id}/approve`، `POST /admin/listings/{listing_id}/reject`. هر کدام با `summary`، `description`، `error_responses(...)` و مثال، طبق contracts/api.md.
  - `review_detail` و `record_address_view` در یک تراکنش.
  - `reject` در این فاز فقط مسیر router است. رفتار و تستش در US2 می‌آیند.
- [X] T029 [US1] در `backend/src/caravansara/search/repository.py`:
  - `_where` شرط `l.review_status = 'approved'` را کنار `l.is_active` بگیرد.
  - به‌روز کردن docstring بالای فایل: «فقط آگهی عمومی: فعال و تأییدشده».
  - توضیح در کد: ایندکس‌های جزئی `WHERE is_active` همچنان به کار می‌روند، و شرط تازه فقط یک Filter است (اندازه‌ی R9).
- [X] T030 [US1] در `backend/src/caravansara/bookings/service.py`: `create_booking` به‌جای `info.is_active` شرط `info.is_public` را بررسی کند، با همان `NotFound("Listing not found.")` (FR-011).
- [X] T031 [US1] در `backend/src/caravansara/reviews/router.py` و `backend/src/caravansara/reviews/service.py`:
  - `GET /listings/{listing_id}/reviews` بیننده‌ی `OptionalUserId` بگیرد.
  - `listing_reviews` به‌جای `get_listing_info`، `listings.require_visible_listing(session, listing_id, viewer_id)` را صدا بزند.
  - به‌روز کردن `description` endpoint.
- [X] T032 [US1] در `backend/src/caravansara/listings/router.py`: به‌روز کردن `description` مسیرهای `GET /listings/{listing_id}`، `GET /me/listings` و `POST /listings`، طبق contracts/api.md («آگهی تازه در انتظار تأیید است…»).
- [X] T033 [P] [US1] در `db/search_query.sql` و `db/bulk/queries/search_*.sql` و `db/bulk/queries/filters_*.sql`: افزودن شرط `l.review_status = 'approved'`، تا رونوشت‌ها با SQL واقعی برابر بمانند (`tests/test_query_catalog.py`).
  - **اجرا (یافته‌ی I1 analyze):** `test_query_catalog.py` برابری متن را نمی‌سنجد، فقط پوشش و اجرا؛ رونوشت‌ها با دست هم‌خوان شدند و quickstart درست شد.

**Checkpoint**:
- `uv run pytest tests/test_listing_review.py tests/test_search.py tests/test_reviews.py tests/test_concurrency.py -q` پاس شود.
- این‌جا MVP کامل است: آگهی تازه فقط پس از تأیید admin عمومی می‌شود.

---

## Phase 5: User Story 5 - آگهی‌های موجود همچنان دیده می‌شوند (Priority: P1)

**Goal**: داده‌ی دمو و حجیم پس از نصب همان آگهی‌های عمومی را دارند. دمو یک آگهی در انتظار، یک آگهی ردشده و یک admin دارد.

**Independent Test**: شمار آگهی‌های عمومی پیش و پس از نصب، روی دمو و حجیم، یکی است.

### Tests for User Story 5 ⚠️

- [X] T034 [P] [US5] در `backend/tests/test_demo_data.py`:
  - پس از `seed-demo`، همه‌ی آگهی‌ها `approved` باشند، جز `pending_listing` و `rejected_listing` در `edge_cases.json` (US5/AC2، FR-014).
  - `rejected_listing` دلیل داشته باشد، با یک ردیف سابقه‌ی `rejected` از `admin@example.com`.
  - `admin@example.com` با `kind = 'admin'` و رمز `caravansara-demo` از `/admin/auth/login` وارد شود.
  - شمار آگهی‌های عمومی برابر شمار پیش از این کار، منهای دو حالت مرزی تازه، باشد (SC-002؛ عدد از T002).
- [X] T035 [P] [US5] در `backend/tests/test_devdata_bulk.py`: پس از `seed-bulk` کوچک، همه‌ی آگهی‌ها `approved` باشند، و شمار آگهی‌های عمومی برابر شمار `is_active` باشد.

### Implementation for User Story 5

- [X] T036 [US5] در `db/demo/build_demo_seed.py`:
  - **حساب admin:** `admin@example.com` با `kind = 'admin'` (ستون `kind` در INSERT `users`).
  - **پس از INSERT آگهی‌ها:** `UPDATE listings SET review_status = 'approved'`.
  - **دو حالت مرزی در `edge_cases`:**
    - `pending_listing`: `review_status = 'pending'`، `submitted_at`، و سابقه‌ی `submitted` از میزبانش.
    - `rejected_listing`: `rejected`، با دلیل فارسی کوتاه، و سابقه‌ی `submitted` و `rejected` از admin.
  - هیچ‌کدام از این دو، آگهی‌ای نیست که حالت مرزی دیگری یا رزرو آینده‌ی `guest@example.com` دارد.
  - به‌روز کردن سربرگ SQL، با admin در فهرست حساب‌ها.
  - setval sequence رویدادها.
  - توضیح در کد: چرا UPDATE صریح لازم است، یعنی پیش‌فرض تازه `pending` است (R5، R15).
- [X] T037 [US5] اجرای `python3 db/demo/build_demo_seed.py` (کش `.cache/insideairbnb/` موجود است). خروجی‌ها: `db/seed_demo.sql`، `db/demo/edge_cases.json` و جدول README. بررسی با `git diff --stat` که تغییر فقط در جاهای انتظار است.
- [X] T038 [US5] در `db/demo/README.md`: حساب admin، دو حالت مرزی تازه، و اینکه `seed-demo` در production اجرا نمی‌شود، با دلیل.
- [X] T039 [US5] در `backend/src/caravansara/devdata/bulk.py`: ستون `review_status` در `COLUMNS["listings"]` و مقدار `approved` در هر ردیف. توضیح در کد: همان دلیل T036.

**Checkpoint**: `uv run pytest tests/test_demo_data.py tests/test_devdata_bulk.py -q` پاس شود.

---

## Phase 6: User Story 2 - رد با دلیل، اصلاح و ارسال دوباره (Priority: P2)

**Goal**: رد با دلیل نوشته‌شده، دیدن دلیل توسط میزبان، و ارسال دوباره به انتهای صف.

**Independent Test**: admin با دلیل رد می‌کند. میزبان دلیل را می‌بیند، ویرایش می‌کند و دوباره می‌فرستد. آگهی در صف است و پس از تأیید عمومی می‌شود.

### Tests for User Story 2 ⚠️

- [X] T040 [P] [US2] در `backend/tests/test_listing_review.py`، بخش US2:
  - **US2/AC1:** رد بدون دلیل، با دلیل فقط فاصله، و با دلیل بلندتر از 1000 نویسه `422` بگیرد، و آگهی در صف بماند.
  - **US2/AC2:**
    - رد با دلیل آگهی را از صف بیرون می‌برد و عمومی نمی‌کند.
    - `GET /me/listings` وضعیت `rejected` و همان دلیل را نشان می‌دهد (FR-003).
    - یک ردیف سابقه‌ی `rejected` با دلیل نوشته می‌شود، و شمارنده‌ی `rejected` یکی بالا می‌رود.
  - **US2/AC3:** ویرایش آگهی ردشده ذخیره می‌شود و `rejected` می‌ماند.
  - **US2/AC4:**
    - `POST /listings/{id}/resubmit` آگهی را `pending` می‌کند و `submitted_at` تازه می‌دهد، پس آگهی آخر صف است.
    - `review.rejection_reason` برابر `null` می‌شود.
    - یک ردیف سابقه‌ی `resubmitted` و شمارنده‌ی `submitted`.
  - **US2/AC5:** ارسال دوباره‌ی آگهی `pending` یا `approved` `409 listing_not_rejected` بگیرد. ارسال توسط غیر میزبان `403 not_listing_host` بگیرد.
  - **آگهی ردشده‌ی غیرفعال:** دوباره فرستاده می‌شود، و پس از تأیید تا فعال نشود عمومی نیست (Edge Cases).

### Implementation for User Story 2

- [X] T041 [US2] در `backend/src/caravansara/listings/service.py`:
  - `resubmit_listing(session, storage, listing_id, user_id)` از `repo.resubmit`. اگر هیچ ردیفی عوض نشد: میزبان نیست ← `Forbidden(not_listing_host)`؛ وگرنه ← `Conflict("listing_not_rejected", ...)`.
  - سابقه‌ی `resubmitted` در همان تراکنش، و شمارنده‌ی `submitted`.
  - رفتار `reject` در T027 با تست‌های T040 کامل شود.
- [X] T042 [US2] در `backend/src/caravansara/listings/router.py`: `POST /listings/{listing_id}/resubmit` با `summary`، `description` و `error_responses(401, 403, 404, 409)`، طبق contracts/api.md.

**Checkpoint**: بخش US2 در `tests/test_listing_review.py` پاس شود.

---

## Phase 7: User Story 3 - ویرایش توصیف آگهی تأییدشده، بازبینی دوباره می‌خواهد (Priority: P2)

**Goal**: ویرایش توصیفی آگهی تأییدشده آن را به صف برمی‌گرداند، و ویرایش عملیاتی نه. تأیید نسخه‌ای را که admin ندیده عمومی نمی‌کند.

**Independent Test**: تغییر قیمت آگهی را عمومی نگه می‌دارد. تغییر عنوان آن را پنهان می‌کند و به صف می‌برد. رزرو موجود برقرار می‌ماند. پس از تأیید دوباره، آگهی عمومی است.

### Tests for User Story 3 ⚠️

- [X] T043 [P] [US3] در `backend/tests/test_listing_review.py`، بخش US3. هر فیلد یک تست پارامتری دارد (SC-003):
  - **US3/AC1، FR-009، روی آگهی تأییدشده و فعال:** هر یک از این‌ها آگهی را `pending` می‌کند، با `submitted_at` تازه، `review_version + 1`، سابقه‌ی `edited`، و پنهان از جستجو:
    - `title`، `description`، `city_id`، `neighborhood`، `address`، `latitude` و `longitude`، `property_type`.
    - `PUT /amenities` با مجموعه‌ی دیگر.
    - `POST /photos` (عکس تازه).
    - `PATCH /photos/{id}` با `caption` یا `room_tag` تازه.
  - **US3/AC2، FR-010:** هیچ‌کدام از این‌ها وضعیت یا `review_version` را عوض نمی‌کند:
    - `price_per_night`، `cleaning_fee`، `currency`، `is_active`.
    - `check_in_time`، `check_out_time`.
    - `max_guests`، `bedrooms`، `beds`، `bathrooms`.
    - `pets_allowed` و `max_pets`.
    - `PUT /photos/order` (ترتیب و کاور)، `DELETE /photos/{id}`.
  - **US3/AC3، SC-004:** رزرو آینده پس از برگشت به صف همان وضعیت و مبلغ را دارد. مهمانش صفحه‌ی آگهی را می‌بیند، و پرداخت و لغو مثل امروز کار می‌کنند (FR-011).
  - **US3/AC4:** یک PATCH با قیمت و عنوان هر دو را ذخیره می‌کند و آگهی را به صف می‌برد.
  - **US3/AC5:** PATCH با همان عنوان، همان مختصات تا 6 رقم، همان مجموعه‌ی امکانات، یا همان `caption`، آگهی را `approved` نگه می‌دارد.
  - **US3/AC6:** ویرایش توصیفی آگهی `pending`، `submitted_at` را نگه می‌دارد (جای صف عوض نمی‌شود) و `review_version` را بالا می‌برد.
  - **`listing_changed`:** admin جزئیات را با نسخه‌ی `v` می‌گیرد، میزبان عنوان را عوض می‌کند، و تأیید با `v` `409 listing_changed` می‌گیرد. تأیید با نسخه‌ی تازه کار می‌کند.
  - **ویرایش توصیفی آگهی تأییدشده‌ی غیرفعال:** آگهی `pending` می‌شود، و فعال کردن بعدی آن را عمومی نمی‌کند (Edge Cases).
  - **نظرها:** نظرهای آگهی برگشته به صف پس از تأیید دوباره همراهش دیده می‌شوند.
  - **اجرا (یافته‌ی G1 analyze):** پرداخت نگه‌داشتِ باز روی آگهی پنهان، پایان اقامت با worker و ثبت نظر هم تست شدند.
- [X] T044 [P] [US3] در `backend/tests/test_concurrency.py`: ویرایش عنوان و تأیید هم‌زمان. یا ویرایش پیش از تأیید قفل می‌گیرد و تأیید `409 listing_changed` می‌گیرد، یا تأیید پیش از ویرایش انجام می‌شود و ویرایش آگهی را دوباره `pending` می‌کند. در هیچ ترتیبی آگهی با عنوان تازه `approved` نیست، مگر با تأییدی که همان نسخه را دیده است (Edge Cases).

### Implementation for User Story 3

- [X] T045 [US3] در `backend/src/caravansara/listings/service.py`:
  - ثابت `_DESCRIPTIVE = {"title", "description", "property_type", "city_id", "neighborhood", "address", "latitude", "longitude"}`، با توضیح: فهرست تصمیم مالک پروژه (future-work بخش ۱).
  - تابع کمکی `_descriptive_changed(listing, changes)`: مقایسه‌ی مقدار. مختصات با گرد کردن `f"{x:.6f}"` مقایسه می‌شوند (R7).
  - تابع کمکی `_after_descriptive_edit(session, listing, user_id)`:
    - `review_version += 1`.
    - اگر `approved` است: `pending`، `submitted_at = now()`، سابقه‌ی `edited` و شمارنده‌ی `submitted`.
  - فراخوانی آن در `update_listing`، `set_amenities` (مجموعه‌ی تازه با `repo.amenity_ids` فعلی مقایسه می‌شود)، `add_photo`، و `update_photo` (فقط اگر `caption` یا `room_tag` واقعاً عوض شده باشد).
  - `reorder_photos` و `delete_photo` آن را صدا نمی‌زنند، با یک خط توضیح (FR-010).
  - همه زیر همان قفل `_get_owned` (`FOR UPDATE`) که امروز هست.

**Checkpoint**: بخش US3 در `tests/test_listing_review.py`، و `tests/test_concurrency.py`، پاس شوند.

---

## Phase 8: Polish & Cross-Cutting Concerns

### مانیتورینگ (FR-016)

- [X] T046 [P] در `backend/tests/test_jobs.py`: پس از `run_once`، دو gauge برابر شمار آگهی‌های `pending` و عمر قدیمی‌ترین `submitted_at` باشند، و با صف خالی هر دو 0.
- [X] T047 در `backend/src/caravansara/jobs/runner.py`:
  - `run_once` در session سوم `listings.service.review_queue_stats` را بخواند و دو gauge را بنویسد.
  - `JobResult` فیلد `review_queue` بگیرد.
  - span فیلد `caravansara.review_queue` بگیرد.
  - به‌روز کردن docstring بالای فایل («دو کار رزرو و عدد صف بازبینی»)، با دلیل R10.
- [X] T048 در `observability/grafana/dashboards/caravansara.json`: ردیف «Listing review» با سه پنل: تعداد صف، قدیمی‌ترین انتظار (ثانیه) و نرخ `caravansara_listing_review_events_total` بر حسب `event`.
- [X] T049 [P] در `backend/tests/test_monitoring_config.py`: اگر تست موجود هر متریک داشبورد را با متریک‌های export‌شده نمی‌سنجد، سه متریک تازه به آن اضافه شود.
  - **اجرا (یافته‌ی A2 analyze):** تست‌های موجود همین را می‌سنجند و با سه متریک تازه پاس شدند؛ تغییری لازم نبود.

### قرارداد API و e2e

- [X] T050 اجرای `uv run caravansara export-openapi`. بررسی `git diff backend/openapi.json`: فقط افزودنی باشد (FR-017)، یعنی هیچ کد خطا، فیلد یا مسیر موجودی حذف یا عوض نشده باشد. سپس `uv run pytest tests/test_openapi_contract.py -q`.
- [X] T051 [P] نوشتن `e2e/tests/moderation.spec.ts`:
  - admin را با `docker compose exec -T -e CARAVANSARA_ADMIN_PASSWORD=… api caravansara create-admin` بسازد (helper در `e2e/tests/helpers.ts`)، تا وجود فرمان در image واقعی سنجیده شود.
  - جریان کامل: میزبان می‌سازد، جستجو آن را ندارد، admin وارد می‌شود، صف و جزئیات را می‌بیند و تأیید می‌کند، جستجو آن را دارد، و مهمان رزرو می‌کند.
  - رد با دلیل و ارسال دوباره.
- [X] T052 [P] در `e2e/tests/listings.spec.ts`، `search.spec.ts`، `bookings.spec.ts` و `reviews.spec.ts`: آگهی‌هایی که این تست‌ها می‌سازند پیش از جستجو و رزرو تأیید شوند (helper تأیید در `e2e/tests/helpers.ts`، با همان admin). این‌جا فقط آماده‌سازی تست عوض می‌شود، نه انتظارها (SC-007).
  - **اجرا:** تأیید در `e2e/tests/helpers.ts` است (`createListing` و `addPhoto`، با `{ approved: false }` برای استثنا)، پس فایل‌های spec دیگر بدون تغییر ماندند.
- [X] T053 در `e2e/README.md`: افزودن `moderation.spec.ts` به جدول، و به‌روز کردن تعداد endpointها و تست‌ها.

### اندازه‌گیری (SC-008)

- [X] T054 مهاجرت `caravansara_bulk` با `CARAVANSARA_DATABASE_URL=…/caravansara_bulk uv run caravansara migrate`، سپس `measure-queries --out ../specs/004-listing-approval/after.json`.
- [X] T055 نوشتن `specs/004-listing-approval/measurements.md`:
  - میانه‌ی پیش و پس هر کوئری جستجو و شمارش.
  - قبول اگر هیچ‌کدام بیش از 10٪ کندتر نشده باشد.
  - زمان migration روی bulk.
  - شمار آگهی‌های عمومی پیش و پس (SC-002، عدد T002).

### مستندها (قاعده‌ی مستندسازی بالا، و constitution: Development Workflow)

- [X] T056 [P] در `db/schema.sql` و `db/schema.dbml`، سپس `db/erd.mmd` و `db/erd.png`: ستون‌ها، جدول‌ها، typeها، CHECKها، trigger و ایندکس 0006، هر کدام با توضیح کوتاه چرایی (`review_version`، `kind`، `admin_address_views`).
  - **اجرا:** `schema.sql`، `schema.dbml`، `erd.mmd` و رونوشتش در `db/README.md` به‌روزند (و schema.sql با migration مقایسه شد). `erd.png` با T065 از `erd.mmd` تازه ساخته شد.
- [X] T057 [P] در `db/README.md`: جدول‌های تازه و ستون‌های تازه با دلیل و اثرشان.
- [X] T058 در `docs/backend-design.md`:
  - **جدول «تصمیم‌های کلیدی» و قاعده‌ی «آگهی» در «قواعد کسب‌وکار»:** «هنوز پیاده نشده» به محل اجرای واقعی تبدیل شود.
  - **بخش‌های «میزبان» و «سیستم»:** وضعیت بازبینی، ارسال دوباره، و admin.
  - **«پایگاه داده / جدول‌ها»:** هر ردیف جدول «ساختارهای تازه‌ی طراحی» در future-work بخش ۱، با دلیل وجود و اثرش، از جمله `review_version`، `kind`، `disabled_at`، سابقه‌ی فقط افزودنی، ثبت دیدن نشانی و پیش‌فرض دو مرحله‌ای.
  - **«طراحی API» و «قرارداد خطا»:** endpointهای admin، `resubmit` و سه کد خطای تازه.
  - **«مانیتورینگ»:** gaugeها از worker، با دلیل.
  - **«ایندکس‌ها و کارایی»:** نتیجه‌ی T055.
  - **«داده‌ی آزمون و دمو»:** admin دمو و قفل production.
- [X] T059 در `docs/future-work.md`:
  - برداشتن بخش ۱ (constitution: future-work فقط کار شروع‌نشده را دارد)، پس از اینکه T058 محتوایش را منتقل کرد.
  - شماره‌گذاری بخش‌های بعدی، و ارجاع‌ها به «بخش ۴» (ایمیل) و دیگر بخش‌ها در همین فایل، `backend-design.md`، `README.md` و `CONTEXT.md` به‌روز شوند.
- [X] T060 [P] در `README.md` و `CONTEXT.md`: خلاصه‌ی قابلیت، فرمان `create-admin`، و خط «Next».
- [X] T061 ساختن دوباره‌ی `docs/backend-design.pdf` از `docs/backend-design.md`، با همان روش PR #15 (CONTEXT.md: «regenerate after changes»).

### بررسی نهایی

- [X] T062 در `backend/`: `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run lint-imports && uv run pytest`، با پوشش ≥ 90٪.
- [X] T063 اجرای quickstart §۲ روی `docker compose up -d --build`، و e2e کامل (quickstart §۶).
  - **اجرا:** ۵۱ تست e2e روی stack ساخته‌شده پاس شدند. فرمان‌های `create-admin` و `disable-admin`، ورود admin، توکن admin روی `/me`، و gaugeهای worker و شمارنده‌ها روی `/metrics` دستی سنجیده شدند.
- [X] T064 اجرای `/speckit-converge` تا Converged، پیش از pull request (constitution 1.2.0).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: بدون وابستگی. T002 باید پیش از T004 روی bulk اجرا شود، چون پس از migration دیگر خط پایه‌ای نیست.
- **Foundational (Phase 2)**: بعد از Setup؛ همه‌ی storyها را مسدود می‌کند.
- **US4 (Phase 3)**: بعد از Phase 2. ورود admin برای US1 لازم است.
- **US1 (Phase 4)**: بعد از US4 (router `moderation` و factory `admin`).
- **US5 (Phase 5)**: بعد از Phase 2. با US4 و US1 مستقل است، اما تست دمو ورود admin را می‌خواهد، پس بعد از US4.
- **US2 (Phase 6)**: بعد از US1 (`decide` و endpoint رد).
- **US3 (Phase 7)**: بعد از US1. با US2 مستقل است، جز اینکه هر دو `listings/service.py` و `tests/test_listing_review.py` را عوض می‌کنند، پس پشت سر هم اجرا می‌شوند.
- **Polish (Phase 8)**: بعد از همه.

### User Story Dependencies

- **US4 (P1)**: فقط Phase 2.
- **US1 (P1)**: US4.
- **US5 (P1)**: Phase 2، و برای تست ورود admin، US4.
- **US2 (P2)**: US1.
- **US3 (P2)**: US1.

### Within Each User Story

- تست‌ها اول و شکست‌خورده، بعد کد.
- کارهای یک فایل به ترتیب:
  - `listings/service.py`: T015 → T027 → T041 → T045.
  - `tests/test_listing_review.py`: T023 → T040 → T043.
  - `tests/test_concurrency.py`: T024 → T044.
  - `moderation/router.py`: T020 → T028.
  - `cli.py`: فقط T019.

### Parallel Opportunities

- **Phase 2:** T005، T006 و T007 فایل جدا دارند.
- **US4:** T017 و T018.
- **US1:** T023، T024، T025 و T026 تست‌اند و هر کدام فایل جدا دارد. T033 هم فایل جدا دارد.
- **US5:** T034 و T035.
- **Polish:** T046، T049، T051، T052، T056، T057 و T060.

---

## Parallel Example: User Story 1

```text
Task: "T023 [US1] public paths, queue, approve in backend/tests/test_listing_review.py"
Task: "T024 [US1] two concurrent approvals in backend/tests/test_concurrency.py"
Task: "T025 [US1] hidden listings out of search in backend/tests/test_search.py"
Task: "T026 [US1] reviews of a hidden listing in backend/tests/test_reviews.py"
```

## Parallel Example: Polish

```text
Task: "T051 moderation flow in e2e/tests/moderation.spec.ts"
Task: "T056 schema docs in db/schema.sql, db/schema.dbml"
Task: "T060 README.md and CONTEXT.md"
```

---

## Implementation Strategy

### MVP First (US4 + US1 + US5)

1. Phase 1 و 2: schema، توکن admin، و قاعده‌ی «عمومی». همه‌ی تست‌های امروز سبز می‌مانند.
2. US4: admin ساخته می‌شود و وارد می‌شود.
3. US1: آگهی تازه پنهان است تا admin تأیید کند.
4. US5: دمو و حجیم چیزی از دست نمی‌دهند.
5. **توقف و بررسی:** quickstart §۲ قدم‌های ۱ تا ۴. این MVP قاعده‌ی اصلی مالک پروژه را اجرا می‌کند.

### Incremental Delivery

1. MVP بالا.
2. US2: رد با دلیل و ارسال دوباره. بدون آن، رد کردن بن‌بست است.
3. US3: برگشت به صف پس از ویرایش توصیفی. بدون آن، بازبینی پس از تأیید اول دور زده می‌شود.
4. Polish: مانیتورینگ، e2e، اندازه‌گیری و مستندها. همه در همین pull request.

### Notes

- **رد در US1:** در US1، endpoint رد در router هست اما رفتارش در US2 تست می‌شود. اگر MVP جدا تحویل شود، رد باید تا US2 کامل شود.
- **بدون commit:** هیچ commit یا push بدون درخواست مالک پروژه انجام نمی‌شود.

---

## Phase 9: Convergence

- [X] T065 Regenerate `db/erd.png` from the updated `db/erd.mmd` (e.g. `npx -y @mermaid-js/mermaid-cli -i db/erd.mmd -o db/erd.png -b white -s 2`), so the image shows `users.kind`, `users.disabled_at`, the four review columns of `listings`, `listing_review_events` and `admin_address_views` per T056 and Constitution Development Workflow (docs in sync) (partial)
