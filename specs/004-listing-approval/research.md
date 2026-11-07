# Research: تأیید آگهی توسط مدیر سیستم (admin)

هر بند تصمیم، دلیل و گزینه‌های ردشده را دارد، و زیر «چطور سنجیده شد» می‌گوید فرض با کدام منبع واقعی بررسی شد (constitution، Development Workflow).

## R1. حساب admin: همان جدول `users` با ستون `kind`

- **Decision**: حساب admin یک ردیف در `users` است با `kind = 'admin'` (enum تازه‌ی `account_kind`: `member`, `admin`؛ پیش‌فرض `member`) و ستون `disabled_at`. admin فقط از `POST /api/v1/admin/auth/login` وارد می‌شود و توکنی با `type: "admin"` می‌گیرد. ورود عادی (`/auth/login`) حساب admin را با همان خطای `invalid_credentials` رد می‌کند.
- **Rationale**:
  - constitution اصل I می‌گوید یکتایی ایمیل را پایگاه داده نگه می‌دارد. با یک جدول، ایندکس یکتای فعلی روی `lower(email)` خودش جلوی ایمیل تکراری بین کاربر عادی و admin را می‌گیرد، حتی وقتی ثبت‌نام و فرمان هم‌زمان اجرا شوند (FR-012، US4/AC2).
  - جدا بودن نوع حساب با نوع توکن تضمین می‌شود: `current_user_id` فقط `type: "access"` را می‌پذیرد، پس توکن admin به هیچ endpoint میزبان یا مهمان نمی‌رسد. admin با ساختار سیستم نمی‌تواند آگهی ثبت کند یا رزرو کند (FR-007)، نه با یک if در هر endpoint.
  - هیچ فیلد ورودی عمومی `kind` ندارد، پس ثبت‌نام و ویرایش پروفایل هرگز admin نمی‌سازند (SC-005).
- **Alternatives considered**:
  - جدول جدای `admins`: یکتایی ایمیل بین دو جدول را پایگاه داده نمی‌تواند با constraint ساده نگه دارد. trigger بدون قفل در دو تراکنش هم‌زمان هر دو را قبول می‌کند. ردیف admin همچنین سیستم refresh token و محدودیت تلاش ورود را تکرار می‌کرد.
  - نقش اضافه روی کاربر عادی (`is_admin`): مالک پروژه رد کرد (Clarifications: مدیر نوع جدایی است و کاربر عادی هرگز مدیر نمی‌شود).
- **چطور سنجیده شد**:
  - `backend/src/caravansara/identity/models.py`: `users` فقط `email, password_hash, full_name, avatar_url, created_at` دارد و ستون نقش ندارد.
  - `migrations/versions/0001_initial_schema.py`: ایندکس یکتا روی `lower(email)` است.
  - `core/security.py`: `decode_access_token` هر `type` جز `"access"` را `invalid_token` می‌کند.
  - `identity/schemas.py`: `RegisterIn` و `ProfileUpdate` فیلد نقش ندارند، و Pydantic فیلد اضافه را نادیده می‌گیرد.

## R2. نشست admin: فقط access token کوتاه، و بررسی حساب در هر درخواست

- **Decision**:
  - ورود admin فقط access token می‌دهد (عمرش `admin_token_minutes`، پیش‌فرض 15)، بدون refresh token.
  - هر endpoint admin ردیف admin را با کلید اصلی می‌خواند. اگر `kind <> 'admin'` یا `disabled_at` پر باشد، `401 invalid_token` برمی‌گردد.
- **Rationale**:
  - FR-012 می‌گوید از کار انداختن «حداکثر تا پایان عمر نشست» اثر کند. خواندن ردیف در هر درخواست آن را بی‌درنگ می‌کند.
  - این خواندن با کلید اصلی است و هزینه‌اش ناچیز است، چون admin‌ها چند نفرند و درخواست‌هایشان کم است.
  - بدون refresh token، چرخش و کشف استفاده‌ی دوباره برای admin لازم نیست. هر ۱۵ دقیقه ورود دوباره برای ابزار بازبینی پذیرفتنی است.
- **Alternatives considered**: refresh token مثل کاربر عادی. کد و جدول بیشتری می‌خواست و سودی برای چند admin نداشت.
- **چطور سنجیده شد**: `core/config.py` (`access_token_minutes: int = 15`) و `identity/service.py` (`_issue_tokens` توکن refresh را در `refresh_tokens` با FK به `users` می‌نویسد).

