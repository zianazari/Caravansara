# Implementation Plan: آپلود عکس پروفایل از راه API

**Branch**: `006-avatar-upload-via-api` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-avatar-upload-via-api/spec.md`

## Summary

عکس پروفایل دیگر مستقیم از مرورگر به storage نمی‌رود.

- **API:** `PUT /me/avatar` خود فایل را در بدنه می‌گیرد (research R1، R2). اندازه را بی خواندن بیش از سقف می‌سنجد (R3)، قالب اعلام‌شده و بایت‌های آغاز را بررسی می‌کند، و فقط پس از آن فایل را در MinIO می‌نویسد. سپس زیر قفل ردیف کاربر عکس را ثبت و فایل قبلی را پاک می‌کند (R6).
- **برداشته می‌شود:** `POST /me/avatar/upload-url`. این breaking change است و طبق اصل III آشکار می‌آید.
- **سایت:**
  - route handler سقف بدنه و stream می‌گیرد (R7).
  - `AvatarUploader` یک درخواست می‌فرستد (R8).
  - بررسی پیش از ارسال می‌ماند.
- **عکس آگهی بی‌تغییر است.**

## Technical Context

- **Language/Version:** Python 3.13 (backend)؛ TypeScript 5.9.3 strict (frontend).
- **Primary Dependencies:** FastAPI و Starlette، با `request.stream()`؛ boto3، با `put_object` از راه `Storage.put_bytes`؛ Next.js 16.4.3 route handler؛ `openapi-fetch` 0.17.0. هیچ وابستگی تازه‌ای نیست (`python-multipart` عمداً نه؛ R1).
- **Storage:** PostgreSQL 16 (بی migration؛ فقط `SELECT … FOR UPDATE` روی `users`)؛ MinIO با پیشوند `avatars/{user_id}/`.
- **Testing:**
  - pytest روی PostgreSQL و MinIO واقعی (testcontainers).
  - Vitest برای `AvatarUploader` و route handler.
  - Playwright e2e روی stack.
  - `test_openapi_contract.py`.
- **Target Platform:** Linux containers (docker compose)؛ مرورگرهای ۲ نسخه‌ی آخر.
- **Project Type:** web application (`backend/` + `frontend/`).
- **Performance Goals:** رد فایل ۵۰ مگابایتی زیر ۲ ثانیه، با خواندن کمتر از ۶ مگابایت (SC-003)؛ آپلود ۵ مگابایتی روی stack محلی زیر ۵ ثانیه (SC-004).
- **Constraints:** هیچ فایل ردشده‌ای در storage (FR-002)؛ هیچ فایل بی‌صاحب (FR-007)؛ حافظه‌ی API و سایت برای هر آپلود حداکثر حدود ۵ مگابایت.
- **Scale/Scope:**
  - ۱ endpoint عوض می‌شود و ۱ endpoint برداشته می‌شود (۳۹ ← ۳۸).
  - ۲ کد خطای تازه در بکند: `unsupported_image_type` و `service_unavailable` (analyze I1).
  - ۲ فایل سایت (`route.ts`، `AvatarUploader.tsx`) و پیام‌ها.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل | وضعیت | توضیح |
| --- | --- | --- |
| I. Database guards critical rules | ✅ | ترتیب جایگزینی با قفل ردیف در پایگاه داده نگه داشته می‌شود، نه با حافظه‌ی برنامه (R6). |
| II. Modular monolith | ✅ | همه‌ی تغییر در `identity` و `core/storage` است. `identity` از `listings` import نمی‌کند. |
| III. Contract-first API | ✅ با breaking change آشکار | تغییر از spec آغاز شده (FR-005). `openapi.json` با `caravansara export-openapi` بازنویسی می‌شود. برداشتن endpoint و عوض شدن بدنه در توضیح PR می‌آید. کد خطای تازه در Swagger با مثال می‌آید، و هیچ کدی حذف نمی‌شود. |
| IV. Tested against real infrastructure | ✅ | MinIO و PostgreSQL واقعی؛ فهرست storage پیش و پس سنجیده می‌شود (R11). |
| V. Privacy and security by default | ✅ | سطح حمله کم می‌شود: فایل بد هرگز در storage نوشته نمی‌شود، و حافظه‌ی سایت و API سقف دارد. |
| VI. Observable | ✅ | ردها با کد خطا در log و metrics موجود می‌آیند. شکست پاک کردن فایل قبلی مثل 005 log می‌شود. |
| VII. Simple | ✅ | وابستگی تازه‌ای نیست، و کد کمتر از 005 است (دو گام به یک گام). |
| **Technology constraint:** "Photos upload directly from the browser with presigned POST; files never pass through the API." | ❌ **نقض، با توجیه** | این کار عکس پروفایل را از API می‌گذراند. این بند باید پیش از merge این کار در pull request جدا، با تأیید مالک پروژه، اصلاح شود: عکس آگهی مستقیم می‌ماند، و عکس پروفایل (حداکثر ۵ مگابایت) از API می‌گذرد. جدول Complexity Tracking را ببینید. |

**Gate:** پاس است. constitution در 2026-11-10 به 1.4.0 اصلاح شد (pull request ‏#21): عکس پروفایل از API می‌گذرد، و عکس آگهی مستقیم می‌ماند.

**Re-check after Phase 1:** طراحی (contracts/api.md، data-model.md) نقض تازه‌ای نیاورد. migration ندارد، و وابستگی تازه هم ندارد.

## Project Structure

### Documentation (this feature)

```text
specs/006-avatar-upload-via-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/caravansara/
│   ├── core/storage.py          # put_bytes docstring: avatars too; presigned_upload stays for listings
│   ├── core/errors.py           # ServiceUnavailable (503); 413/415/503 in error_responses
│   └── identity/
│       ├── router.py            # PUT /me/avatar takes the file; upload-url removed; openapi_extra body
│       ├── schemas.py           # AvatarUploadUrlIn/Out and AvatarSetIn removed; ProfileUpdate text
│       ├── service.py           # read_limited, check bytes, put, lock, commit, delete old / new on failure
│       └── repository.py        # get_user_for_update (SELECT … FOR UPDATE)
├── openapi.json                 # export-openapi: 38 operations
└── tests/test_avatar.py         # rewritten: through the API only; storage listed before and after

