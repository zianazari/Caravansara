# CLI Contract: فرمان‌های admin

هر دو فرمان در image API هستند (`caravansara …`)، و فقط کسی که به سرور دسترسی دارد اجرایشان می‌کند (FR-012، constitution اصل V).

## `caravansara create-admin --email EMAIL --name NAME`

- **رمز:** از `CARAVANSARA_ADMIN_PASSWORD` خوانده می‌شود، یا اگر خالی باشد دو بار با `getpass` پرسیده می‌شود. ۸ تا ۱۲۸ نویسه است، و هرگز آرگومان فرمان نیست (R14).
- **موفق:** یک حساب تازه با `kind = 'admin'` ساخته می‌شود. فرمان `admin created: <id>` را چاپ می‌کند و با کد 0 خارج می‌شود. ایمیل در خروجی نیست (اصل V، log).
- **ایمیلی که هر حسابی دارد** (عضو یا admin): `refused: an account with this email already exists; admin accounts are always new`. کد 1؛ هیچ ردیفی ساخته یا عوض نمی‌شود (US4/AC2).
- **رمز نامعتبر یا دو بار نابرابر:** پیام روشن، کد 1.

## `caravansara disable-admin --email EMAIL`

- **موفق:** `disabled_at = now()` برای آن admin نوشته می‌شود. چاپ `admin disabled: <id>`، کد 0. از درخواست بعدی هیچ اقدام admin کار نمی‌کند (R2)، و سابقه‌ی تصمیم‌ها می‌ماند.
- **ایمیلی که admin نیست** (نیست، یا حساب عضو است): `refused: no admin account with this email`، کد 1.
- **از قبل از کار افتاده:** `refused: this admin account is already disabled`، کد 1.

## `caravansara seed-demo` (تغییر)

- در `CARAVANSARA_ENVIRONMENT=production`، فرمان `refused: demo data is for development only` چاپ می‌کند و با کد 1 خارج می‌شود (R15).
- داده‌ی دمو یک حساب `admin@example.com` دارد، با همان رمز همه‌ی حساب‌های دمو (`caravansara-demo`).
