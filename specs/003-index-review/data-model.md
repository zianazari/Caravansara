# Data Model: بررسی ایندکس‌ها با اندازه‌گیری

جدول کسب‌وکار تازه‌ای نیست، و هیچ ستونی عوض نمی‌شود. تغییرها ایندکس‌ها، یک extension، و فایل‌های فهرست کوئری‌اند.

## ۱. فهرست کوئری‌ها (`db/bulk/queries/`)

| فایل | محتوا |
| --- | --- |
| `catalog.json` | آرایه‌ای از کوئری‌ها |
| `<name>.sql` | SQL همان‌طور که برنامه می‌فرستد، با پارامترهای نام‌دار `:name` |
| `params.sql` | یک `SELECT` که پارامترهای نماینده را از داده‌ی حجیم انتخاب می‌کند (پررزروترین آگهی، پرسفرترین مهمان، مرکز لندن و استکهلم و …) |

هر عضو `catalog.json`:

| فیلد | نوع | قاعده |
| --- | --- | --- |
| `name` | متن | یکتا، `snake_case`، همان نام فایل SQL |
| `source` | متن | `caravansara.<module>.repository:<function>` یا `caravansara.jobs…`؛ باید در کد وجود داشته باشد |
| `endpoint` | متن یا `null` | مثل `GET /search/listings`؛ برای job، نام job |
| `kind` | `read` \| `write` | `write` در `BEGIN … ROLLBACK` اجرا می‌شود |
| `params` | شیء | نام پارامتر → مقدار ثابت یا نام ستون خروجی `params.sql` |
| `target_ms` | عدد | پیش‌فرض ۵۰ (FR-005)؛ برای نوشتن دسته‌ای، عدد خودش |

`excluded` در همان فایل: فهرست `{source, reason}` برای توابعی که اندازه گرفته نمی‌شوند (مثلاً کوئری روی جدول ۹ ردیفی). هر تابع repository یا job باید یا در `queries` باشد یا در `excluded` (SC-001).

## ۲. اندازه‌گیری (خروجی `measure-queries`)

| فیلد | معنا |
| --- | --- |
| `name` | نام کوئری |
| `median_ms` | میانه‌ی `Execution Time` در ۵ اجرا، بعد از ۱ اجرای گرم‌کننده |
| `runs_ms` | هر ۵ عدد |
| `shared_hit`, `shared_read` | buffers در آخرین اجرا |
| `access` | نوع‌های دسترسی نقشه (مثل `Index Scan`، `Seq Scan`) |
| `indexes` | نام ایندکس‌های به‌کاررفته |
| `target_ms`, `meets_target` | هدف و رسیدن به آن |
| `jit` | آیا خود کوئری JIT شد (در جدول Markdown به‌صورت `JIT` در ستون دسترسی) |
| `database`, `revision`, `measured_at` | پایگاه داده، نسخه‌ی Alembic و زمان |

خروجی: `--out <path>.json`، و همان به شکل جدول Markdown در stdout.

## ۳. تغییرهای ایندکس (migrationهای `0003` تا `0005`)

نامزدها از research (R3–R9). هر کدام فقط اگر اندازه‌گیری سودش را نشان دهد ساخته می‌شود. نامزدهای جستجو و رزرو آگهی در `0004` می‌آیند، و نامزدهای job و حذف ایندکس در `0005`:

| نامزد | کوئری‌هایی که اثر می‌گیرند | قاعده |
| --- | --- | --- |
| `bookings (listing_id, check_in, id)` B-tree | رزروهای آگهی (شمارش و صفحه) | — |
| `bookings (check_out) WHERE status = 'confirmed'` | job پایان اقامت، همراه با کران امن در کوئری | تست‌های فعلی job بدون تغییر پاس شوند |
| `bookings USING gist (stay) WHERE status IN ('pending','confirmed','completed')` | جستجو با تاریخ | همراه با شکلی از کوئری که برنامه‌ریز hash anti-join را انتخاب کند، با همان نتیجه |
| ایندکس covering روی `listings` برای ستون‌های جستجو | جستجوی شهری و شعاعی | حجم و زمان نوشتن آگهی سنجیده شود |
| SP-GiST روی `listings.public_location` | جستجوی شعاعی | فقط اگر از GiST فعلی سریع‌تر باشد، جایگزین آن |
| حذف `listing_amenities_amenity_idx` | فیلتر امکانات، حذف یک امکان | فقط اگر هیچ کوئری فهرست آن را به کار نبرد |
| `CREATE EXTENSION IF NOT EXISTS pg_stat_statements` (migration `0003`) | — | — |

- **migration:** همه با `CREATE INDEX` عادی، در تراکنش migration. دلیل: `CONCURRENTLY` داخل تراکنش اجرا نمی‌شود، و روی داده‌ی واقعی امروز (حداکثر چند هزار ردیف) ساخت ایندکس لحظه‌ای است. زمان ساخت هر ایندکس روی داده‌ی حجیم ثبت می‌شود، تا برای production روش جدا تصمیم گرفته شود.
- **downgrade:** ایندکس‌های تازه حذف می‌شوند، و ایندکس حذف‌شده با همان تعریف قبلی برمی‌گردد. extension حذف نمی‌شود، چون ممکن است چیز دیگری به آن وابسته باشد.