frontend/
├── src/app/api/v1/[...path]/route.ts   (+ route.test.ts)   # body cap 413 and streaming
├── src/components/account/AvatarUploader.tsx (+ test)      # one PUT with the file
├── src/api/schema.d.ts                  # regenerated
├── scripts/messages_source.py → messages/{fa,en}.json       # unsupported_image_type
└── src/lib/errors.ts                    # if 413/415 need mapping

e2e/tests/web.spec.ts                    # avatar through the site; bad file leaves storage unchanged
postman/Caravansara.postman_collection.json   # 38 operations; PUT with a binary body
docs/backend-design.md, docs/future-work.md, README.md, backend/README.md, frontend/README.md
```

**Structure Decision:** همان ساختار web application موجود (`backend/`، `frontend/`، `e2e/`). پوشه‌ی تازه‌ای نیست.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| عکس پروفایل از API می‌گذرد، برخلاف بند «files never pass through the API» | تصمیم مالک پروژه (2026-11-08): عکسی که قاعده‌ها را ندارد هرگز نباید در storage نوشته شود، از هر کلاینتی. با presigned POST، storage فقط اندازه و نوع اعلام‌شده را می‌سنجد، نه محتوا. پس فایل جعلی پیش از هر بررسی ذخیره می‌شود. | **آپلود مستقیم با پاک‌سازی دوره‌ای:** فایل بد تا پاک‌سازی در storage می‌ماند. **فقط بررسی سایت:** کلاینتی که از سایت نگذرد آن را دور می‌زند. هر دو را مالک پروژه رد کرد. |
