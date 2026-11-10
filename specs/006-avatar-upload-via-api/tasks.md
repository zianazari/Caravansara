---

description: "Task list for feature implementation"
---

# Tasks: آپلود عکس پروفایل از راه API

**Input**: Design documents from `/specs/006-avatar-upload-via-api/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: لازم‌اند. constitution اصل IV برای هر قاعده تست خودکار روی زیرساخت واقعی می‌خواهد.
- **بکند:** pytest روی PostgreSQL و MinIO واقعی.
- **فرانت‌اند:** Vitest.
- **e2e:** Playwright روی stack.
- **ترتیب:** تست‌های هر بخش اول نوشته می‌شوند و باید پیش از پیاده‌سازی شکست بخورند.

**Organization**:
- کارها بر اساس user story دسته‌بندی شده‌اند. US1 (رد فایل بد از هر کلاینت) هسته‌ی بکند است، و US2 (جریان سایت) روی آن ساخته می‌شود.
- کارهایی که یک فایل را تغییر می‌دهند، پشت سر هم آمده‌اند و `[P]` ندارند.

**قاعده‌ی مستندسازی (مالک پروژه، 2026-11-07)**: هر ساختار تازه، یعنی سقف خواندن، قفل ردیف، کد `unsupported_image_type` و سقف بدنه‌ی سایت، دلیل و اثرش را در دو جا می‌گیرد:
- یک توضیح کوتاه در کد، کنار تعریفش.
- بخش مربوط در `docs/backend-design.md` (T024).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: می‌تواند موازی اجرا شود (فایل جدا، بی وابستگی به کار ناتمام)
- **[Story]**: US1 یا US2

## Path Conventions

- بکند: `backend/src/caravansara/`، تست‌ها در `backend/tests/`
- سایت: `frontend/src/`، پیام‌ها از `frontend/scripts/messages_source.py`
- e2e: `e2e/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 اصلاح constitution در pull request جدا، از شاخه‌ی تازه‌ی `constitution-1.4.0` از `main`، با تأیید مالک پروژه. این pull request پیش از آغاز `/speckit-implement` این کار merge می‌شود، نه فقط پیش از merge آن: اصل‌های constitution «non-negotiable»اند، و کد نباید حتی موقت خلاف آن ساخته شود (analyze D1؛ plan.md، Complexity Tracking).
  - **اجرا:** pull request ‏#21 در 2026-11-10 merge شد (`1d446eb`). constitution اکنون 1.4.0 است.
  - **فایل:** `.specify/memory/constitution.md`، بخش «Technology and Domain Constraints».
  - **متن بند تازه:** «Listing photos upload directly from the browser with presigned POST; profile pictures go through the API, which checks size, type and content before anything is written to storage.» بی عدد سقف، تا عوض شدن سقف constitution را عوض نکند (analyze L3).
  - **نسخه:** نسخه‌ی MINOR بالا می‌رود، و Sync Impact Report و تاریخ اصلاح به‌روز می‌شوند.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: ابزار مشترکی که هر دو story به آن تکیه دارند.

- [X] T002 افزودن `get_user_for_update(session, user_id)` به `backend/src/caravansara/identity/repository.py`، با `select(User).where(User.id == user_id).with_for_update()`. توضیح کد: «قفل ردیف کاربر هنگام عوض کردن عکس، تا دو تغییر هم‌زمان فایل بی‌صاحب نگذارند (006، R6)».
- [X] T003 ~~افزودن 413 و 415 به `_HTTP_CODES`~~ — برداشته شد (analyze C1): هیچ مسیری خطای HTTP خام با این وضعیت‌ها نمی‌دهد، چون `PUT /me/avatar` خطاهای خودش (`image_too_large`، `unsupported_image_type`) را دارد. دو کد تازه‌ی بی‌مصرف و ترجمه‌شان ساخته نمی‌شوند.
- [X] T004 به‌روز کردن docstring `Storage.put_bytes` در `backend/src/caravansara/core/storage.py`: از این پس عکس پروفایل را هم، پس از بررسی API، می‌نویسد. docstring `presigned_upload` بگوید که فقط عکس آگهی آن را دارد.

