# Quickstart: تأیید آگهی

راهنمای سنجیدن قابلیت از ابتدا تا انتها. قرارداد endpointها در [contracts/api.md](contracts/api.md)، فرمان‌ها در [contracts/cli.md](contracts/cli.md)، و جدول‌ها در [data-model.md](data-model.md) آمده‌اند.

## پیش‌نیاز

```bash
docker compose up -d --build          # API، worker، PostgreSQL + PostGIS، MinIO
docker compose run --rm migrate       # تا 0006
```

## ۱. تست‌های خودکار

```bash
cd backend
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run lint-imports
uv run pytest                         # همه، با پوشش ≥ 90٪
```

تست‌های تازه هر سناریوی پذیرش را پوشش می‌دهند:

- **`tests/test_listing_review.py`:** US1، US2 و US3. یک تست برای هر فیلد FR-009 و FR-010 (SC-003) و یک تست برای هر مسیر عمومی (SC-001). دیدن صفحه توسط مهمانِ دارای رزرو (FR-019).
- **`tests/test_admin.py`:** US4، فرمان‌ها و ورود admin. توکن admin روی endpointهای عضو، و ثبت‌نام یا PATCH `/me` با `kind` (SC-005). ثبت دیدن نشانی (SC-009).
- **`tests/test_concurrency.py`:** دو تصمیم هم‌زمان، و ویرایش هم‌زمان با تأیید. مسیر بازنده ساخته می‌شود (constitution اصل IV).
- **`tests/test_migrations.py`:** upgrade آگهی‌های موجود را تأییدشده می‌کند. downgrade چیزی را عمومی نمی‌کند و هیچ آگهی، رزرو یا نظری را حذف نمی‌کند (FR-013، US5).
- **`tests/test_demo_data.py`، `tests/test_devdata_bulk.py`:** FR-014 و SC-002.
- **`tests/test_monitoring_config.py`، `tests/test_jobs.py`:** شمارنده‌ها و gaugeهای صف (FR-016).

## ۲. سنجش دستی با Swagger (`http://localhost:8000/docs`)

1. **حساب admin:**

   ```bash
   docker compose exec -e CARAVANSARA_ADMIN_PASSWORD=admin-pass-123 api \
     caravansara create-admin --email reviewer@example.com --name "Reviewer"
   ```

   انتظار: `admin created: <id>`. اجرای دوباره با همان ایمیل، یا با `host@example.com`، کد 1 و `refused: …` می‌دهد.

2. **آگهی تازه:** با `host@example.com` وارد شوید و `POST /listings` بزنید.
   - انتظار: `review.status = "pending"`.
   - `GET /search/listings` در همان شهر آن را ندارد.
   - `GET /listings/{id}` بدون توکن `404` است.
   - `POST /bookings` با `guest@example.com` هم `404` است.

3. **صف:**
   - `POST /admin/auth/login` با `reviewer@example.com`، سپس **Authorize** با این توکن.
   - `GET /admin/listings/pending`: آگهی آخر صف است.
   - `GET /admin/listings/{id}`: `private_location` پر است.
   - در Swagger توکن admin زیر **AdminBearer** گذاشته می‌شود، جدا از توکن عضو (**HTTPBearer**).

4. **تأیید:** `POST /admin/listings/{id}/approve` با `review_version` از قدم ۳.
   - انتظار: آگهی حالا در `GET /search/listings` است و رزرو می‌شود.
   - تأیید دوم `409 listing_not_pending` می‌گیرد.

5. **ویرایش:**
   - **قیمت:** `PATCH /listings/{id}` فقط با `price_per_night`. آگهی `approved` می‌ماند.
   - **عنوان:** `PATCH` با `title` تازه. آگهی `pending` می‌شود و از جستجو بیرون می‌رود، و مهمانی که رزرو دارد هنوز صفحه را می‌بیند.

6. **رد و ارسال دوباره:**
   - `POST /admin/listings/{id}/reject` با `reason` خالی `422` می‌گیرد، و با دلیل `200`.
   - میزبان در `GET /me/listings` وضعیت `rejected` و دلیل را می‌بیند.
   - `POST /listings/{id}/resubmit`: آگهی `pending` است و آخر صف.

7. **ورود admin در endpointهای عضو:** توکن admin روی `POST /listings` یا `GET /me` خطای `401 invalid_token` می‌گیرد.

8. **از کار انداختن:**
   - `docker compose exec api caravansara disable-admin --email reviewer@example.com`.
   - درخواست بعدی admin با همان توکن `401` می‌گیرد.

9. **ثبت دیدن نشانی:**

   ```bash
   docker compose exec -T db psql -U caravansara -d caravansara -c \
     "SELECT admin_id, listing_id, viewed_at FROM admin_address_views ORDER BY id DESC LIMIT 5"
   ```

   انتظار: یک ردیف برای هر `GET /admin/listings/{id}` در قدم ۳.

## ۳. مانیتورینگ (`docker compose --profile observability up -d`)

- Grafana، داشبورد Caravansara، ردیف «Listing review»: تعداد صف، قدیمی‌ترین انتظار، و نرخ submitted، approved و rejected.
- `curl -s localhost:8000/metrics | grep listing_review`، و همین روی worker.

## ۴. داده‌ی دمو و حجیم (SC-002)

```bash
# پیش از migration 0006 (روی main)، تعداد آگهی‌های عمومی:
docker compose exec -T db psql -U caravansara -d caravansara_bulk -Atc "SELECT count(*) FROM listings WHERE is_active"
# پس از migration: همان عدد
docker compose exec -T db psql -U caravansara -d caravansara_bulk -Atc \
  "SELECT count(*) FROM listings WHERE is_active AND review_status = 'approved'"
```

روی bulk امروز این عدد 96961 است (research R5). دمو: `edge_cases.json` آگهی‌های `pending_listing` و `rejected_listing` را نام می‌برد. بقیه‌ی آگهی‌ها تأییدشده‌اند.

## ۵. سرعت جستجو (SC-008)

همان روش specs/003 (`specs/003-index-review/measurements.md`):

```bash
cd backend
# پیش از 0006، با کاتالوگ کوئری‌های امروز (روی main):
uv run caravansara measure-queries --database caravansara_bulk --catalog <کاتالوگ main> --out ../specs/004-listing-approval/before.json
CARAVANSARA_DATABASE_URL=…/caravansara_bulk uv run caravansara migrate       # 0005 → 0006
uv run caravansara measure-queries --database caravansara_bulk --out ../specs/004-listing-approval/after.json
```

- **کاتالوگ:** فایل‌های جستجو در `db/bulk/queries/` (`search_*`, `filters_*`) شرط `review_status` را می‌گیرند، چون رونوشت دستی SQL واقعی‌اند. `tests/test_query_catalog.py` فقط پوشش هر تابع repository و اجرا شدن هر فایل را می‌سنجد، نه برابری متن SQL با کد، پس این رونوشت باید با دست هم‌خوان بماند.
- **قبول:** میانه‌ی هر کوئری جستجو بیش از ۱۰٪ کندتر نیست.
- **ثبت:** نتیجه در `specs/004-listing-approval/measurements.md` و `docs/backend-design.md` نوشته می‌شود.

## ۶. e2e

```bash
docker compose -f docker-compose.yml -f e2e/compose.e2e.yml up -d --build
cd e2e && npx playwright test
```

`moderation.spec.ts` با `docker compose exec api caravansara create-admin` admin می‌سازد و جریان ساختن، صف، تأیید، جستجو و رزرو را روی stack واقعی می‌سنجد.