## R3. محدودیت تلاش ورود admin

- **Decision**: ورود admin همان `auth_attempts` و همان سقف‌های `login_*` را به کار می‌برد، با `action = 'admin_login'`. شمارنده‌ی `caravansara_rate_limited_total` برچسب `admin_login` می‌گیرد.
- **Rationale**: پنل admin از اینترنت در دسترس است (constitution 1.3.0)، پس حدس رمز باید همان‌قدر سخت باشد که برای کاربر عادی. action جدا یعنی تلاش‌های ورود عادی سقف admin را پر نمی‌کنند، و برعکس.
- **Alternatives considered**: سقف سخت‌تر برای admin. هنوز عددی از مانیتورینگ ندارد. اگر لازم شد، فقط یک تنظیم است.
- **چطور سنجیده شد**: `identity/service.py` (`login` با `count_attempts(... "login" ...)`)، و `core/metrics.py` (برچسب‌های `RATE_LIMITED` از پیش ساخته می‌شوند).

## R4. ماژول تازه‌ی `moderation`

- **Decision**:
  - ماژول `caravansara.moderation` endpointهای admin را دارد: ورود، صف، جزئیات، تأیید و رد. جدول `admin_address_views` هم مال اوست.
  - وضعیت بازبینی آگهی و سابقه‌ی آن (`listing_review_events`) مال ماژول `listings` است، چون میزبان هم آن را عوض می‌کند (ساختن، ویرایش، ارسال دوباره).
  - `moderation` فقط از راه `listings.service` و `identity.service` کار می‌کند.
  - یک قرارداد import-linter تازه اضافه می‌شود، و `moderation` به فهرست ممنوعه‌ی قراردادهای دیگر می‌رود.
- **Rationale**: constitution اصل II برای ماژول تازه قرارداد می‌خواهد. وضعیت آگهی و قاعده‌ی «کدام ویرایش تأیید می‌خواهد» یک‌جا، کنار ویرایش آگهی، می‌ماند. پس همان قفل ردیف ویرایش و تصمیم را پشت سر هم اجرا می‌کند (R6).
- **Alternatives considered**:
  - endpointهای admin در `listings/router.py`: کار admin و میزبان در یک ماژول قاطی می‌شد.
  - جدول سابقه در `moderation`: ارسال دوباره‌ی میزبان (در `listings`) آن‌وقت باید `moderation` را صدا می‌زد، و چون `moderation` هم `listings` را صدا می‌زند، import دوطرفه پیش می‌آمد.
- **چطور سنجیده شد**: `backend/pyproject.toml`: قراردادهای `forbidden` برای هر ماژول، `allow_indirect_imports = true`، و قرارداد `core` با فهرست همه‌ی ماژول‌ها.

## R5. وضعیت بازبینی روی `listings`، بدون بازنویسی جدول

- **Decision**: migration `0006` این‌ها را اضافه می‌کند:
  - `review_status listing_review_status NOT NULL DEFAULT 'approved'`، و بعد `SET DEFAULT 'pending'`.
  - `submitted_at timestamptz`، بدون پیش‌فرض؛ سپس `SET DEFAULT now()`.
  - `rejection_reason text`.
  - `review_version integer NOT NULL DEFAULT 0`.
  - دو CHECK و یک ایندکس جزئی برای صف.
- **Rationale**:
  - ستون با پیش‌فرض ثابت در PostgreSQL 16 فقط metadata است. همه‌ی ردیف‌های موجود بی‌درنگ `approved` می‌شوند (FR-013، US5)، بدون UPDATE روی ۱۰۰ هزار ردیف و بدون قفل طولانی.
  - ردیف‌های تازه با پیش‌فرض بعدی، `pending`، ساخته می‌شوند (FR-001)، حتی اگر کدی آن را فراموش کند.
  - `now()` اگر هنگام ADD COLUMN پیش‌فرض باشد جدول را بازنویسی می‌کند، پس جدا گذاشته می‌شود.
