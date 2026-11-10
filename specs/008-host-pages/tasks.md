---

description: "Task list for feature implementation"
---

# Tasks: صفحه‌های میزبان در سایت

**Input**: Design documents from `/specs/008-host-pages/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: لازم‌اند. constitution اصل IV برای هر قاعده تست خودکار می‌خواهد.
- **Vitest:** قاعده‌های `lib/`، با پوشش ≥ ۹۰٪، و کامپوننت‌ها با axe.
- **Playwright در Chrome واقعی روی stack:** مسیر کامل میزبان و تم.
- **ترتیب:** تست‌های هر بخش اول نوشته می‌شوند و باید پیش از پیاده‌سازی شکست بخورند.
- **بکند:** تغییری ندارد. تست قرارداد پاس می‌ماند (SC-006).

**Organization**:
- کارها بر اساس user story دسته‌بندی شده‌اند.
- کارهایی که یک فایل را تغییر می‌دهند، پشت سر هم آمده‌اند و `[P]` ندارند.
- همه‌ی متن‌های تازه یک بار در Phase 1 به `messages_source.py` می‌روند.

**قاعده‌ی مستندسازی (مالک پروژه، 2026-11-07)**: هر ساختار تازه دلیل و اثرش را در دو جا می‌گیرد: پیش‌نویس، ساخت در گام آخر، `XMLHttpRequest`، `imageCheck`، `reviewFields` و پیوند میزبان.
- یک توضیح کوتاه در کد، کنار تعریفش.
- `docs/backend-design.md`، بخش «فرانت‌اند وب» (T038).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: می‌تواند موازی اجرا شود (فایل جدا، بی وابستگی به کار ناتمام)
- **[Story]**: US1 تا US4

## Path Conventions

- سایت: `frontend/src/`
- پیام‌ها: `frontend/scripts/messages_source.py` → `frontend/messages/{fa,en}.json`
- e2e: `e2e/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 افزودن همه‌ی متن‌های تازه به `frontend/scripts/messages_source.py`، به فارسی و انگلیسی، و ساختن دوباره‌ی `frontend/messages/{fa,en}.json`:
  - **`nav`:** `becomeHost` («میزبان شوید»)، `myListings` («آگهی‌های من»).
  - **`host.*`:** فهرست، کارت، وضعیت‌ها («در انتظار تأیید»، «فعال»، «غیرفعال»، «رد شده»، «عکس‌ها کامل نیست»)، دلیل رد، «ارسال دوباره»، فعال و غیرفعال با توضیح، صفحه‌ی خالی، زبانه‌ها، رزروها و هشدار بازبینی.
  - **`wizard.*`:** ۸ گام، «گام {n} از {total}»، «قبلی»، «بعدی»، «ارسال برای بازبینی»، «شروع از نو»، و برچسب، راهنما و پیام هر فیلد با همان قاعده‌های `data-model.md`. از جمله «مهمان پیش از رزرو فقط جای تقریبی را می‌بیند».
  - **`photos.*`:** انتخاب، پیشرفت، «دوباره»، «جلوتر»، «عقب‌تر»، «کاور کن»، برچسب، توضیح، حذف، «دست‌کم ۳ عکس لازم است»، «حذف ممکن نیست: اول عکس تازه بگذارید»، و پیام‌های فایل بد (بیش از ۱۰ مگابایت، قالب، نه عکس).
  - **شرط:** `src/messages.test.ts` پاس شود: کلیدهای یکسان، و بی انگلیسی در فارسی.
- [X] T002 [P] در `frontend/eslint.config.mjs`: `src/lib/listingDraft.ts` و تستش به همان استثنای `sessionStorage` فایل `bookingDraft` افزوده شوند، با همان توضیح: پیش‌نویس چیزی محرمانه ندارد (research R2).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: قاعده‌های مشترک که همه‌ی storyها به آن تکیه دارند.

### Tests (اول، شکست‌خورده) ⚠️

- [X] T003 [P] `frontend/src/lib/imageCheck.test.ts`:
  - **پذیرش:** JPEG (`FF D8 FF`)، PNG (`89 50 4E 47 0D 0A 1A 0A`) و WebP (`RIFF` و `WEBP` در بایت ۸) تا ۱۰٬۴۸۵٬۷۶۰ بایت.
  - **رد:**
    - ۱۰٬۴۸۵٬۷۶۱ بایت: `too_large`
    - GIF یا PDF: `wrong_type`
    - متن با نام `.jpg`: `not_image`
    - فایل خالی: `not_image`
  - **آواتار:** تست‌های `avatar.test.ts` پاس بمانند: PNG و JPEG، ۵ مگابایت.