**Checkpoint**: ابزار قفل و نگاشت خطا آماده است.

---

## Phase 3: User Story 1 - عکسی که قاعده‌ها را ندارد هرگز ذخیره نمی‌شود (Priority: P1) 🎯 MVP

**Goal**: `PUT /me/avatar` خود فایل را می‌گیرد، بررسی می‌کند و فقط پس از آن می‌نویسد. `POST /me/avatar/upload-url` برداشته می‌شود.

**Independent Test**: مستقیم به API یک فایل ۶ مگابایتی، یک GIF و یک متن با نوع PNG بفرستید. هر سه رد می‌شوند، و فهرست `avatars/{user_id}/` در MinIO پیش و پس یکی است.

### Tests for User Story 1 (اول، شکست‌خورده) ⚠️

- [X] T005 [US1] بازنویسی `backend/tests/test_avatar.py`. همه‌ی درخواست‌ها از ASGI client به API می‌روند، و هیچ درخواستی مستقیم به MinIO نمی‌رود. helper `_keys(storage, user_id)` فهرست کلیدهای زیر `avatars/{user_id}/` را می‌دهد. تست‌ها:
  - **پذیرش:** PNG و JPEG معتبر پذیرفته می‌شوند، با پاسخ 200 و `avatar_url` زیر `media_base_url/avatars/{id}/`. فایلی که با `Content-Type` درست ذخیره شده، در storage هست.
  - **دقیقاً ۵٬۲۴۲٬۸۸۰ بایت** پذیرفته می‌شود. یک بایت بیشتر 413 با `image_too_large` و `details.max_bytes` می‌دهد.
  - **`Content-Length` بزرگ** (۵۰ مگابایت): رد با 413 پیش از خواندن.
  - **بدنه‌ی stream بی `Content-Length`:** یک async generator ۵۰ مگابایت در تکه‌های ۶۴ کیلوبایتی می‌دهد و شمار بایت‌های خوانده‌شده را نگه می‌دارد. پاسخ 413، خوانده‌شده کمتر از ۶٬۰۰۰٬۰۰۰ بایت، و زمان کمتر از ۲ ثانیه (SC-003).
  - **415** با `unsupported_image_type` و `details.allowed`، برای `image/gif`، `image/webp`، `application/pdf` و بی `Content-Type`.
  - **422** با `invalid_image` برای بدنه‌ی خالی، و برای متن با نوع `image/png`.
  - **قالب از محتوا (R5):** محتوای PNG با `Content-Type: image/jpeg` به کلید `.png` و `ContentType` `image/png` می‌رود.
  - **پس از هر رد:** `_keys` بی‌تغییر است، و `avatar_url` همان قبلی است (SC-001).
  - **جایگزینی:** عکس تازه فایل قبلی را پاک می‌کند، و `DELETE /me/avatar` فایل را پاک می‌کند (FR-006).
  - **هم‌زمانی:** دو `PUT` هم‌زمان با `asyncio.gather`. در پایان `_keys` دقیقاً یک کلید دارد، و همان `avatar_url` کاربر است (SC-002، R6).
  - **شکست commit:** با monkeypatch روی `session.commit` در همان درخواست، فایل تازه پاک می‌شود و `avatar_url` قبلی می‌ماند (FR-007).
  - **storage در دسترس نیست:** `put_bytes` با monkeypatch خطا می‌دهد. پاسخ 503 `service_unavailable`، و آواتار قبلی می‌ماند.
  - **بی ورود:** `PUT` و `DELETE` پاسخ 401 می‌دهند.
  - **راه قدیمی:** `POST /me/avatar/upload-url` پاسخ 404 می‌دهد (FR-005).
  - **ارسال قطع‌شده (Edge Case، analyze U1):** بدنه‌ی stream که پیش از پایان قطع می‌شود (ASGI `http.disconnect`): هیچ فایلی در storage نوشته نمی‌شود، و `avatar_url` قبلی می‌ماند.
  - **`PATCH /me` (FR-009):** همان تست 005، اما فایل خود کاربر از راه `PUT` گذاشته می‌شود. نشانی بیرونی و نشانی کاربر دیگر `invalid_avatar_url` می‌گیرند.