- **Alternatives considered**: ستون nullable و یک UPDATE روی همه. ۱۰۰ هزار ردیف را بازنویسی می‌کرد و جدول را bloat می‌کرد؛ در ۰۰۳ دیدیم این اندازه‌گیری را خراب می‌کند.
- **چطور سنجیده شد**: روی `caravansara_bulk` (۱۰۰٬۰۰۰ آگهی، ۹۶٬۹۶۱ فعال)، داخل `BEGIN … ROLLBACK`:
  - `pg_relation_filenode('listings')` پیش و پس از ADD COLUMN هر دو 55000 ماند، یعنی بازنویسی نشد.
  - ADD COLUMN با پیش‌فرض: 11 ms. CHECK `review_status <> 'pending' OR submitted_at IS NOT NULL`: 34 ms. ایندکس `(submitted_at, id) WHERE review_status = 'pending'`: 48 ms.
  - همان ADD COLUMN روی `users`: 1 ms.

## R6. تصمیم‌های هم‌زمان: UPDATE شرطی با `review_version`

- **Decision**:
  - هر ویرایش توصیفی (FR-009) `review_version` را یکی بالا می‌برد. جزئیات admin آن را برمی‌گرداند، و تأیید یا رد همان را در بدنه می‌فرستد.
  - تصمیم این است: `UPDATE listings SET … WHERE id = :id AND review_status = 'pending' AND review_version = :v RETURNING …`. اگر هیچ ردیفی عوض نشود:
    - وضعیت دیگر `pending` نیست: `409 listing_not_pending`.
    - نسخه عوض شده: `409 listing_changed`.
  - ردیف سابقه در همان تراکنش نوشته می‌شود.
- **Rationale**:
  - constitution اصل I می‌گوید تغییر وضعیتی که می‌تواند مسابقه شود UPDATE شرطی است و شمار ردیف‌ها تصمیم می‌گیرد.
  - دو admin هم‌زمان: فقط یکی برنده می‌شود (FR-006).
  - میزبانی که هم‌زمان ویرایش می‌کند: ویرایش با `SELECT … FOR UPDATE` (کد امروز) قفل می‌گیرد و نسخه را بالا می‌برد. تأییدی که نسخه‌ی قدیمی را دیده رد می‌شود، پس هیچ نسخه‌ای بدون بازبینی عمومی نمی‌شود (Edge Cases).
- **Alternatives considered**: مقایسه‌ی `updated_at`. جدول این ستون را ندارد، و هر ویرایش غیرتوصیفی (قیمت) هم آن را عوض می‌کرد و تأیید را بی‌دلیل رد می‌کرد.
- **چطور سنجیده شد**: `listings/service.py` (`_get_owned` با `for_update=True` در همه‌ی ویرایش‌ها، از جمله عکس و امکانات)، و الگوی `bookings/repository.py` برای UPDATE شرطی پرداخت و لغو.

## R7. کدام ویرایش توصیفی است: مقایسه‌ی مقدار

- **Decision**: `listings.service` پیش از نوشتن، مقدار تازه را با مقدار فعلی مقایسه می‌کند:
  - فیلدهای آگهی: `title, description, property_type, city_id, neighborhood, address, latitude, longitude`. مختصات با همان گرد کردن ۶ رقمی که ذخیره می‌شود مقایسه می‌شوند.
  - امکانات: مجموعه‌ی تازه با مجموعه‌ی فعلی.
  - افزودن عکس: همیشه توصیفی است.
  - `caption` یا `room_tag` عکس: اگر مقدار عوض شود.
  - بقیه‌ی فیلدها (FR-010) وضعیت را عوض نمی‌کنند.
- **Rationale**: US3/AC5 می‌گوید فرستادن همان مقدار تغییر نیست. فرانت‌اند معمولاً کل فرم را می‌فرستد، و بدون مقایسه هر ذخیره‌ی قیمت آگهی را پنهان می‌کرد.
- **Alternatives considered**: هر کلیدی که در PATCH آمده. با US3/AC5 نمی‌خواند.
- **چطور سنجیده شد**: `listings/schemas.py` و `listings/service.py`:
  - `update_listing` با `model_dump(exclude_unset=True)` و `setattr` کار می‌کند.
  - `_set_location` مختصات را با `f"{lat:.6f}"` گرد می‌کند.
  - `set_amenities` کل مجموعه را جایگزین می‌کند.
  - `update_photo` فقط `caption` و `room_tag` را عوض می‌کند.

## R8. عمومی بودن: یک قاعده در سه جا