- [X] T004 [P] `frontend/src/lib/listingDraft.test.ts`:
  - ذخیره و خواندن هر گام.
  - پاک شدن با `clearListingDraft`.
  - داده‌ی خراب یا کهنه در storage `null` می‌دهد.
  - بی storage (حالت خصوصی) پیش‌نویس فقط در حافظه است.
- [X] T005 [P] `frontend/src/lib/reviewFields.test.ts`:
  - **بازبینی می‌خواهد:** برای هر فیلد فهرست «بازبینی می‌خواهد» در `data-model.md`، `needsReview(before, after)` برای آگهی `approved` درست است.
  - **بی بازبینی:** برای هر فیلد فهرست «بی بازبینی» نادرست است.
  - **فقط تأییدشده:** برای `pending` و `rejected` همیشه نادرست است.
  - **مقدار عوض‌نشده:** نادرست است، مثلاً همان عنوان با فاصله‌ی اضافه‌ی پاک‌شده یا همان امکانات با ترتیب دیگر.
  - این تست SC-003 است.
- [X] T006 [P] `frontend/src/lib/listingStatus.test.ts`:
  - هر ردیف جدول `data-model.md`، Listing status.
  - `fewPhotos` برای ۰ تا ۲ عکس، و نه برای ۳.
- [X] T007 [P] `frontend/src/lib/money.test.ts`، تست‌های تازه‌ی `tomanToRial` و `parseAmountInput`:
  - **تبدیل:** «۲٬۵۰۰٬۰۰۰» به `"25000000.00"`، و «2500000.5» به `"25000005.00"`.
  - **ورودی:** رقم فارسی و جداکننده‌ها پذیرفته می‌شوند. ورودی نامعتبر `null` می‌دهد.
  - **سقف:** بیش از ۱٬۰۰۰٬۰۰۰٬۰۰۰ ریال پس از تبدیل رد می‌شود.

### Implementation

- [X] T008 `frontend/src/lib/imageCheck.ts`:
  - `checkImageFile(file, { maxBytes, types })` با سه بررسی اندازه، نوع و امضای بایت‌ها. امضای WebP هم در آن است.
  - `MAX_PHOTO_BYTES = 10 * 1024 * 1024` و `PHOTO_TYPES`.
  - `frontend/src/lib/avatar.ts`: `checkAvatarFile` از همین تابع استفاده می‌کند.
  - توضیح کد: یک قاعده در یک جا (R5).
- [X] T009 [P] `frontend/src/lib/listingDraft.ts`: مثل `bookingDraft.ts`، با کلید `cv-listing-draft` در `sessionStorage`. فیلدهای گام ۱ تا ۷ (`data-model.md`). فایل عکس‌ها در آن نیست. توضیح کد: R2.
- [X] T010 [P] `frontend/src/lib/reviewFields.ts`: فهرست ۰۰۴ (`REVIEW_FIELDS`) و `needsReview`. توضیح کد: فهرست از قاعده‌ی کار ۰۰۴، `specs/backend (004)`، FR-009 و FR-010.
- [X] T011 [P] `frontend/src/lib/listingStatus.ts`: `statusOf(listing)` و `hasFewPhotos(listing)` (`MIN_PHOTOS = 3`، Q1).
- [X] T012 `frontend/src/lib/money.ts`: `tomanToRial` و `parseAmountInput`، با BigInt روی رشته‌ی دهدهی، و `MAX_AMOUNT = "1000000000.00"`.
- [X] T013 اجرای `npm run lint && npm run typecheck && npm test` در `frontend/`. همه‌ی تست‌ها پاس، از جمله آواتار ۰۰۵ و ۰۰۶.

**Checkpoint**: قاعده‌ها آماده‌اند.

---

## Phase 3: User Story 2 - عکس‌های آگهی (Priority: P1)

**Goal**: (پیش از US1، چون گام آخر ساخت همان `PhotoManager` است؛ analyze F1.) مدیریت عکس‌های آگهی موجود: افزودن با پیشرفت، ترتیب، کاور، برچسب و توضیح، و حذف با قاعده‌ی ۳ عکس.