- [X] T006 [US1] به‌روز کردن `backend/tests/test_identity.py` و هر تست دیگری که `/me/avatar/upload-url` یا `AvatarSetIn` را صدا می‌زند (`grep -rn "avatar/upload-url\|storage_key" backend/tests`). اجرای `uv run pytest tests/test_avatar.py` باید اکنون شکست بخورد.

### Implementation for User Story 1

- [X] T007 [US1] در `backend/src/caravansara/identity/service.py`:
  - افزودن `read_limited(stream, max_bytes) -> bytes`، که تکه‌ها را جمع می‌کند و به محض گذشتن از `max_bytes` خطای `ImageTooLarge` (413، `image_too_large`، `details.max_bytes`) می‌دهد. توضیح کد: «سرور هرگز بیش از سقف به‌علاوه‌ی یک تکه نمی‌خواند (006، R3)».
  - افزودن `_image_type(head) -> "image/png" | "image/jpeg" | None` از بایت‌های آغاز.
  - `ClientDisconnect` در `read_limited` همان خطا را بالا می‌برد، پیش از هر نوشتن، پس چیزی ذخیره نمی‌شود (analyze U1).
- [X] T008 [US1] در همان `service.py`، بازنویسی `set_avatar(session, storage, settings, user_id, content_type, body)`، به این ترتیب:
  1. `content_type` نیست یا جز دو قالب مجاز است: 415 `unsupported_image_type`.
  2. بدنه خالی است یا `_image_type` آن None است: 422 `invalid_image`.
  3. نوشتن با کلید `avatars/{user_id}/{uuid}.{ext از محتوا}` و `put_bytes`. خطای storage به 503 `service_unavailable` تبدیل می‌شود. این کد در بکند تازه است (کلاس `ServiceUnavailable` در `core/errors.py`)، اما ترجمه‌اش از ۰۰۵ در سایت هست (analyze I1).
  4. `get_user_for_update`، سپس `_replace_avatar`. اگر این گام شکست بخورد، `storage.delete(new_key)` و سپس دوباره همان خطا (FR-007). توضیح کد: «فایلی که ثبت نشد پاک می‌شود، تا فایل بی‌صاحب در storage نماند (006، FR-007)» (analyze L1).
  - **حذف:** `avatar_upload_url` و بخش `storage_key` کهنه.
  - **`_replace_avatar`، `remove_avatar` و مسیر عکس `update_me`** هم کاربر را با `get_user_for_update` بخوانند (R6).
- [X] T009 [US1] در `backend/src/caravansara/identity/router.py`:
  - **حذف:** `POST /me/avatar/upload-url`.
  - **`PUT /me/avatar`:** `request: Request` می‌گیرد. اگر `Content-Length` بیش از `max_avatar_bytes` باشد، پیش از خواندن 413 می‌دهد. وگرنه `service.set_avatar(..., request.headers.get("content-type"), await read_limited(request.stream(), settings.max_avatar_bytes))`.
  - **OpenAPI:** `openapi_extra` بدنه‌ی `requestBody` را با `image/png` و `image/jpeg` (`{"type": "string", "format": "binary"}`، `required: true`) می‌گوید.
  - **پاسخ‌ها:** `error_responses(401, 413, 415, 422, 503)`.
  - **توضیح endpoint:** قاعده‌ها، و اینکه در هر رد چیزی در storage نوشته نمی‌شود.
  - **`summary`:** «Set my picture» (بی «۱.» و «۲.»).