- **Decision**: «عمومی» یعنی `is_active AND review_status = 'approved'`. این قاعده سه جا اجرا می‌شود:
  - **جستجو و شمارش فیلترها:** `search/repository.py::_where` و `db/search_query.sql` شرط `l.review_status = 'approved'` را کنار `l.is_active` می‌گیرند.
  - **صفحه‌ی آگهی و نظرها:** `listings.service.get_listing` و `reviews.service.listing_reviews`. آگهی غیرعمومی فقط برای میزبانش و مهمانی که در آن رزرو زنده دارد دیده می‌شود (FR-019)؛ برای بقیه همان `404 not_found` است. `GET /listings/{id}/reviews` بیننده‌ی اختیاری می‌گیرد. امروز نظرهای آگهی غیرفعال برای همه دیده می‌شوند، در حالی که صفحه‌اش 404 است؛ FR-002 این ناهمخوانی را می‌بندد.
  - **رزرو تازه:** `bookings.service.create_booking` به‌جای `info.is_active` شرط `info.is_public` را بررسی می‌کند و همان `404` امروز را می‌دهد.
- **«رزرو زنده»:** وضعیت `pending` (با مهلت نگه‌داشتِ نگذشته)، `confirmed` یا `completed`. لغوشده و منقضی حساب نمی‌شوند (Edge Cases).
  - این بررسی یک `EXISTS` با SQL ساده روی جدول `bookings`، در `listings/repository.py`، است؛ همان کاری که `search/repository.py` امروز می‌کند.
  - اگر `listings` به‌جایش `bookings.service` را صدا بزند، import دوری می‌سازد، چون `bookings.service` در بالای فایل `listings.service` را import می‌کند.
- **Rationale**: FR-002 و SC-001 هر مسیر عمومی را می‌خواهند. مسیرهای امروز همین چهار تا هستند: جستجو، شمارش، صفحه، رزرو، به‌علاوه‌ی نظرها.
- **Alternatives considered**: ستون generated `is_public` با ساختن دوباره‌ی ایندکس‌های جزئی روی آن. ایندکس‌های ۱۰۰ هزار ردیفی را دوباره می‌ساخت، بی‌آنکه سودی اندازه‌گیری شود (R9).
- **چطور سنجیده شد**:
  - `grep is_active`: در `search/repository.py:50`، `listings/service.py::get_listing`، `bookings/service.py:72` و `db/search_query.sql`.
  - `reviews/service.py:66`: `listing_reviews` فقط `get_listing_info` را صدا می‌زند و `is_active` را نمی‌بیند.
  - `bookings/service.py:24`: `bookings.service` در بالای فایل `listings.service` را import می‌کند.

## R9. سرعت جستجو با شرط تازه (SC-008)

- **Decision**: ایندکس‌های جزئی `WHERE is_active` (`listings_city_idx`، `listings_public_location_idx`) دست نمی‌خورند. شرط `review_status` فقط یک Filter روی همان ردیف‌هاست.
- **Rationale**: تقریباً همه‌ی آگهی‌ها تأییدشده‌اند، پس شرط تازه ردیفی کم نمی‌کند که ایندکس تازه را توجیه کند. constitution اصل VII ایندکس بی‌اندازه‌گیری را نمی‌پذیرد.
- **Alternatives considered**: ایندکس‌های جزئی با `WHERE is_active AND review_status = 'approved'`. پلن عوض نمی‌شد، اما ساختن دوباره و migration بیشتری می‌خواست.
- **چطور سنجیده شد**: روی `caravansara_bulk`، داخل `BEGIN … ROLLBACK` با ستون آزمایشی و `ANALYZE`، شمارش لندن با `max_guests >= 2`:
  - بدون شرط: `Bitmap Index Scan on listings_city_idx`، 21.7 ms.
  - با شرط: همان پلن، Filter `rs = 'approved'`، 17.5 ms (اجرای دوم، کش گرم).
  - اندازه‌گیری کامل SC-008 با `caravansara measure-queries` در quickstart آمده است.

## R10. مانیتورینگ صف (FR-016)

- **Decision**:
  - **شمارنده:** `caravansara_listing_review_events_total{event}` با `submitted`، `approved` و `rejected`، در هر API که تصمیم یا ارسال را انجام می‌دهد.
  - **دو gauge:** `caravansara_listing_review_queue` (تعداد در انتظار) و `caravansara_listing_review_oldest_wait_seconds`. worker آن‌ها را در هر اجرا از پایگاه داده می‌خواند (`count(*)`, `min(submitted_at)` روی ایندکس جزئی صف).
  - Grafana یک ردیف تازه می‌گیرد.