**Independent Test**: سه عکس بگذارید، ترتیب را عوض کنید و دومی را کاور کنید. کارت آگهی کاور تازه را دارد. فایل ۱۲ مگابایتی و فایل متنی پیش از ارسال رد می‌شوند.

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] `frontend/src/components/host/PhotoManager.test.tsx`:
  - **فایل بد:** پیش از ارسال پیام دارد، و API صدا زده نمی‌شود (SC-002).
  - **آپلود:** پیشرفت و «دوباره» برای شکست. شکست یکی بقیه را نمی‌ایستاند.
  - **ترتیب و کاور:** «جلوتر»، «عقب‌تر» و «کاور کن» `PUT …/photos/order` را با همه‌ی شناسه‌ها، کاور اول، می‌فرستند.
  - **کشیدن:** pointer events ترتیب را عوض می‌کند.
  - **حذف:** با ۳ عکس غیرفعال است، با توضیح. با ۴ عکس با تأیید حذف می‌کند.
  - **هشدار برای آگهی تأییدشده:** عکس تازه یا تغییر برچسب و توضیح هشدار بازبینی دارد، اما ترتیب، کاور و حذف نه.

### Implementation for User Story 2

- [X] T015 [US2] `frontend/src/lib/photoUpload.ts`:
  - `uploadPhoto(listingId, file, { onProgress, signal })`: سه گام upload-url، سپس presigned POST با `XMLHttpRequest` و `upload.onprogress`، سپس `POST …/photos`، با `width` و `height` از `createImageBitmap`.
  - `uploadAll(items, concurrency = 2)`.
  - تست در `photoUpload.test.ts`، با XHR جعلی: پیشرفت، شکست و لغو.
  - توضیح کد: چرا XHR (R4).
- [X] T016 [US2] `frontend/src/components/host/ReviewWarningDialog.tsx`: dialog با متن «این تغییر آگهی را تا تأیید دوباره‌ی مدیر از دید مهمان‌ها پنهان می‌کند»، و «ذخیره و فرستادن برای بازبینی» یا «انصراف».
- [X] T017 [US2] `frontend/src/components/host/PhotoManager.tsx`:
  - شبکه‌ی عکس‌ها در `ArchFrame`.
  - انتخاب چند فایل، `checkImageFile` و `uploadPhoto` با پیشرفت.
  - ترتیب با کشیدن (Pointer Events) و دکمه‌ها. «کاور کن» عکس را اول می‌کند.
  - برچسب اتاق و توضیح با `PATCH …/photos/{id}`.
  - حذف با `DELETE`، و قاعده‌ی `MIN_PHOTOS`.
  - هشدار با `ReviewWarningDialog`، طبق `REVIEW_FIELDS`.
  - همان کامپوننت در گام ۸ ساخت، در حالت «پیش از آگهی» (بی API تا ارسال).
  - توضیح کد: R9 و R14.

**Checkpoint**: عکس‌ها کامل.

---

## Phase 4: User Story 1 - میزبان آگهی تازه می‌سازد (Priority: P1) 🎯 MVP

**Goal**: «میزبان شوید» و ساخت آگهی در ۸ گام، با ارسال در گام آخر.

**Independent Test**: با یک حساب تازه، یک آگهی کامل با سه عکس بسازید. آگهی در «آگهی‌های من» «در انتظار تأیید» است، در جستجو نیست، و در صف مدیر هست.

### Tests for User Story 1 ⚠️

- [X] T018 [P] [US1] `frontend/src/components/host/ListingWizard.test.tsx`:
  - **گام‌ها:** «گام n از ۸» در هر گام دیده می‌شود.
  - **بررسی:** با فیلد نادرست، «بعدی» پیام کنار همان فیلد می‌دهد و نمی‌رود. عنوان بیش از ۲۰۰ نویسه و مهمان ۰ رد می‌شوند.
  - **back:** به گام قبل می‌رود، با `?step=`.
  - **پیش‌نویس:** پس از دوباره‌سازی صفحه، پاسخ‌ها از پیش‌نویس برمی‌گردند.
  - **ارسال:** با کمتر از ۳ عکس غیرفعال است، با پیام.
  - **ترتیب ارسال (R3)، با mock API و `photoUpload`:**
    1. `POST /listings` با همه‌ی فیلدها و `amenity_ids`.
    2. برای هر عکس: upload-url، آپلود و ثبت با پهنا و بلندی.
    3. `PUT …/photos/order`.
    4. پاک شدن پیش‌نویس، و رفتن به `/host/listings/{id}`.
  - **شکست یک عکس:** آگهی ساخته‌شده می‌ماند، دکمه‌ی «دوباره» می‌آید، و پیش‌نویس پاک نمی‌شود.
  - **قیمت ریالی:** به تومان نوشته و ×۱۰ فرستاده می‌شود.
  - **خطای فیلد (FR-015، analyze G1):** پاسخ `422 validation_error` با `details.fields: ["title"]` پیام را کنار عنوان می‌گذارد، و ساخت به گام ۵ (توصیف) برمی‌گردد.
