# Implementation Plan: صفحه‌های میزبان در سایت

**Branch**: `008-host-pages` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-host-pages/spec.md`

## Summary

میزبان در سایت آگهی می‌سازد و نگه می‌دارد، بی Swagger و بی تغییر API:

- **ساخت (R1 تا R3):** گام‌به‌گام در ۸ گام، با پیش‌نویس در `sessionStorage`. آگهی فقط در گام آخر ساخته می‌شود، و عکس‌ها، دست‌کم ۳ تا، بی‌درنگ پس از آن آپلود می‌شوند (Q1).
- **عکس‌ها (R4، R5، R14):** آپلود مستقیم به storage با نوار پیشرفت (`XMLHttpRequest`)، بررسی پیش از ارسال، و ترتیب با کشیدن و دکمه.
- **آگهی‌های من (R10، R13):** وضعیت، دلیل رد، ارسال دوباره، فعال و غیرفعال، و رزروها و نظرهای هر آگهی.
- **هشدار (R8):** پیش از هر تغییری که آگهی تأییدشده را پنهان می‌کند.
- **ظاهر:** همه در تم کاروانسرایی ۰۰۷.

## Technical Context

- **Language/Version:** TypeScript 5.9.3 (strict)، React 19.3.1.
- **Primary Dependencies:** Next.js 16.4.3، Tailwind 4.3.3، `radix-ui` 1.8.1، `lucide-react`، `next-intl` 4.14.9، TanStack Query 5.104.5، `openapi-fetch` 0.17.0، MapLibre 5.24.0. **هیچ وابستگی تازه‌ای نیست**، نه در سایت و نه در e2e: کشیدن عکس‌ها با Pointer Events است (R14)، و پیشرفت آپلود با `XMLHttpRequest` (R4).
- **Storage:**
  - پیش‌نویس در `sessionStorage` مرورگر (R2).
  - عکس‌ها در همان storage آگهی‌ها، از راه presigned POST، طبق constitution 1.4.0.
  - بی migration.
- **Testing:**
  - **Vitest:** قاعده‌ها، با پوشش ≥ ۹۰٪ برای `src/lib`، و کامپوننت‌ها با axe.
  - **Playwright در Chrome واقعی روی stack:** `host.spec.ts` (تازه) و `theme.spec.ts`.
  - **بکند:** فقط تست قرارداد، که نشان می‌دهد API عوض نشده است.
- **Target Platform:** همان ۰۰۵ و ۰۰۷: دو نسخه‌ی آخر مرورگرها، گوشی از ۳۲۰ پیکسل.
- **Project Type:** web application (`frontend/`).
- **Performance Goals:**
  - SC-005: عکس ۵ مگابایتی کمتر از ۵ ثانیه روی stack محلی.
  - صفحه‌های میزبان در مرورگر رندر می‌شوند، مثل سفرهای ۰۰۵.
- **Constraints:**
  - بی تغییر API (SC-006).
  - کنتراست AA و فقط رنگ‌های تم (تست‌های ۰۰۷).
  - CSP بی‌تغییر: `connect-src` نشانی storage را دارد.
- **Scale/Scope:**
  - ۳ مسیر.
  - حدود ۱۲ کامپوننت تازه.
  - ۵ ماژول تازه در `lib/`: `listingDraft`، `imageCheck`، `photoUpload`، `reviewFields`، `listingStatus`.
  - حدود ۸۰ کلید ترجمه.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| اصل یا قاعده | وضعیت | توضیح |
| --- | --- | --- |
| I. Database guards critical rules | ✅ | پایگاه داده دست نمی‌خورد. قاعده‌های بازبینی ۰۰۴ همچنان در بکند‌اند. هشدار سایت (R8) فقط پیش‌آگاهی است. |
| II. Modular monolith | ✅ | فقط `frontend/`. |
| III. Contract-first API | ✅ | بی تغییر API: همه‌ی کارها endpoint دارند (spec، Clarifications). قاعده‌ی «دست‌کم ۳ عکس» فقط در سایت است (Q1). اگر روزی در API خواسته شود، از spec آغاز می‌شود. |
| IV. Tested against real infrastructure | ✅ | مسیر کامل میزبان در Chrome واقعی روی stack، با storage و پایگاه داده‌ی واقعی (`host.spec.ts`). هر فیلد قاعده‌ی ۰۰۴ یک تست دارد (SC-003). SC-001 زمان انسان است، و با `quickstart.md` دستی سنجیده می‌شود. |
| V. Privacy and security by default | ✅ | پیش‌نویس چیزی محرمانه ندارد (R2). نشانی دقیق فقط به API می‌رود، نه به سرویس بیرونی، چون geocoding نیست (R6). مالکیت آگهی را API می‌سنجد، و سایت چیزی از آگهی دیگران نشان نمی‌دهد (R12). |
| VI. Observable | ✅ | خطاهای آپلود و API مثل ۰۰۵ با کد ثابت در کنسول ثبت می‌شوند. سمت سرور رفتاری عوض نمی‌شود. |
| VII. Simple | ✅ | هیچ وابستگی تازه‌ای نیست (R4، R14). |
| Technology: photos | ✅ | عکس آگهی مستقیم با presigned POST به storage می‌رود (constitution 1.4.0). |
| Development Workflow: مستندسازی | ✅ | ساختارهای تازه در `docs/future-work.md` (همین مرحله)، و پس از ساخت در `docs/backend-design.md` با توضیح کد. |

**Gate:** پاس است، بی نقض.

**Re-check after Phase 1:** data-model و contracts/ui.md نقض تازه‌ای نیاوردند.

## Project Structure

### Documentation (this feature)

```text
specs/008-host-pages/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/
├── src/app/[locale]/host/page.tsx                    # my listings
├── src/app/[locale]/host/new/page.tsx                # the wizard (?step=)
├── src/app/[locale]/host/listings/[id]/page.tsx      # one listing (?tab=)
├── src/components/host/                              # ListingWizard, steps/*, LocationPicker, MoneyInput,
│                                                     # PhotoManager, HostListingCard, StatusBadge,
│                                                     # ReviewWarningDialog, HostBookings (+ tests)
├── src/components/layout/Header.tsx                  # HostLink (R11)
├── src/lib/listingDraft.ts, imageCheck.ts, photoUpload.ts, reviewFields.ts, listingStatus.ts (+ tests)
├── src/lib/avatar.ts                                 # checkAvatarFile uses imageCheck
├── eslint.config.mjs                                 # sessionStorage allowed in listingDraft.ts, as for bookingDraft
└── scripts/messages_source.py → messages/{fa,en}.json

e2e/tests/host.spec.ts (new), e2e/tests/theme.spec.ts (host pages)
docs/backend-design.md (فرانت‌اند وب), docs/future-work.md, frontend/README.md, README.md, CONTEXT.md
```

**Structure Decision:** همان `frontend/` و `e2e/`. یک پوشه‌ی تازه‌ی کامپوننت (`host/`).

## Complexity Tracking

نقضی نیست؛ خالی.