- **Rationale**: هر copy از API شمارش خودش را دارد (`core/metrics.py`). اگر هر API عدد صف را بفرستد، Prometheus اعداد تکراری یا کهنه می‌دید. worker یک process است و هر دقیقه اجرا می‌شود، پس عدد صف دقیقاً یک منبع دارد.
- **Alternatives considered**: postgres-exporter با کوئری سفارشی. تنظیم بیشتر و جای دیگری برای منطق می‌خواست.
- **چطور سنجیده شد**: `core/metrics.py` (توضیح بالای فایل درباره‌ی شمارش جدا در هر process)، `jobs/runner.py` (`run_once` و `JobResult`)، و `observability/grafana/dashboards/caravansara.json`.

## R11. سابقه و دیدن نشانی دقیق

- **Decision**:
  - **`listing_review_events`:** فقط اضافه می‌شود (trigger هر UPDATE و DELETE را رد می‌کند). action آن `submitted`، `edited`، `resubmitted`، `approved` یا `rejected` است، با انجام‌دهنده (FK به `users`، میزبان یا admin)، `review_version` و دلیل برای رد. نوع `edited` ویرایشی است که آگهی تأییدشده را به صف برگرداند.
  - **`admin_address_views`:** یک ردیف برای هر `GET /admin/listings/{id}` (admin، آگهی، زمان)، در همان تراکنشی که پاسخ را می‌سازد (FR-018، SC-009).
- **Rationale**: FR-015 انجام‌دهنده و زمان را می‌خواهد. trigger این تضمین را به پایگاه داده می‌دهد، که اصل I برای قاعده‌های مهم ترجیح می‌دهد. نوشتن ردیف دیدن در همان تراکنش یعنی پاسخی بدون ثبت وجود ندارد.
- **Alternatives considered**: ثبت دیدن نشانی در log. constitution اصل V نشانی را در log ممنوع می‌کند، و log برای سابقه‌ی ماندگار ساخته نشده است.
- **چطور سنجیده شد**: constitution 1.3.0 اصل V («which admin, which listing, when»)، و trigger `reviews_rating_sync` در `0001_initial_schema.py` به‌عنوان الگوی trigger در این پروژه.

## R12. endpointهای admin روی زیردامنه‌ی خودشان

- **Decision**: endpointهای admin زیر `/api/v1/admin/*` در همان برنامه‌ی FastAPI هستند. تنظیم اختیاری `CARAVANSARA_ADMIN_HOST` کارشان را محدود می‌کند:
  - وقتی پر است، این endpointها برای `Host` دیگری `404 not_found` می‌دهند.
  - در development خالی است و همه‌جا کار می‌کنند.
  - همه در `openapi.json` و Swagger هستند.
- **Rationale**:
  - constitution 1.3.0 می‌گوید ابزار admin فقط روی زیردامنه‌ی خودش از اینترنت در دسترس است. این تنظیم آن را برای API هم اجراپذیر می‌کند، با چند خط و یک تست.
  - اصل III می‌خواهد Swagger همه‌ی endpointها را نشان دهد. spec هم تا ساخته شدن پنل بازبینی را از راه Swagger می‌خواهد.
  - محافظت اصلی ورود admin است؛ نشانی پنهان فقط دسترس را کم می‌کند.
- **Alternatives considered**: سرویس API جدا برای admin. constitution اصل II جدا کردن سرویس را بدون عدد مانیتورینگ نمی‌پذیرد.
- **چطور سنجیده شد**: `main.py` (همه‌ی routerها زیر `APIRouter(prefix=API_PREFIX)` با `docs_url="/docs"`)، و constitution 1.3.0 اصل V.

## R13. پاسخ به غیر admin (FR-020)

- **Decision**: درخواست به endpoint admin بدون توکن، با توکن کاربر عادی، یا با حساب admin از کار افتاده `401` با `invalid_token` یا `unauthorized` می‌گیرد، مثل امروز. هیچ داده‌ای از آگهی، و هیچ `404` یا `409` دیگری، پیش از احراز admin برنمی‌گردد.
- **Rationale**: ترتیب dependencyها تضمین می‌کند که وجود یا وضعیت آگهی فقط به admin گفته شود.
- **Alternatives considered**: `403 admin_only`. نوع حساب را لو می‌داد، و سودی برای کاربر عادی نداشت.
- **چطور سنجیده شد**: `core/errors.py` (`Unauthorized` با `code` پیش‌فرض `unauthorized`)، و `core/security.py` (`invalid_token`).