- [X] T019 [P] [US1] `frontend/src/components/host/LocationPicker.test.tsx`، با MapLibre mock‌شده مثل `ResultsMap.test.tsx`:
  - انتخاب شهر نقشه را روی پین آگهی همان شهر می‌برد.
  - پین با کشیدن مختصات را عوض می‌کند.
  - کادرهای عرض و طول با صفحه‌کلید کار می‌کنند و با پین همگام‌اند.
  - راهنمای «جای تقریبی» دیده می‌شود.
- [X] T020 [P] [US1] `frontend/src/components/layout/Header.test.tsx` (تازه):
  - وارد‌نشده: «میزبان شوید» به `/login?returnTo=/host/new`.
  - واردشده بی آگهی: «میزبان شوید» به `/host/new`.
  - با آگهی: «آگهی‌های من» به `/host`.
  - روی گوشی در منوی حساب است.

### Implementation for User Story 1

- [X] T021 [P] [US1] `frontend/src/components/host/MoneyInput.tsx`: ورودی قیمت با واحد پول. برای `IRR` برچسب تومان، و تبدیل با `tomanToRial`. رقم فارسی پذیرفته می‌شود.
- [X] T022 [P] [US1] `frontend/src/components/host/LocationPicker.tsx`:
  - همان بار تنبل MapLibre `ResultsMap`، و پین قابل‌کشیدن.
  - کادرهای عرض و طول.
  - مرکز از `GET /search/listings?city_id&limit=1`، یا نمای دور برای شهر بی آگهی (R6).
  - دست‌کم ۲۵۰ پیکسل بلندی.
- [X] T023 [US1] `frontend/src/components/host/steps/`: هشت گام، هر کدام یک کامپوننت با `value`، `onChange` و `errors`:
  - `TypeStep`
  - `LocationStep`: `CityCombobox` و `LocationPicker`
  - `CapacityStep`: `max_pets` با `pets_allowed` نادرست صفر و غیرفعال
  - `AmenitiesStep`: گروه‌های `GET /amenities`، همان نام‌های ترجمه‌شده‌ی `FiltersPanel`
  - `DescriptionStep`: شمارنده‌ی نویسه
  - `PriceStep`: `MoneyInput`، و پیش‌فرض واحد پول از کشور شهر: IR→IRR، GB→GBP، SE→SEK، DK→DKK، US→USD، و بقیه EUR. فهرست انتخاب: IRR، EUR، GBP، SEK، DKK، USD (R7، analyze U1)
  - `TimesStep`
  - `PhotosStep`: انتخاب، بررسی با `checkImageFile` و پیش‌نمایش. آپلود در گام آخر.
  - قاعده‌ها همان جدول `data-model.md`.
- [X] T024 [US1] `frontend/src/components/host/ListingWizard.tsx`:
  - گام در `?step=`، پیشرفت، و «قبلی» و «بعدی». روی گوشی ثابت پایین‌اند، به‌جای نوار پایین.
  - پیش‌نویس با `listingDraft`، و «شروع از نو».
  - ارسال طبق R3، با `photoUpload.uploadAll`.
  - خطای API با `errorMessage`. برای `validation_error`، نام فیلدهای `details.fields` به گام خودشان نگاشت می‌شوند (جدول `data-model.md`)، پیام کنار همان فیلد می‌آید، و ساخت به نخستین گام نادرست برمی‌گردد. دیگر خطاها بالای گام می‌آیند.
- [X] T025 [US1] `frontend/src/app/[locale]/host/new/page.tsx` با `RequireAuth` و `ListingWizard`، و `frontend/src/components/layout/BottomNav.tsx`: نوار پایین در `/host/new` نیست، چون دکمه‌های گام آنجا هستند (R7 کار ۰۰۷).
- [X] T026 [US1] `frontend/src/components/layout/Header.tsx`: `HostLink`، با `GET /me/listings?limit=1`، cache پنج دقیقه، و پنهان روی گوشی، در منوی حساب (R11).