- [X] T010 [US1] در `backend/src/caravansara/identity/schemas.py`:
  - **حذف:** `AvatarUploadUrlIn`، `AvatarUploadUrlOut` و `AvatarSetIn`.
  - **توضیح `ProfileUpdate.avatar_url`:** به‌جای `POST /me/avatar/upload-url`، `PUT /me/avatar` را نام ببرد.
  - **مثال:** نمونه‌ی 413 و 415، اگر `error_responses` مثال را از کد می‌گیرد.
- [X] T011 [US1] افزودن 413 و 415 به `error_responses` در `backend/src/caravansara/core/errors.py`، اگر هنوز پشتیبانی نمی‌شوند، با مثال `image_too_large` و `unsupported_image_type`، و 503 با مثال `service_unavailable`، در Swagger (اصل III).
- [X] T012 [US1] اجرای `uv run caravansara export-openapi` و بررسی diff `backend/openapi.json`:
  - ۳۸ عمل.
  - `upload-url` نیست.
  - `PUT /me/avatar` با بدنه‌ی binary.
  - `tests/test_openapi_contract.py` و کل `tests/test_avatar.py` پاس می‌شوند.
- [X] T013 [US1] اجرای کامل `uv run pytest --cov` (پوشش ≥ ۹۰٪)، `uv run ruff check`، `uv run ruff format --check` و `uv run mypy` در `backend/`. `tests/test_listings.py` باید بی تغییر پاس شود، که نشان می‌دهد آپلود عکس آگهی دست نخورده است (FR-010، analyze L2).

**Checkpoint**: US1 کامل است: هیچ کلاینتی نمی‌تواند فایل بد را در storage بگذارد. سایت هنوز روی راه قدیمی است و تا US2 آپلودش کار نمی‌کند.

---

## Phase 4: User Story 2 - کاربر عکس پروفایل را از سایت عوض می‌کند یا برمی‌دارد (Priority: P1)

**Goal**: سایت عکس را در یک درخواست از راه API می‌فرستد. route handler سقف بدنه و stream دارد.

**Independent Test**: در `/fa/account` یک PNG، سپس یک JPEG ۵ مگابایتی بگذارید و سپس حذف کنید. در DevTools فقط `PUT /api/v1/me/avatar` دیده می‌شود، و فایل متنی `.png` پیش از ارسال رد می‌شود.

### Tests for User Story 2 (اول، شکست‌خورده) ⚠️

- [X] T014 [P] [US2] در `frontend/src/app/api/v1/[...path]/route.test.ts`:
  - `Content-Length` بیش از `MAX_FORWARD_BYTES` پاسخ 413 با `image_too_large` و `details: {max_bytes: 5242880}` می‌دهد، همان پاسخ API، و `fetch` به API صدا زده نمی‌شود (analyze G1).
  - بدنه‌ی stream بی طول، بزرگ‌تر از سقف، قطع می‌شود و 413 می‌گیرد.
  - بدنه‌ی کوچک (JSON و binary) دست‌نخورده به API می‌رسد، با `duplex: "half"`.
  - سرآیند `content-type` همچنان فرستاده می‌شود.
- [X] T015 [P] [US2] در `frontend/src/components/account/AvatarUploader.test.tsx`:
  - **ذخیره:** فقط یک `PUT /api/v1/me/avatar` می‌فرستد، با بدنه‌ی خود فایل و `content-type` آن. هیچ درخواستی به `upload-url` یا storage نمی‌رود.
  - **پیام خطا:** پاسخ‌های 413 (`image_too_large`)، 415 (`unsupported_image_type`) و 422 (`invalid_image`) پیام ترجمه‌شده‌ی فارسی را نشان می‌دهند.
  - **بررسی پیش از ارسال (FR-008):** همچنان هیچ درخواستی برای فایل بد نمی‌فرستد.

### Implementation for User Story 2

