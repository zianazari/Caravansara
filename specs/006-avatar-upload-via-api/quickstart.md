# Quickstart: آپلود عکس پروفایل از راه API

## پیش‌نیاز

```sh
docker compose -f docker-compose.yml -f e2e/compose.e2e.yml up -d --build
```

هیچ داده‌ای پاک نمی‌شود، و `-v` به کار نمی‌رود.

## ۱. تست‌ها

```sh
cd backend && uv run pytest tests/test_avatar.py tests/test_identity.py tests/test_openapi_contract.py
cd frontend && npm run lint && npm run typecheck && npm test
cd e2e && npx playwright test web.spec.ts
```

**انتظار:** همه پاس. `test_avatar.py` نشان می‌دهد هیچ فایل ردشده‌ای در MinIO نیست (SC-001 و SC-002)، و فایل ۵۰ مگابایتی با کمتر از ۶ مگابایت خواندن رد می‌شود (SC-003).

## ۲. دستی با curl، بی سایت (SC-001)

متغیرها:

- `$T`: یک access token، که از `POST /session/login` سایت یا از `auth/login` خود API گرفته می‌شود.
- `$API`: `http://localhost:8000/api/v1`

| فرمان | پاسخ مورد انتظار |
| --- | --- |
| `curl -X PUT -H "Authorization: Bearer $T" -H "Content-Type: image/png" --data-binary @photo.png $API/me/avatar` | 200، و `avatar_url` تازه |
| همان، با یک فایل ۶ مگابایتی | 413 `image_too_large` |
| همان، با `-H "Content-Type: image/gif"` | 415 `unsupported_image_type` |
| `echo hello > fake.png` و فرستادن آن با `image/png` | 422 `invalid_image` |
| `curl -X POST … $API/me/avatar/upload-url` | 404 |

پس از هر رد، فهرست `caravansara-media/avatars/<user_id>/` فقط عکس فعلی را نشان می‌دهد. برای دیدنش، اول `mc alias set local http://localhost:9000 <user> <password>` را با کاربر و رمز MinIO از `docker-compose.yml` درون کانتینر `minio` بزنید، سپس `mc ls local/caravansara-media/avatars/<user_id>/`.

## ۳. در سایت (SC-004، SC-005)

`http://localhost:3001/fa/account` را باز کنید. سپس:

1. یک PNG بگذارید.
2. یک JPEG ۵ مگابایتی بگذارید.
3. عکس را حذف کنید.
4. یک فایل متنی با نام `.png` انتخاب کنید.

**انتظار:**

- سرصفحه هر بار به‌روز می‌شود.
- فایل متنی پیش از ارسال رد می‌شود.
- در DevTools فقط یک درخواست `PUT /api/v1/me/avatar` دیده می‌شود، و هیچ درخواستی به storage نمی‌رود.