**Checkpoint**: میزبان آگهی را از سایت می‌سازد. MVP.

---

## Phase 5: User Story 3 - آگهی‌های من: وضعیت، ویرایش، فعال و غیرفعال (Priority: P1)

**Goal**: فهرست آگهی‌ها با وضعیت، صفحه‌ی هر آگهی با زبانه‌ها، دلیل رد، ارسال دوباره، فعال و غیرفعال، و ویرایش با هشدار.

**Independent Test**: آگهی ردشده دلیل و «ارسال دوباره» دارد. پس از ارسال، «در انتظار تأیید» است. غیرفعال کردن آگهی را از جستجو بیرون می‌برد، و فعال کردن آن را برمی‌گرداند.

### Tests for User Story 3 ⚠️

- [X] T027 [P] [US3] `frontend/src/components/host/HostListings.test.tsx`:
  - **کارت‌ها:** با کاور، عنوان، شهر، قیمت و نشان وضعیت، که متن و آیکون دارد، نه فقط رنگ.
  - **کم‌عکس:** «عکس‌ها کامل نیست» با پیوند به زبانه‌ی عکس‌ها.
  - **صفحه‌ی خالی:** با «ساخت اولین آگهی».
  - **صفحه‌بندی:** هست.
- [X] T028 [P] [US3] `frontend/src/components/host/HostListingEditor.test.tsx`:
  - **رد شده:** دلیل رد و «ارسال دوباره» (`POST …/resubmit`).
  - **فعال و غیرفعال:** `PATCH {is_active}`، بی هشدار.
  - **تغییر بی بازبینی:** قیمت و ظرفیت بی هشدار ذخیره می‌شوند.
  - **تغییر با بازبینی:** عنوان، مکان و امکانات (`PUT …/amenities`) در آگهی تأییدشده هشدار دارند، و «انصراف» چیزی نمی‌فرستد.
  - **آگهی کس دیگر:** «یافت نشد» (R12).
  - **نظرها (US4/AC2، analyze G2):** زبانه‌ی «نظرها» امتیاز کلی، امتیازهای جزئی و متن هر نظر را دارد.
  - **تصمیم هم‌زمان مدیر (Edge Case، analyze L2):** پس از هر ذخیره، آگهی دوباره خوانده می‌شود، و وضعیت تازه‌ی سرور دیده می‌شود، حتی اگر مدیر در این میان آن را تأیید یا رد کرده باشد.

### Implementation for User Story 3

- [X] T029 [P] [US3] `frontend/src/components/host/StatusBadge.tsx` و `HostListingCard.tsx`: کاور در `arch-soft`، و نشان‌ها با token. از قاعده‌ی رنگ ۰۰۷ (`no-raw-colors`) پیروی می‌کنند.
- [X] T030 [US3] `frontend/src/app/[locale]/host/page.tsx`: `RequireAuth`، `GET /me/listings` با صفحه‌بندی، شبکه‌ی `HostListingCard`، دکمه‌ی «آگهی تازه»، و صفحه‌ی خالی.
- [X] T031 [US3] `frontend/src/components/host/HostListingEditor.tsx` و `frontend/src/app/[locale]/host/listings/[id]/page.tsx`:
  - سرآیند با کاور، وضعیت، کلید فعال و غیرفعال، و دلیل رد با «ارسال دوباره».
  - زبانه‌ها در `?tab=`:
    - **مشخصات:** همان کامپوننت‌های گام ۱ تا ۷، و ذخیره با `PATCH`، `PUT …/amenities` و هشدار R8.
    - **عکس‌ها:** `PhotoManager`.
    - **رزروها و نظرها:** US4.
  - آگهی کس دیگر: `notFound`.
  - پس از هر ذخیره، query آگهی invalidate می‌شود، تا وضعیت تازه‌ی سرور بیاید (analyze L2).

**Checkpoint**: میزبان آگهی‌هایش را نگه می‌دارد.

---

## Phase 6: User Story 4 - رزروها و نظرهای هر آگهی (Priority: P2)

**Goal**: رزروها و نظرهای هر آگهی در صفحه‌ی آن.