- [X] T016 [US2] افزودن `unsupported_image_type` به `frontend/scripts/messages_source.py`، با فارسی «فقط عکس PNG یا JPEG پذیرفته می‌شود.» و انگلیسی «Only PNG or JPEG pictures are accepted.»، و ساختن دوباره‌ی `frontend/messages/fa.json` و `en.json`. `src/messages.test.ts` باید هر کد بکند را ترجمه‌شده ببیند.
- [X] T017 [US2] اجرای `npm run gen:api` در `frontend/`، که `src/api/schema.d.ts` را از `backend/openapi.json` تازه می‌سازد. `npm run typecheck` باید جای کدهای کهنه (`upload-url`، `storage_key`) را نشان دهد.
- [X] T018 [US2] بازنویسی `save()` در `frontend/src/components/account/AvatarUploader.tsx`:
  - `api.PUT("/api/v1/me/avatar", { body: file, bodySerializer: (b) => b, headers: { "content-type": file.type } })`.
  - **حذف:** `FormData`، fetch مستقیم به storage و گام سوم.
  - توضیح کوتاه در کد: «یک درخواست؛ API فایل را پیش از نوشتن بررسی می‌کند (006)».
- [X] T019 [US2] در `frontend/src/app/api/v1/[...path]/route.ts`:
  - `MAX_FORWARD_BYTES = 5 * 1024 * 1024 + 64 * 1024`، با توضیح «بزرگ‌ترین بدنه‌ی مجاز، عکس پروفایل است (006، R7)».
  - رد با 413 از روی `Content-Length`، با همان بدنه‌ی API: `image_too_large` و `details: {max_bytes: 5242880}`، تا پیام سایت یکی باشد (analyze G1).
  - به‌جای `await request.arrayBuffer()`، `request.body` از یک `TransformStream` شمارنده می‌گذرد که پس از سقف خطا می‌دهد (پاسخ 413)، با `duplex: "half"`.
  - توضیح بالای فایل به‌روز شود.
- [X] T020 [US2] بررسی `frontend/src/lib/errors.ts`: کدهای 413 و 415 از `error.code` ترجمه می‌شوند، و نگاشت جداگانه‌ای لازم نیست. اگر لازم بود، اضافه شود. سپس `npm run lint`، `npm run typecheck` و `npm test` در `frontend/` (پوشش `src/lib` و `src/api` ≥ ۹۰٪).

**Checkpoint**: سایت و API هر دو راه تازه را دارند، و همه‌ی سناریوهای آواتار 005 پاس می‌شوند (SC-005).

---

## Phase 5: Polish & Cross-Cutting Concerns

### e2e و stack

- [X] T021 در `e2e/tests/web.spec.ts`، بازنویسی «uploads a profile picture …»:
  - **آپلود:** `PUT ${WEB}${API}/me/avatar` با بدنه‌ی PNG و `content-type: image/png`، پاسخ 200، و گرفتن خود فایل از `avatar_url` با `content-type: image/png`.
  - **فایل بد:** فایل متنی با `image/png` پاسخ 422 می‌گیرد، و GIF پاسخ 415. پس از آن `avatar_url` همان قبلی است.
  - **بدنه‌ی بزرگ:** بدنه‌ی ۶ مگابایتی از راه سایت پاسخ 413 می‌گیرد.
  - **راه قدیمی:** `POST ${WEB}${API}/me/avatar/upload-url` پاسخ 404 می‌گیرد.
  - توضیح بالای فایل به‌روز شود.
- [X] T022 به‌روز کردن `postman/Caravansara.postman_collection.json`:
  - حذف «upload-url».
  - `PUT /me/avatar` با بدنه‌ی binary (`mode: "file"`) و `Content-Type: image/png`.
  - نمونه‌های پاسخ 413، 415 و 422.
  - شمار درخواست‌ها با ۳۸ عمل برابر باشد.
