# Specification Quality Checklists: بکند، کارهای ۰۰۱ تا ۰۰۴

این فایل `checklists.md` چهار کار بکند را، که با Spec Kit ساخته و merge شده‌اند، کنار هم دارد: هر کار یک بخش، به ترتیب شماره. متن هر بخش همان متن پوشه‌ی اصلی آن کار (`specs/NNN-name/`) است، که در 2026-11-09 در این پوشه ادغام شد. شناسه‌ها (`FR-001`، `SC-001`، `T001`، `R1`، `US1`) همان‌اند که در قالب‌های Spec Kit، و درون بخش هر کار معنی دارند. پس ارجاع از بیرون به این شکل است: «`specs/backend`، کار ۰۰۴، research R5».

## 001. داده‌ی تست و ماک بیشتر و متنوع‌تر

### `checklists/requirements.md`


**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-05
**Feature**: [spec.md](spec.md)

#### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

#### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

#### Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

#### Notes

- کاربران این قابلیت توسعه‌دهنده، آزماینده و کسی است که دمو می‌دهد، پس «ذی‌نفع غیرفنی» در اینجا مالک پروژه است. واژه‌هایی مثل «پایگاه داده»، «seed» و «فضای ذخیره‌سازی» بخشی از خود نیاز هستند، نه جزئیات پیاده‌سازی. روش ساخت (مثلاً `COPY` و نام ابزارها) عمداً به `plan.md` سپرده شده است.
- Inside Airbnb منبع داده و شرط مجوز است، نه انتخاب فنی، پس در spec مانده است.
- دو نشانه‌ی [NEEDS CLARIFICATION] در 2026-11-05 بسته شد و پاسخ‌ها در بخش Clarifications آمده است: داده‌ی حجیم در پایگاه داده‌ی جدای `caravansara_bulk` روی همان سرور (FR-008)، و عکس‌ها تصویر ساختگی ساخته‌شده با کد (FR-013).

---

## 002. قیمت ریالی بدون سرریز

### `checklists/requirements.md`


**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-05
**Feature**: [spec.md](spec.md)

#### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

#### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

#### Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

#### Notes

- پرسش سقف قیمت (FR-001) با پاسخ مالک در 2026-11-05 بسته شد: یک سقف یک میلیاردی برای همه‌ی ارزها.
- نام ستون‌ها، کد `validation_error`، ۴۲۲ و ۵۰۰ در spec آمده‌اند، چون خود ورودی کار و قانون اساسی (اصل III، کدهای خطای ثابت) آن‌ها را نام می‌برند. این‌ها قرارداد بیرونی‌اند، نه جزئیات پیاده‌سازی.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

---

## 003. بررسی ایندکس‌ها با اندازه‌گیری

### `checklists/requirements.md`


**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-06
**Feature**: [spec.md](spec.md)

#### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

#### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

#### Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

#### Notes

- دو پرسش (FR-003 و FR-005) با پاسخ مالک در 2026-11-06 بسته شدند: آمار همیشه روشن با پنل Grafana، و هدف میانه‌ی ۵۰ میلی‌ثانیه.
- نام نوع‌های ایندکس، `EXPLAIN` و `pg_stat_statements` در ورودی کار آمده‌اند، و موضوع خود این کار ایندکس است. پس در spec نام برده می‌شوند، ولی spec نمی‌گوید کدام ایندکس ساخته شود. آن را اندازه‌گیری در plan تعیین می‌کند.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

---

## 004. تأیید آگهی توسط مدیر سیستم (admin)

### `checklists/requirements.md`


**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-06
**Feature**: [spec.md](spec.md)

#### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

#### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

#### Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

#### Notes

- همه‌ی پرسش‌ها در Clarifications (Session 2026-11-06) جواب گرفتند. FR-018 به اصلاح constitution اصل V وابسته است (Assumptions، «وابستگی»).
- «فرمان سرور» و «قرارداد API» در spec آمده‌اند، چون خود تصمیم مالک پروژه است (نقش فقط با فرمان، نه از راه عمومی)، و افزودنی ماندن قرارداد رفتار قابل‌مشاهده است. چگونگی ساختشان در plan می‌آید.