**Independent Test**: برای آگهی‌ای با یک رزرو قطعی و یک لغوشده، هر دو با وضعیت و تاریخ درست دیده می‌شوند.

### Tests for User Story 4 ⚠️

- [X] T032 [P] [US4] `frontend/src/components/host/HostBookings.test.tsx`:
  - **ترتیب:** پیش‌رو اول، سپس گذشته.
  - **تاریخ:** تقویم شمسی در `/fa` و میلادی در `/en`.
  - **هر رزرو:** تعداد مهمان، وضعیت (در انتظار پرداخت، قطعی، لغوشده، انجام‌شده) و مبلغ به تومان برای ریال.
  - **صفحه‌بندی** و **صفحه‌ی خالی**.

### Implementation for User Story 4

- [X] T033 [US4] `frontend/src/components/host/HostBookings.tsx`: از `GET /listings/{id}/bookings`، با `formatDate` و `cityTime`، و نشان وضعیت. اتصال در زبانه‌ی «رزروها» و «نظرها» (همان `ReviewList` صفحه‌ی آگهی) در `HostListingEditor.tsx`.

**Checkpoint**: همه‌ی storyها.

---

## Phase 7: Polish & Cross-Cutting Concerns

### تست مرورگر، stack و زمان‌ها

- [X] T034 `e2e/tests/host.spec.ts` (تازه)، در Chrome واقعی روی stack:
  - **ساخت:** ثبت‌نام، سپس «میزبان شوید»، سپس ۸ گام از راه خود صفحه‌ها: نقشه با کلیک، قیمت تومان، و سه عکس از `postman/sample-photo.jpg` با `setInputFiles`.
  - **پس از ارسال:**
    - صفحه‌ی آگهی «در انتظار تأیید» است.
    - در API، `price_per_night` همان ×۱۰ است.
    - آگهی در صف مدیر هست، با `findInSearch`.
    - آگهی در جستجو نیست.
  - **پس از تأیید با `approve`:**
    - **قیمت:** تغییرش بی هشدار است.
    - **عنوان:** تغییرش هشدار دارد، و پس از تأیید، آگهی «در انتظار تأیید» می‌شود.
    - **ترتیب و کاور:** کاور تازه در کارت دیده می‌شود.
    - **حذف:** با ۳ عکس غیرفعال است.
    - **غیرفعال، سپس فعال:** آگهی از جستجو بیرون می‌رود و برمی‌گردد. رزرو موجودش در زبانه‌ی «رزروها» می‌ماند (US3/AC5، analyze L1).
  - **رد با دلیل:** دلیل دیده می‌شود، «ارسال دوباره» کار می‌کند، و آگهی «در انتظار تأیید» می‌شود.
  - **آگهی کس دیگر:** «یافت نشد».
  - **SC-005:** زمان یک عکس ۵ مگابایتی از ارسال تا دیدن در آگهی ثبت می‌شود. assertion سخت فقط با حاشیه‌ی امن ۱۵ ثانیه است، تا تست روی ماشین کند ناپایدار نشود. هدف ۵ ثانیه در T041 سنجیده و گزارش می‌شود (analyze L3).
- [X] T035 `e2e/tests/theme.spec.ts`: سه صفحه‌ی میزبان (`/host`، `/host/new?step=2`، `/host/listings/{id}?tab=photos`) به فهرست `PAGES` و تصویرها افزوده شوند. پنج عرض، دو زبان، axe و بی اسکرول افقی (SC-004).
- [X] T036 ساختن دوباره‌ی stack (`docker compose -f docker-compose.yml -f e2e/compose.e2e.yml up -d --build`، بی `-v`) و اجرای همه‌ی e2e. همه پاس، سه بار پشت هم.
- [X] T037 `cd backend && uv run pytest tests/test_openapi_contract.py`، و `git diff --exit-code backend/openapi.json`: API عوض نشده است (SC-006).

### مستندها

- [X] T038 [P] `docs/backend-design.md`، بخش «فرانت‌اند وب»: زیربخش «صفحه‌های میزبان (کار ۰۰۸)»:
  - جدول ساختار، چرا و اثر، از جدول `docs/future-work.md`.
  - قاعده‌ی ۳ عکس فقط در سایت، و دلیل آن.
  - هشدار بازبینی.
  - نتیجه‌ی تست‌ها.
  - ساختن دوباره‌ی PDF.