- [X] T023 ساختن دوباره و اجرای stack: `docker compose -f docker-compose.yml -f e2e/compose.e2e.yml up -d --build` (بدون `-v` و بدون `down -v`)، و سپس `npx playwright test` در `e2e/`. همه پاس.
  - **اجرا:** همه‌ی ۸۵ تست e2e سه بار پشت هم پاس شدند. در اجراهای اول، چهار تست جستجو و بازبینی گاه شکست می‌خوردند: پایگاه داده‌ی اصلی پس از اجراهای بسیار ۹۱۹ آگهی آزمایشی در آمستردام داشت، و آگهی تازه همیشه در ۱۰۰ نتیجه‌ی اول جستجو یا صف مدیر نبود. این تست‌ها اکنون همه‌ی صفحه‌ها را می‌گردند (`findInSearch` در `e2e/tests/helpers.ts`)، و رفتار سیستم عوض نشد.

### مستندها (قاعده‌ی مستندسازی)

- [X] T024 در `docs/backend-design.md`:
  - **بخش «آپلود عکس»:** جدول عکس آگهی و عکس پروفایل جدا شود. پروفایل: یک `PUT` با بدنه‌ی خام، سقف خواندن، قالب از محتوا، قفل ردیف، و پاک کردن فایل تازه در شکست. هر کدام با «چرا» و «اثر».
  - **جدول API:** `POST /me/avatar/upload-url` برداشته شود، و ۳۸ عمل.
  - **جدول خطاها:** `image_too_large` با 413، و `unsupported_image_type` با 415.
  - **بخش «فرانت‌اند وب»:** `MAX_FORWARD_BYTES` و stream در route handler.
  - **بخش «زیرساخت و تحویل»:** proxy در production با سقف بدنه‌ی دست‌کم ۶ مگابایت (R10).
  - **بخش تست‌ها:** آپلود آواتار دیگر مستقیم به MinIO نمی‌رود.
  - سپس ساختن دوباره‌ی PDF آن، به همان روش 005.
- [X] T025 [P] به‌روز کردن `docs/future-work.md`:
  - بخش «کار ۰۰۶» به فهرست کارهای انجام‌شده در بند اول برود.
  - اگر اصلاح constitution (T001) merge شده، بندش برداشته شود.
  - بند lifecycle `avatars/` به «فقط فایل قبلی‌ای که پاک کردنش شکست خورده» کوچک شود.
  - CORS storage فقط برای عکس آگهی بماند.
- [X] T026 [P] به‌روز کردن `README.md`، `backend/README.md`، `frontend/README.md` و `CONTEXT.md`، هر جا که جریان آواتار یا شمار عمل‌ها (۳۹) آمده است (`grep -rn "upload-url\|39 operations\|۳۹" README.md backend/README.md frontend/README.md CONTEXT.md`).

### بررسی نهایی

- [X] T027 اجرای quickstart (`specs/006-avatar-upload-via-api/quickstart.md`)، بخش ۱ تا ۳، روی stack. نتیجه‌ی هر سناریو و زمان SC-004 (آپلود ۵ مگابایتی تا دیدن در سرصفحه، هدف کمتر از ۵ ثانیه) در همین task ثبت شود.
  - **اجرا (2026-11-10)، روی stack تازه‌ساخته:**
    - **بخش ۱:**
      - بکند: ۳۶۲ تست پاس شد، با پوشش ۹۷٫۴٪؛ ruff، mypy و import-linter بی خطا.
      - سایت: ۲۶۶ تست Vitest پاس شد؛ lint، typecheck و Prettier بی خطا.
      - e2e: همه‌ی ۸۵ تست، سه بار پشت هم، پاس شد.
    - **بخش ۲:** پاسخ curl به API، و سپس فهرست فایل‌های کاربر در MinIO که فقط همان یک عکس پذیرفته‌شده را داشت:

      | فایل فرستاده‌شده | پاسخ |
      | --- | --- |
      | JPEG | 200 |
      | ۶ مگابایت | 413 `image_too_large` |
      | نوع GIF | 415 `unsupported_image_type` |
      | فایل متنی با نوع PNG | 422 `invalid_image` |
      | `POST /me/avatar/upload-url` | 404 |
    - **بخش ۳ (SC-004):** در Chrome و صفحه‌ی ۳۹۰ پیکسلی `/fa/account`، یک PNG ۵ مگابایتی از انتخاب تا دیدن در سرصفحه ۰٫۲۵ تا ۰٫۲۷ ثانیه طول کشید (هدف: کمتر از ۵ ثانیه). در سه اجرا، فقط یک درخواست `PUT /api/v1/me/avatar` رفت، و هیچ درخواستی مستقیم به storage نرفت.
