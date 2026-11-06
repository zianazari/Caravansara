# Contract: فرمان `caravansara measure-queries`

API HTTP عوض نمی‌شود: `backend/openapi.json` همان می‌ماند (FR-009). رابط تازه‌ی این کار یک فرمان CLI است.

```text
caravansara measure-queries [--database NAME] [--catalog DIR] [--runs N] [--only NAME ...] [--out FILE]
```

| گزینه | پیش‌فرض | معنا |
| --- | --- | --- |
| `--database` | `caravansara_bulk` | پایگاه داده‌ی هدف روی همان سرور `database_url` |
| `--catalog` | `db/bulk/queries` (از `CARAVANSARA_SEED_DIR`) | پوشه‌ی فهرست |
| `--runs` | `5` | تعداد اجرای اندازه‌گیری، بعد از ۱ اجرای گرم‌کننده |
| `--only` | همه | فقط این کوئری‌ها |
| `--out` | هیچ | نوشتن نتیجه در JSON (data-model §۲) |

| حالت | خروجی | کد |
| --- | --- | --- |
| موفق | جدول Markdown: نام، میانه، هدف، ✓/✗، دسترسی، ایندکس‌ها | 0 |
| `environment = production` | `measure-queries is for development and measurement only` | 1 |
| پایگاه داده‌ی هدف خالی است (آگهی ندارد) | `caravansara_bulk has no listings; run: caravansara seed-bulk` | 1 |
| فهرست نامعتبر (نام تکراری، فایل SQL گم، `source` ناموجود) | `invalid query catalog: <name>: <rule>` | 1 |
| خطای SQL یک کوئری | نام کوئری و خطای پایگاه داده؛ بقیه اجرا می‌شوند | 1 در پایان |

هر کوئری اتصال تازه‌ی خودش را می‌گیرد. دلیل: وقتی یک backend یک بار JIT کند، همه‌ی کوئری‌های بعدی‌اش کند می‌شوند (۵۵ ms به ۱۵۵ ms، measurements.md)، پس اتصال مشترک عدد کوئری‌های بعدی را خراب می‌کرد. `params.sql` هم روی اتصال جدا خوانده می‌شود.

دستورهای `kind = write` همیشه در `BEGIN … ROLLBACK` اجرا می‌شوند. فرمان هیچ ردیفی را عوض نمی‌کند، و این با تست ثابت می‌شود.
