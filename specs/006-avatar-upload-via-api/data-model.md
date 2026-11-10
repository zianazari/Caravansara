# Data Model: آپلود عکس پروفایل از راه API

**بی migration.** هیچ جدول، ستون، index یا constraint تازه‌ای نیست.

## User (بی‌تغییر)

| فیلد | قاعده |
| --- | --- |
| `avatar_url` | `NULL`، یا `{media_base_url}/avatars/{user_id}/{uuid}.{png\|jpg}`. از این پس فقط `PUT /me/avatar` (پس از بررسی) یا `PATCH /me` (با نشانی همان کاربر) آن را پر می‌کند. |

- **قفل:** هر تغییر `avatar_url` در `SELECT … FOR UPDATE` روی ردیف همان کاربر انجام می‌شود (research R6)، تا دو تغییر هم‌زمان فایل بی‌صاحب نگذارند.

## Avatar file (storage)

| ویژگی | قاعده |
| --- | --- |
| کلید | `avatars/{user_id}/{uuid4 hex}.{ext}`. `ext` از محتوا می‌آید: `png` یا `jpg` (R5). |
| اندازه | ۱ تا ۵٬۲۴۲٬۸۸۰ بایت (`settings.max_avatar_bytes`) |
| محتوا | با `89 50 4E 47 0D 0A 1A 0A` (PNG) یا `FF D8 FF` (JPEG) آغاز می‌شود. |
| `ContentType` در storage | از محتوا: `image/png` یا `image/jpeg` |
| نوشته می‌شود | فقط پس از گذشتن از هر سه قاعده (FR-002) |
| پاک می‌شود | وقتی عکس دیگری جایش می‌آید، عکس برداشته می‌شود، یا ثبت آن برای کاربر شکست می‌خورد (FR-006، FR-007) |

## چرخه‌ی یک آپلود

```text
received ──(over limit / wrong type / not an image)──▶ refused (nothing in storage)
    │
    ▼ checked
written to storage ──(lock or commit fails)──▶ new file deleted, old avatar stays
    │
    ▼ committed under the row lock
avatar set ──▶ old file deleted (a failed delete is only logged)
```
