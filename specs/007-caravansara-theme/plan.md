# Implementation Plan: تم کاروانسرایی برای سایت

**Branch**: `007-caravansara-theme` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-caravansara-theme/spec.md`

## Summary

ظاهر همه‌ی صفحه‌های مهمان ۰۰۵ به تم تأییدشده‌ی کاروانسرا عوض می‌شود (`mockup/`): رنگ‌های گرم README، طاق جناغی به عنوان شکل تکرارشونده، و ساختار آشنای Airbnb.

- **رنگ‌ها:** tokenهای امروز `globals.css` مقدار تازه می‌گیرند، و چند token تازه اضافه می‌شود (R1). برای کنتراست AA، رنگ دکمه و پیوند مسی تیره است (R2).
- **طاق:** با `mask-image` ساخته می‌شود (R3).
- **صفحه‌ی اول:** hero با SVG (R8)، قرص جستجو، دسته‌ها از امکانات موجود (R5، R6)، و یک ردیف کارت برای هر شهر پیشنهادی با جستجوی موجود (R4).
- **گوشی:** نوار پایین (R7).
- **بی‌تغییر:** هیچ تغییری در API، پایگاه داده یا رفتار ۰۰۵ نیست (FR-011).

## Technical Context

- **Language/Version:** TypeScript 5.9.3 (strict)، React 19.3.1.
- **Primary Dependencies:** Next.js 16.4.3 (App Router)، Tailwind CSS 4.3.3 (`@theme inline`)، `radix-ui` 1.8.1 (اجزای shadcn)، `lucide-react` 1.61.0 (آیکون)، `next-intl` 4.14.9، TanStack Query 5.104.5، MapLibre 5.24.0. هیچ وابستگی تازه‌ای در frontend نیست. فقط `axe-core` 4.14.0، همان نسخه‌ی frontend، به devDependencies `e2e/` اضافه می‌شود (R11).
- **Storage:** ندارد.
- **Testing:** Vitest (`theme.test.ts`، `no-raw-colors.test.ts`، تست کامپوننت‌های تازه، همه‌ی تست‌های ۰۰۵)؛ Playwright در Chrome واقعی (`e2e/tests/theme.spec.ts`: عرض‌ها، axe و تصویرها).
- **Target Platform:** دو نسخه‌ی آخر Chrome، Safari، Firefox و Edge؛ گوشی از ۳۲۰ پیکسل.
- **Project Type:** web application (`frontend/`).
- **Performance Goals:** LCP کمتر از ۲٫۵ ثانیه و CLS کمتر از ۰٫۱، مثل ۰۰۵ (SC-005)؛ hero بی عکس، و ردیف‌های شهرها پس از اولین نمایش.
- **Constraints:**
  - کنتراست AA برای هر جفت token (FR-002).
  - هیچ رنگ خام بیرون از `globals.css` (FR-001).
  - CSP بی‌تغییر، چون `data:` در `img-src` هست.
  - همه‌ی تست‌های ۰۰۵ پاس می‌مانند.
- **Scale/Scope:**
  - حدود ۱۲ صفحه و حدود ۳۰ کامپوننت ظاهرشان عوض می‌شود.
  - ۶ کامپوننت تازه: `Hero`، `ArchFrame`، `CategoryBar`، `CityRow`، `BottomNav`، `MobileBookingBar`.
  - حدود ۲۰ کلید ترجمه‌ی تازه.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل یا قاعده | وضعیت | توضیح |
| --- | --- | --- |
| I. Database guards critical rules | ✅ | پایگاه داده دست نمی‌خورد. |
| II. Modular monolith | ✅ | فقط `frontend/`. |
| III. Contract-first API | ✅ | `openapi.json` بی‌تغییر است، و همه‌ی داده‌ها از endpointهای موجودند (R4، R5). چیزهایی که API تازه می‌خواهند، یعنی علاقه‌مندی‌ها، دسته‌های تازه و فیلتر نوع اقامتگاه، در `docs/future-work.md` برای کار جدا ثبت می‌شوند. |
| IV. Tested against real infrastructure | ✅ | کنتراست و اسکرول افقی در Chrome واقعی روی stack سنجیده می‌شوند. تست‌های ۰۰۵ می‌مانند. |
| V. Privacy and security by default | ✅ | CSP، نشست و داده‌ها بی‌تغییرند. هیچ منبع بیرونی تازه‌ای نیست: فونت محلی است و hero با SVG ساخته می‌شود. |
| VI. Observable | ✅ | رفتاری عوض نمی‌شود. خطای ردیف شهر مثل خطاهای امروز با `console.error` ثابت ثبت می‌شود. |
| VII. Simple | ✅ | هیچ وابستگی تازه‌ای در frontend نیست. تم همان tokenهای موجود است. |
| Technology: Front-end (Next.js، shadcn/ui، Tailwind با logical properties، Persian RTL با Vazirmatn) | ✅ | همان. طاق‌ها قرینه‌اند، و چیدمان با logical properties می‌ماند. |
| Development Workflow: مستندسازی | ✅ | ساختارهای تازه (tokenها، طاق، نشان، دسته، ردیف شهر، نوار پایین) در `docs/future-work.md` (همین مرحله) و پس از ساخت در `docs/backend-design.md`، بخش «فرانت‌اند وب»، با توضیح کد می‌آیند. |

**Gate:** پاس است. نقض یا استثنایی نیست.

**Re-check after Phase 1:** طراحی (data-model، contracts/ui.md) نقض تازه‌ای نیاورد. سه اصلاح spec (R5، R6، R7) همه دامنه را کوچک‌تر یا روشن‌تر کردند، و هیچ‌کدام API نمی‌خواهد.

## Project Structure

### Documentation (this feature)

```text
specs/007-caravansara-theme/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui.md
├── mockup/              # approved by the owner, 2026-11-09
├── checklists/requirements.md
├── screens/             # made by theme.spec.ts for the owner's review (SC-001)
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/
├── src/app/globals.css                 # tokens (R1, R2), arch / arch-soft masks (R3), reduced motion
├── src/app/icon.svg                    # arch favicon (R9)
├── src/app/[locale]/layout.tsx         # BottomNav, bottom padding
├── src/app/[locale]/page.tsx           # Hero, search pill, CategoryBar, CityRow x 6, arcade band
├── src/app/[locale]/{search,listings,login,register,book,trips,account}/…   # themed layouts
├── src/app/[locale]/{error,not-found}.tsx
├── src/components/brand/               # new: Logo, Hero, ArchFrame, ArcadeBand
├── src/components/home/                # new: CategoryBar, CityRow (+ tests)
├── src/components/layout/              # Header (pill menu), Footer, BottomNav (+ test)
├── src/components/search/              # SearchForm (pill + one-line mobile), ResultCard (badge, arch), ResultsMap markers
├── src/components/listing/             # Gallery (arch-soft, dots, swipe), BookingBox, MobileBookingBar
├── src/components/ui/                  # button, input, dialog, … read the new tokens; no raw colours
├── src/lib/badge.ts, src/lib/categories.ts   # new (+ tests)
├── src/theme.test.ts, src/no-raw-colors.test.ts   # new (R11)
└── scripts/messages_source.py → messages/{fa,en}.json   # new keys (contracts/ui.md)

e2e/
├── package.json                        # + axe-core 4.14.0
└── tests/theme.spec.ts                 # widths, axe, screenshots → specs/007-caravansara-theme/screens/

docs/backend-design.md (فرانت‌اند وب), docs/future-work.md, frontend/README.md, README.md (screenshot)
```

**Structure Decision:** همان `frontend/` و `e2e/` موجود. دو پوشه‌ی تازه‌ی کامپوننت (`brand/`، `home/`) برای اجزای تازه، تا اجزای ۰۰۵ در جای خود بمانند.

## Complexity Tracking

نقضی نیست؛ خالی.