- [X] T028 اجرای `/speckit-converge` تا Converged، پیش از pull request (constitution).
  - **اجرا (2026-11-10):** دور اول یک یافته داشت: نمونه‌ی Swagger برای خطاهای `PUT /me/avatar` (T029، Phase 6). پس از آن، دور دوم Converged گزارش داد.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1):** T001 شاخه و pull request جدا است، و پیش از آغاز ساخت merge می‌شود (analyze D1).
- **شاخه:** این شاخه پس از merge کار ۰۰۷ (2026-11-10) روی `main` تازه است. پس رفع CI در #18 (صبر برای پایان setup در MinIO) هم در آن هست (analyze G2).
- **Foundational (Phase 2):** T002 تا T004 پیش از US1.
- **US1 (Phase 3):** به Phase 2 وابسته است.
- **US2 (Phase 4):**
  - T014 و T015 می‌توانند هم‌زمان با US1 نوشته شوند.
  - T017 به T012 (`openapi.json` تازه) وابسته است.
  - T016 به T009 (کد تازه) وابسته است.
- **Polish (Phase 5):** پس از US1 و US2. T021 و T023 به stack تازه نیاز دارند.

### User Story Dependencies

- **US1:** مستقل، و MVP. به‌تنهایی شکاف امنیتی را می‌بندد.
- **US2:** به قرارداد تازه‌ی US1 وابسته است. بی آن، سایت پس از US1 دیگر نمی‌تواند عکس بگذارد. پس هر دو در یک pull request می‌آیند.

### Within Each User Story

- تست‌ها اول، و شکست‌خورده.
- `service.py`، سپس `router.py`، سپس `schemas.py`، سپس `export-openapi`.
- در سایت: پیام‌ها و `gen:api`، سپس کامپوننت و route handler.

### Parallel Opportunities

- T014 و T015: دو فایل تست جدا.
- T025 و T026: اسناد جدا.
- T001: در شاخه‌ی جدا، پیش از ساخت.

---

## Parallel Example: User Story 2

```bash
# Tests for US2 together (different files):
Task: "T014 route handler body cap tests in frontend/src/app/api/v1/[...path]/route.test.ts"
Task: "T015 AvatarUploader single PUT tests in frontend/src/components/account/AvatarUploader.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 2، سپس Phase 3.
2. **بایستید و بسنجید:** `test_avatar.py` نشان می‌دهد هیچ فایل ردشده‌ای در MinIO نیست.
3. US2 در همان شاخه، چون US1 به‌تنهایی سایت را بی آپلود می‌گذارد.

### Incremental Delivery

- یک pull request برای US1 و US2 و Polish، پس از merge pull request constitution (T001).
- در توضیح pull request، breaking change آشکار می‌آید (اصل III): برداشتن `POST /me/avatar/upload-url`، بدنه‌ی تازه‌ی `PUT /me/avatar`، و وضعیت 413 به‌جای 422 برای `image_too_large` در `PUT` (analyze I3).

## Phase 6: Convergence

- [X] T029 [US1] افزودن یک بدنه‌ی نمونه‌ی Swagger برای هر پاسخ 413 (`image_too_large` با `details.max_bytes`)، 415 (`unsupported_image_type` با `details.allowed`) و 503 (`service_unavailable`) در `responses` مسیر `PUT /me/avatar` در `backend/src/caravansara/identity/router.py`، و ساختن دوباره‌ی `backend/openapi.json` و `frontend/src/api/schema.d.ts`، طبق T011 و Constitution III (partial)