- [X] T039 [P] `docs/future-work.md`: بخش ۰۰۸ به کارهای انجام‌شده برود. کارهای باقی‌مانده بمانند، اگر هست: قاعده‌ی ۳ عکس در API، و وضعیت پیش‌نویس در API (گزینه‌ی C پرسش Q1).
- [X] T040 [P] `README.md` (توصیف سایت، شمار تست‌ها)، `frontend/README.md` (مسیرهای `host/`، قاعده‌ها) و `CONTEXT.md`.

### بررسی نهایی

- [X] T041 اجرای `specs/008-host-pages/quickstart.md`، بخش ۱ تا ۳، و ثبت نتیجه در همین task. SC-001 (زمان انسان) به مالک پروژه گفته می‌شود.
- [X] T042 (کنار گذاشته شد: مالک پروژه در 2026-11-10 روش Spec Kit را کنار گذاشت، constitution 2.0.0؛ به‌جای converge، e2e کامل روی stack و بررسی سندها انجام شد) اجرای `/speckit-converge` تا Converged، پیش از pull request (constitution).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1):** بی وابستگی.
- **Foundational (Phase 2):** همه‌ی storyها را متوقف می‌کند، چون قاعده‌ها در `lib/` هستند.
- **US2 (Phase 3):** پس از Phase 2. پیش از US1، چون گام آخر ساخت همان `PhotoManager` در حالت «پیش از آگهی» است (analyze F1).
- **US1 (Phase 4):** پس از US2.
- **US3 (Phase 5):** پس از US2، چون زبانه‌ی عکس‌ها `PhotoManager` است. می‌تواند هم‌زمان با US1 پیش برود.
- **US4 (Phase 6):** پس از T031، صفحه‌ی آگهی.
- **Polish (Phase 7):** پس از همه.

### User Story Dependencies

- **US2:** پایه‌ی عکس‌ها برای US1 و US3.
- **US1:** به US2 تکیه دارد.
- **US3:** به US2 تکیه دارد.
- **US4:** به صفحه‌ی آگهی US3 تکیه دارد.

### Within Each User Story

- تست‌ها اول، و شکست‌خورده.
- `lib`، سپس کامپوننت، سپس صفحه.

### Parallel Opportunities

- **Phase 1:** T001 با T002.
- **Phase 2، تست‌ها:** T003 تا T007.
- **Phase 2، پیاده‌سازی:** T009، T010 و T011.
- **US1، تست‌ها:** T018، T019 و T020.
- **US1، کامپوننت‌ها:** T021 و T022.
- **US3:** T027، T028 و T029.
- **مستندها:** T038، T039 و T040.

---

## Parallel Example: Phase 2

```bash
Task: "T003 image check tests in frontend/src/lib/imageCheck.test.ts"
Task: "T004 listing draft tests in frontend/src/lib/listingDraft.test.ts"
Task: "T005 review fields tests in frontend/src/lib/reviewFields.test.ts"
Task: "T006 listing status tests in frontend/src/lib/listingStatus.test.ts"
```

---

## Implementation Strategy

### MVP First (Phase 2 + US1 + US2)

1. قاعده‌ها (Phase 2).
2. عکس‌ها (US2)، سپس ساخت آگهی (US1).
3. **بایستید و بسنجید:** یک آگهی از سایت ساخته و در صف مدیر دیده شود.

### Incremental Delivery

- US3 (آگهی‌های من و ویرایش)، سپس US4 (رزروها و نظرها)، سپس Polish.
- یک pull request برای کل کار، با تصویرهای صفحه‌های میزبان.

## نتیجه (2026-11-10)

- Vitest: ۳۶۵ تست سبز؛ ESLint، Prettier و `tsc` تمیز.
- e2e: ۹۷ تست، از جمله `host.spec.ts` (۶ تست) و سه صفحه‌ی میزبان در `theme.spec.ts`. دو اجرای کامل پاس؛ در یک اجرا `bookings.spec.ts` (hold ۱۵ دقیقه‌ای، بی ربط به ۰۰۸) یک بار شکست خورد و جدا سه بار پاس شد (`docs/future-work.md`).
- `backend/openapi.json` بی‌تغییر (SC-006).
- SC-005: عکس ۵ مگابایتی از انتخاب تا دیده شدن ۰٫۵ ثانیه، روی stack محلی.
- SC-001 (زمان یک انسان) به مالک پروژه سپرده شد (`docs/future-work.md`).
