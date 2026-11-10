# Quickstart: تم کاروانسرایی برای سایت

## پیش‌نیاز

```sh
docker compose -f docker-compose.yml -f e2e/compose.e2e.yml up -d --build
```

هیچ داده‌ای پاک نمی‌شود، و `-v` به کار نمی‌رود.

## ۱. تست‌های خودکار

```sh
cd frontend && npm run lint && npm run typecheck && npm test   # theme, no-raw-colors, components, every 005 test
cd e2e && npm ci && npx playwright test                        # theme.spec.ts: 12 pages x 5 widths, axe in a real browser
```

**انتظار:**

- همه پاس می‌شوند.
- `theme.test.ts` هر جفت token را دست‌کم AA می‌بیند.
- `no-raw-colors.test.ts` هیچ رنگ خامی پیدا نمی‌کند.
- `theme.spec.ts` در هیچ عرضی اسکرول افقی و هیچ خطای axe نمی‌بیند.

## ۲. تصویرها برای مالک پروژه (SC-001)

```sh
cd e2e && npx playwright test theme.spec.ts --grep screenshots
```

تصویرها در `specs/007-caravansara-theme/screens/` ساخته می‌شوند: ۱۲ صفحه × (۱۲۸۰ و ۳۹۰ پیکسل) × (`fa` و `en`). مالک پروژه آن‌ها را با `mockup/` مقایسه و تأیید می‌کند.

## ۳. دستی در مرورگر

| گام | انتظار |
| --- | --- |
| `http://localhost:3001/fa` روی دسکتاپ | hero شب با درگاه طاقی، قرص جستجو، دسته‌ها، ردیف‌های شهرها (ردیف بی آگهی نمی‌آید) |
| زدن دسته‌ی «سونا» | ردیف‌ها با همان فیلتر دوباره بار می‌شوند؛ «نمایش همه» دسته را به جستجو می‌برد |
| همان در DevTools، iPhone SE (۳۲۰) | جستجوی یک‌خطی، دسته‌های افقی، کارت‌های تک‌ستونه، نوار پایین سه‌بخشی، بی اسکرول افقی |
| صفحه‌ی یک آگهی روی گوشی | نوار ثابت رزرو به‌جای نوار پایین |
| تنظیم «کاهش حرکت» در سیستم | چراغ‌های hero ثابت‌اند |
| `/en` | همان تم، چپ‌به‌راست |
| مسیر کامل مهمان (ثبت‌نام → رزرو → پرداخت → سفرها → نظر → حساب → خروج) | همه‌ی صفحه‌ها تم را دارند و رفتار همان ۰۰۵ است |

## ۴. سرعت (SC-005)

همان روش `specs/005-frontend-guest/measurements.md` را روی `/fa`، جستجوی لندن و یک آگهی اجرا کنید. LCP باید کمتر از ۲٫۵ ثانیه و CLS کمتر از ۰٫۱ باشد. نتیجه در `specs/007-caravansara-theme/measurements.md` ثبت می‌شود.