## R14. فرمان‌های سرور

- **Decision**:
  - `caravansara create-admin --email E --name N` رمز را از `CARAVANSARA_ADMIN_PASSWORD` می‌خواند، یا اگر خالی باشد دو بار با `getpass` می‌پرسد. قاعده‌ی رمز همان ثبت‌نام است: ۸ تا ۱۲۸ نویسه.
  - `caravansara disable-admin --email E` حساب را از کار می‌اندازد.
  - هر دو کد خروج 1 و پیام روشن دارند: ایمیلی که حساب دارد، ایمیلی که admin نیست، یا حسابی که از قبل از کار افتاده.
- **Rationale**: رمز در آرگومان فرمان در تاریخچه‌ی shell و `ps` دیده می‌شود. متغیر محیطی برای اسکریپت و e2e است، و `getpass` برای انسان.
- **Alternatives considered**: `--password`. به همان دلیل رد شد.
- **چطور سنجیده شد**: `cli.py` (`build_parser` با `sub.add_parser`، و الگوی خطای `BulkRefused`)، و `identity/schemas.py` (`password: str = Field(min_length=8, max_length=128)`).

## R15. داده‌ی دمو و داده‌ی حجیم (FR-014)

- **Decision**:
  - **دمو:** `db/demo/build_demo_seed.py` پس از INSERTها `UPDATE listings SET review_status = 'approved'` می‌نویسد. بعد دو حالت مرزی تازه می‌سازد:
    - `pending_listing`: در انتظار، با `submitted_at`.
    - `rejected_listing`: رد شده با دلیل.
  - همان builder یک حساب `admin@example.com` با `kind = 'admin'` و رمز همه‌ی حساب‌های دمو می‌سازد، و ردیف‌های سابقه را هم.
  - `seed-demo` در `environment = production` اجرا نمی‌شود.
  - **حجیم:** `devdata/bulk.py` ستون `review_status` را با `approved` در COPY می‌نویسد.
- **Rationale**:
  - با پیش‌فرض `pending` (R5)، INSERTهای امروز دمو آگهی‌ها را پنهان می‌کردند، و SC-002 می‌شکست.
  - آگهی ردشده بدون admin سابقه‌ی درستی نمی‌داشت (FR-015).
  - دمو امروز هم رمز شناخته‌شده دارد. پس جای درستش production نیست، و یک حساب admin با رمز شناخته‌شده این را جدی‌تر می‌کند.
  - فرمان `seed-demo` خودش روی سرور اجرا می‌شود، پس با اصل V («only by a command run on the server») می‌خواند.
- **Alternatives considered**: ردیف سابقه‌ی بی‌انجام‌دهنده برای دمو. FR-015 را می‌شکست.
- **چطور سنجیده شد**:
  - `db/seed_demo.sql:2088`: INSERT ستون `review_status` ندارد.
  - `build_demo_seed.py::write`: حالت `inactive_listing` با یک UPDATE پس از INSERT ساخته می‌شود.
  - `.cache/insideairbnb/` موجود است، پس builder بدون شبکه دوباره اجرا می‌شود و برای همان `--seed` خروجی یکسان می‌دهد.
  - `devdata/bulk.py:21-26`: `COLUMNS["listings"]`.
  - `cli.py::seed_demo`: هیچ بررسی production ندارد.

## R16. بازگرداندن migration

- **Decision**: `0006` downgrade:
  - آگهی‌های تأییدنشده را `is_active = false` می‌کند، تا هیچ آگهی بازبینی‌نشده‌ای با حذف ستون عمومی نشود.
  - حساب‌های admin را حذف می‌کند، چون بدون ستون `kind` به کاربر عادی با رمز تبدیل می‌شدند و می‌توانستند رزرو کنند.
  - سپس جدول‌ها، ستون‌ها و typeها را برمی‌دارد.
- **Rationale**: constitution می‌گوید هر migration downgrade دارد و تست می‌شود. FR-013 حذف آگهی، رزرو و نظر را ممنوع می‌کند، و این downgrade هیچ‌کدام را حذف نمی‌کند.
- **Alternatives considered**: حذف ساده‌ی ستون‌ها. آگهی‌های رد شده را بی‌درنگ عمومی می‌کرد.
- **چطور سنجیده شد**: `tests/test_migrations.py` (الگوی upgrade و downgrade کامل روی پایگاه داده‌ی واقعی).
