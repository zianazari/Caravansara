---

description: "Task list for feature implementation"
---

# Tasks: تم کاروانسرایی برای سایت

**Input**: Design documents from `/specs/007-caravansara-theme/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md, mockup/

**Tests**: لازم‌اند. constitution اصل IV برای هر قاعده تست خودکار می‌خواهد.
- **Vitest:** قاعده‌های رنگ، کنتراست، نشان، دسته‌ها و کامپوننت‌های تازه.
- **Playwright در Chrome واقعی روی stack:** عرض‌ها، axe و تصویرها.
- **ترتیب:** تست‌های هر بخش اول نوشته می‌شوند و باید پیش از پیاده‌سازی شکست بخورند.
- **تست‌های ۰۰۵:** همه بی تغییر رفتار پاس می‌مانند (SC-006). اگر تستی فقط به‌خاطر نام کلاس یا ساختار DOM شکست خورد، تست اصلاح می‌شود، نه رفتار.

**Organization**:
- کارها بر اساس user story دسته‌بندی شده‌اند.
- تم پایه (Phase 2) همه‌ی storyها را متوقف می‌کند.
- کارهایی که یک فایل را تغییر می‌دهند، پشت سر هم آمده‌اند و `[P]` ندارند.

**قاعده‌ی مستندسازی (مالک پروژه، 2026-11-07)**: هر ساختار تازه (token، طاق، نشان، دسته، ردیف شهر، نوار پایین) دلیل و اثرش را در دو جا می‌گیرد:
- یک توضیح کوتاه در کد، کنار تعریفش.
- `docs/backend-design.md`، بخش «فرانت‌اند وب» (T040).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: می‌تواند موازی اجرا شود (فایل جدا، بی وابستگی به کار ناتمام)
- **[Story]**: US1 تا US4

## Path Conventions

- سایت: `frontend/src/`
- پیام‌ها: `frontend/scripts/messages_source.py` → `frontend/messages/{fa,en}.json`
- e2e: `e2e/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 افزودن `"axe-core": "4.14.0"` (پین دقیق، همان نسخه‌ی frontend) به devDependencies `e2e/package.json`، سپس `npm install` در `e2e/` و `npx playwright install chromium`. `e2e/README.md` بگوید که `theme.spec.ts` مرورگر Chrome لازم دارد.
- [X] T002 [P] افزودن همه‌ی کلیدهای متن تازه به `frontend/scripts/messages_source.py`، با فارسی و انگلیسی، و ساختن دوباره‌ی `frontend/messages/fa.json` و `en.json`. کلیدها:
  - `home.heroTitle` («جایی برای ماندن، در هر شهر سر راه»)
  - `home.heroSubtitle`
  - `home.whereTo` («کجا می‌روید؟»)
  - `home.anyWhereAnyWhen` («هر شهر · هر زمان · مهمان‌ها»)
  - `home.popularIn` («محبوب در {city}»)
  - `home.showAll` («نمایش همه»)
  - `badge.guestFavourite` («انتخاب مهمان‌ها»)
  - `badge.new` («تازه»)
  - `category.all`، `category.pets`، `category.hot_tub`، `category.sauna`، `category.lake_access`، `category.balcony`، `category.free_parking`، `category.workspace`، `category.kitchen`
  - `nav.search`، `nav.trips`، `nav.profile`، `nav.login`
  - `listing.reserve` (اگر نیست)
  - **شرط:** `src/messages.test.ts` پاس شود: کلیدهای یکسان و بی انگلیسی در فارسی.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: تم پایه: tokenها، طاق‌ها و قاعده‌های رنگ. با این فاز، همه‌ی صفحه‌ها رنگ تازه را می‌گیرند.

### Tests (اول، شکست‌خورده) ⚠️

- [X] T003 [P] `frontend/src/theme.test.ts`:
  - مقدار tokenها را از `src/app/globals.css` می‌خواند، و برای هر جفت متن و زمینه‌ی جدول `data-model.md` نسبت کنتراست WCAG را حساب می‌کند.
  - **حداقل‌ها:** متن ≥ ۴٫۵؛ آیکون و `--ring` ≥ ۳ (FR-002، SC-002).
  - `--primary` باید `#9a5418` باشد، نه `#b5651d` (research R2).
  - جفت‌های hero (`--on-dark` و `--gold` روی `--night`) و فوتر (`--on-dark-muted` و `--gold` روی `--foreground`) هم سنجیده می‌شوند.
- [X] T004 [P] `frontend/src/no-raw-colors.test.ts`: همه‌ی فایل‌های `src/**/*.{ts,tsx,css,svg}` را می‌خواند.
  - **یافتن:** hex، `rgb(`، `rgba(`، `hsl(`، `oklch(`، و کلاس‌های رنگ پیش‌فرض Tailwind (`(bg|text|border|fill|stroke|ring|from|to|via)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?`).
  - **مستثنا:** `src/app/globals.css`، `src/lib/avatar.ts` (رنگ آواتار ۰۰۵)، `src/app/icon.svg` (favicon، که رنگ token را نمی‌تواند بخواند) و فایل‌های `*.test.*`.
  - **شرط:** فهرست یافته‌ها خالی است (FR-001، SC-003). امروز `text-white` و `bg-black` در `dialog.tsx`، `Gallery.tsx` و `UserAvatar.tsx` هستند، پس تست شکست می‌خورد.

### Implementation

- [X] T005 بازنویسی `:root` و `@theme inline` در `frontend/src/app/globals.css`، با مقدارهای جدول `data-model.md`:
  - **مقدار تازه:** `--background`، `--surface`، `--card`، `--foreground`، `--muted`، `--muted-foreground`، `--border`، `--primary`، `--primary-foreground`، `--destructive` (= آجری)، `--ring`.
  - **token تازه:** `--copper`، `--amber`، `--sand-strong`، `--night`، `--gold`.
  - `--radius: 1rem`.
  - `--on-dark` و `--on-dark-muted` برای متن روی زمینه‌ی تیره (hero و فوتر).
  - `color-scheme: light` روی `:root` (Edge Case حالت تیره).
  - توضیح بالای فایل: دلیل مسی تیره برای دکمه (R2)، و اینکه فقط این فایل رنگ دارد (FR-001).
- [X] T006 در همان `globals.css`: کلاس‌های `.arch` و `.arch-soft` با `mask-image: url("data:image/svg+xml,…")`، و `mask-size: 100% 100%` و `mask-repeat: no-repeat` (و `-webkit-` برای Safari)، با مسیرهای `data-model.md`. همچنین قاعده‌ی `@media (prefers-reduced-motion: reduce)` که `animation` و `transition` تزئینی را خاموش می‌کند (FR-009)، و `@media print` که زمینه‌های تیره را برمی‌دارد (Edge Case چاپ). توضیح کد: چرا `mask-image` و نه `clip-path: url()` (R3).
- [X] T007 جایگزینی رنگ‌های خام با token:
  - `frontend/src/components/ui/dialog.tsx`: `bg-black/40` به `bg-foreground/40`.
  - `frontend/src/components/listing/Gallery.tsx`: `bg-black/60 text-white` به `bg-foreground/70 text-background`.
  - `frontend/src/components/account/UserAvatar.tsx`: `text-white` به `text-primary-foreground`. کنتراست روی هشت رنگ آواتار، که تست ۰۰۵ دارد، همان می‌ماند.
  - **شرط:** T004 پاس شود.
- [X] T008 [P] `frontend/src/components/brand/ArchFrame.tsx`: قاب طاقی (`variant: "tall" | "soft"`) برای عکس یا جایگزین گرم. جایگزین یک SVG درون‌خطی است: طاق شنی روی کرم با token (R10). عکس با `next/image` و `unoptimized`. تست `ArchFrame.test.tsx`: بی `src` جایگزین می‌آید، و `alt` درست است.
- [X] T009 [P] `frontend/src/components/brand/Logo.tsx` (طاق کوچک با شیب `--amber` به `--copper`، و «کاروانسرا» با `--primary`)، و `frontend/src/app/icon.svg` با همان طاق روی کرم (R9).
- [X] T010 اجرای `npm run lint && npm run typecheck && npm test` در `frontend/`: T003 و T004 و همه‌ی تست‌های ۰۰۵ پاس.

**Checkpoint**: همه‌ی صفحه‌ها رنگ تم را دارند، و اجزای پایه‌ی برند آماده‌اند.

---

## Phase 3: User Story 1 - صفحه‌ی اول کاروانسرایی و آشنا (Priority: P1) 🎯 MVP

**Goal**: سرصفحه، hero، قرص جستجو، ردیف‌های شهرها و نوار طاقی صفحه‌ی اول، مثل `mockup/`.

**Independent Test**: `/fa` روی ۱۲۸۰ و ۳۹۰ پیکسل با `mockup/home-desktop.png` و `home-mobile.png` همخوان است. جستجو با شهر، تاریخ و مهمان همان نتیجه‌ی ۰۰۵ را می‌دهد.

### Tests for User Story 1 ⚠️

- [X] T011 [P] [US1] `frontend/src/components/home/CityRow.test.tsx` (با mock API موجود `src/test/render.tsx`):
  - ردیف کارت‌ها را با عنوان «محبوب در تهران» و پیوند «نمایش همه» به `/fa/search?city_id=…` می‌سازد.
  - درخواست با `sort=rating&limit=8` است.
  - شهر یافت‌نشده، خطای API یا ۰ آگهی: هیچ ردیفی نمی‌آید (US1/AC5).
  - تا ردیف دیده نشود، درخواستی نمی‌فرستد (`IntersectionObserver` در تست mock می‌شود).
- [X] T012 [P] [US1] `frontend/src/components/search/search-form.test.tsx`: تست‌های ۰۰۵ پاس بمانند، و دو تست تازه:
  - روی دسکتاپ، قرص چهاربخشی (کجا، ورود، خروج، مهمان‌ها) و دکمه‌ی گرد با نام دسترس‌پذیر «جستجو».
  - روی گوشی، دکمه‌ی یک‌خطی «کجا می‌روید؟» که با لمس همان چهار بخش را باز می‌کند (FR-005).

### Implementation for User Story 1

- [X] T013 [US1] `frontend/src/components/layout/Header.tsx`:
  - `Logo`، و پیوند زبان دیگر.
  - منوی حساب گرد: آیکون منو با `UserAvatar`، یا «ورود»، با `rounded-full border bg-card`.
  - روی گوشی، پیوند زبان در منو.
  - بی پیوند «میزبان شوید» (FR-004).
- [X] T014 [US1] `frontend/src/components/search/SearchForm.tsx`:
  - قرص گرد سفید با سایه‌ی گرم، با چهار بخش و جداکننده‌ی شنی.
  - دکمه‌ی گرد با شیب `--copper` به `--primary` و آیکون سفید.
  - زیر `md`، دکمه‌ی یک‌خطی «کجا می‌روید؟» که پنل کامل را در یک `Dialog` باز می‌کند.
  - رفتار، نام فیلدها و پیشنهاد شهر و تقویم همان ۰۰۵ (FR-005، FR-011).
- [X] T015 [P] [US1] `frontend/src/components/brand/Hero.tsx`:
  - SVG درون‌خطی، با شیب `--night` به `--brick`، درگاه `arch` با درخشش `--amber`، سه چراغ و ردیف طاق‌ها.
  - متن `home.heroTitle` و `home.heroSubtitle` با `--on-dark` و `--gold`، فقط روی بخش آبی شب hero، نه روی بخش آجری شیب (data-model، قاعده‌ی hero).
  - چراغ‌ها فقط با `prefers-reduced-motion: no-preference` می‌درخشند.
  - روی گوشی، درگاه کوچک و پایین‌چپ (در RTL) و متن تمام‌عرض (R8، Edge Case ۳۲۰).
  - توضیح کد: چرا SVG و نه عکس.
- [X] T016 [P] [US1] `frontend/src/components/brand/ArcadeBand.tsx`: ردیف طاق‌های کوچک `--muted`. فقط دسکتاپ، و `aria-hidden`.
- [X] T017 [US1] `frontend/src/components/home/CityRow.tsx`:
  - **درخواست:** `useQuery` برای `/cities?q=` و برداشتن شهری که نامش دقیقاً همان است (اگر نبود، بی ردیف)، سپس `/search/listings?city_id&sort=rating&limit=8&…category`، با `enabled` فقط پس از دیده شدن (`IntersectionObserver` با `rootMargin: 200px`) و `staleTime` پنج دقیقه (R4).
  - **چیدمان:** کارت‌ها با `ResultCard`. روی گوشی ردیف افقی با `snap`، و روی دسکتاپ شبکه‌ی ۴ ستونه.
  - **خطا:** بی ردیف، و یک `console.error` ثابت.
  - توضیح کد: چرا بار هنگام دیدن.
- [X] T018 [US1] بازنویسی `frontend/src/app/[locale]/page.tsx`:
  - `Hero`، سپس `SearchForm` که روی لبه‌ی پایین hero نشسته (`-mt`)، سپس `CategoryBar` (در US3؛ تا آن موقع جایش خالی)، سپس `CityRow` برای هر یک از شش `SUGGESTED`، و در پایان `ArcadeBand`.
  - پیوندهای شهرهای پیشنهادی ۰۰۵ به عنوان ردیف‌ها ادغام می‌شوند.
- [X] T019 [US1] `frontend/src/components/layout/Footer.tsx`: زمینه‌ی `--foreground` (قهوه‌ای تیره)، متن `--on-dark-muted` (۹٫۹۶) و نام سایت `--gold` (data-model، قاعده‌ی فوتر).

**Checkpoint**: صفحه‌ی اول با نمونه همخوان است. جستجو مثل ۰۰۵ کار می‌کند.

---

## Phase 4: User Story 2 - کارت آگهی و نتیجه‌ی جستجو (Priority: P1)

**Goal**: کارت با قاب `arch-soft`، نشان، امتیاز و قیمت، و جستجو و نقشه هم‌رنگ.

**Independent Test**: لندن با تاریخ را جستجو کنید. کارت‌ها قاب طاقی، نشان و قیمت دارند. نقشه نشانگر مسی دارد. روی گوشی تک‌ستونه است.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] `frontend/src/lib/badge.test.ts`:
  - `guest_favourite` برای امتیاز ۴٫۸ با ۳ نظر.
  - هیچ برای ۴٫۷۹ با ۱۰ نظر، یا ۵٫۰ با ۲ نظر.
  - `new` برای ۰ نظر.
  - هیچ برای بقیه (data-model، Badge).
- [X] T021 [P] [US2] `frontend/src/components/search/ResultCard.test.tsx`: تست‌های ۰۰۵ پاس بمانند، و این‌ها اضافه شوند:
  - **نشان:** «انتخاب مهمان‌ها» یا «تازه» می‌آید. با «تازه» امتیاز نمی‌آید.
  - **عکس:** جایگزین گرم برای `cover_url: null`.
  - **قلب:** هیچ دکمه‌ی قلبی نیست (FR-015).
  - **پیوند:** کل کارت یک پیوند با نام عنوان آگهی است.

### Implementation for User Story 2

- [X] T022 [P] [US2] `frontend/src/lib/badge.ts`: `badgeOf({avg_rating, review_count})`. توضیح کد: آستانه‌ها پیش‌فرض spec است، و چیزی ذخیره نمی‌شود.
- [X] T023 [US2] `frontend/src/components/search/ResultCard.tsx`، با ترتیب `contracts/ui.md`:
  - `ArchFrame variant="soft"` با نسبت ۱ به ۱٫۰۴ (`md`) یا ۱ به ۰٫۹۵ (گوشی).
  - نشان پایین‌راست در RTL و پایین‌چپ در LTR، روی کرم.
  - شهر و کشور پررنگ، با امتیاز ★ در سمت دیگر.
  - نوع اقامتگاه، تاریخ‌ها، و قیمت شبانه پررنگ به‌علاوه‌ی جمع کل.
  - عنوان بلند با `line-clamp-1` (Edge Case).
- [X] T024 [US2] `frontend/src/app/[locale]/search/page.tsx` و `frontend/src/components/search/SearchControls.tsx`:
  - شبکه‌ی ۱، ۲، ۳ یا ۴ ستونه (`sm`، `lg`، `xl`).
  - پنل فیلتر روی `--surface`.
  - قرص جستجوی فشرده بالای نتیجه.
  - رفتار، URL و صفحه‌بندی ۰۰۵ بی‌تغییر.
- [X] T025 [US2] `frontend/src/components/search/ResultsMap.tsx`: نشانگر قیمت قرصی با `--card` و مرز `--copper`. نشانگر انتخاب‌شده `--primary` با متن `--primary-foreground`. popup با `ArchFrame`. کاشی‌ها OpenStreetMap می‌مانند (R12).
  - **اجرا:** نشانگرهای نقشه‌ی ۰۰۵ خودشان پیوندند و popup ندارند، پس قاب طاقی popup جایی برای نشستن ندارد. نشانگرها مرز مسی، و در hover و focus زمینه‌ی `--primary` گرفتند.
- [X] T026 [P] [US2] `frontend/src/components/search/FiltersPanel.tsx`: چک‌باکس‌ها و دکمه‌ها با token. رفتار ۰۰۵ بی‌تغییر، و `FiltersPanel.test.tsx` پاس.

**Checkpoint**: جستجو و کارت‌ها با تم.

---

## Phase 5: User Story 3 - دسته‌ها (Priority: P2)

**Goal**: ردیف دسته‌ها از امکانات و حیوان خانگی (FR-014، R5، R6).

**Independent Test**: «سونا» را در صفحه‌ی اول بزنید. ردیف‌ها فقط آگهی‌های با سونا را نشان می‌دهند، و «نمایش همه» دسته را به جستجو می‌برد. در جستجو، دسته همان فیلتر پنل را تنظیم می‌کند.

### Tests for User Story 3 ⚠️

- [X] T027 [P] [US3] `frontend/src/lib/categories.test.ts`:
  - `categoriesFor(amenities)`: «همه» و «حیوان خانگی» همیشه می‌آیند. دسته‌ی امکانی که در فهرست نیست، نمی‌آید.
  - `filterOf(key, amenities)`: `{amenity_ids: [id]}` یا `{pets: 1}`.
  - کلید ناشناخته در URL، «همه» حساب می‌شود.
- [X] T028 [P] [US3] `frontend/src/components/home/CategoryBar.test.tsx`:
  - دسته‌ی فعال `aria-current="true"` و خط زیر دارد.
  - با زدن دسته، `?category=` در URL عوض می‌شود.
  - ردیف با صفحه‌کلید (پیکان‌ها) پیمایش‌پذیر است.

### Implementation for User Story 3

- [X] T029 [P] [US3] `frontend/src/lib/categories.ts`: فهرست ثابت `data-model.md` (کلید، نام انگلیسی امکان، آیکون `lucide-react`). توضیح کد: چرا نوع اقامتگاه نیست (R5).
- [X] T030 [US3] `frontend/src/components/home/CategoryBar.tsx`:
  - آیکون در قاب `arch` (غیرفعال `--sand-strong`، فعال `--copper`) و نام زیر آن.
  - خط زیر `--primary` برای فعال.
  - روی گوشی افقی اسکرول با `snap`.
  - فهرست از `GET /amenities` (همان query امروز `FiltersPanel`).
- [X] T031 [US3] اتصال:
  - **صفحه‌ی اول** (`frontend/src/app/[locale]/page.tsx`): `CategoryBar` جای خالی T018 را می‌گیرد، و `?category=` به هر `CityRow` می‌رسد (R6).
  - **جستجو** (`frontend/src/app/[locale]/search/page.tsx`): دسته `amenity_ids` و `pets` پنل فیلتر را تنظیم می‌کند. اگر کاربر فیلتر پنل را دستی عوض کند، دسته به «همه» برمی‌گردد، مگر دقیقاً همان یک فیلتر بماند (data-model، Category).

**Checkpoint**: دسته‌ها در صفحه‌ی اول و جستجو کار می‌کنند.

---

## Phase 6: User Story 4 - همه‌ی صفحه‌های مهمان یک هویت دارند (Priority: P1)

**Goal**: آگهی، ورود و ثبت‌نام، رزرو، سفرها، نظر، حساب، خطا، و نوار پایین گوشی.

**Independent Test**: مسیر کامل مهمان روی گوشی و دسکتاپ، به فارسی و انگلیسی. هر صفحه تم را دارد، و رفتار همان ۰۰۵ است.

### Tests for User Story 4 ⚠️

- [X] T032 [P] [US4] `frontend/src/components/layout/BottomNav.test.tsx`:
  - سه بخش جستجو، سفرها و پروفایل (یا ورود بی نشست).
  - بخش فعال `aria-current="page"`.
  - در مسیرهای `/listings/` و `/book/` نمی‌آید (R7).
- [X] T033 [P] [US4] `frontend/src/components/listing/Gallery.test.tsx`: تست‌های ۰۰۵ پاس بمانند، و این‌ها اضافه شوند:
  - نقطه‌های گالری با نام دسترس‌پذیر «عکس ۲ از ۵».
  - پیکان‌های صفحه‌کلید عکس را جابه‌جا می‌کنند.
  - کشیدن (`pointerdown`، `pointermove`، `pointerup` با فاصله‌ی بیش از ۴۰ پیکسل) عکس را جابه‌جا می‌کند، و کشیدن کوتاه‌تر نه. در RTL جهت کشیدن برعکس است.
  - عکس اصلی در `arch-soft` است.

### Implementation for User Story 4

- [X] T034 [US4] `frontend/src/components/layout/BottomNav.tsx` و `frontend/src/app/[locale]/layout.tsx`:
  - نوار پایین زیر `md`: آیکون در `arch` (فعال `--copper`)، و نام زیر آن.
  - `padding-bottom: env(safe-area-inset-bottom)`.
  - `main` در گوشی فاصله‌ی پایین به اندازه‌ی نوار می‌گیرد.
  - توضیح کد: چرا سه بخش (Q3) و چرا نه در آگهی و رزرو (R7).
- [X] T035 [US4] `frontend/src/components/listing/Gallery.tsx`:
  - عکس اصلی در `ArchFrame variant="soft"`.
  - نقطه‌های گالری، و کشیدن روی گوشی (`pointer` events، بی کتابخانه).
  - دکمه‌های قبلی و بعدی، و پیکان‌های صفحه‌کلید روی دسکتاپ.
  - شمار «۲ / ۵» با رقم محلی (FR-007).
- [X] T036 [US4] `frontend/src/components/listing/BookingBox.tsx` و `frontend/src/components/listing/MobileBookingBar.tsx` (تازه):
  - **دسکتاپ:** کادر چسبان روی `--card` با سایه‌ی گرم، و دکمه‌ی `--primary`.
  - **گوشی:** نوار ثابت پایین با قیمت شبانه (و جمع کل)، و دکمه‌ی «رزرو» که همان کادر را در `Dialog` باز می‌کند یا به `/book` می‌رود، مثل رفتار ۰۰۵.
  - اتصال در `frontend/src/app/[locale]/listings/[id]/page.tsx`، و `listing.test.tsx` پاس.
- [X] T037 [US4] صفحه‌های حساب، طبق `contracts/ui.md`:
  - `frontend/src/components/auth/AuthForm.tsx` (کارت سفید با طاق کوچک بالای آن).
  - `frontend/src/app/[locale]/login/page.tsx` و `register/page.tsx`.
  - `frontend/src/components/account/AccountView.tsx`.
  - تست‌های `AuthForm` و `AccountView` پاس.
- [X] T038 [US4] صفحه‌های رزرو و سفر:
  - `frontend/src/app/[locale]/book/[listingId]/page.tsx` و `components/booking/ConfirmBooking.tsx`: خلاصه با `ArchFrame`.
  - `HoldCountdown.tsx` روی `--muted`.
  - `PriceBreakdown.tsx`.
  - `TripList.tsx`: زبانه‌ها با خط زیر `--primary`، و کارت سفر با `ArchFrame`.
  - `TripDetail.tsx`، `ReviewForm.tsx`، `CancelDialog.tsx`.
  - `frontend/src/app/[locale]/trips/**`.
  - تست‌های `booking-flow`، `trips`، `HoldCountdown` و `PriceBreakdown` پاس.
- [X] T039 [P] [US4] `frontend/src/app/[locale]/error.tsx` و `not-found.tsx`: طاق خالی `--muted` با پیام و دکمه‌ی بازگشت `--primary`.

**Checkpoint**: همه‌ی ۱۲ صفحه‌ی مهمان تم را دارند.

---

## Phase 7: Polish & Cross-Cutting Concerns

### تست مرورگر، تصویرها و سرعت

- [X] T041 `e2e/tests/theme.spec.ts`، در Chrome واقعی روی stack (`WEB` از `helpers.ts`):
  - **کاربر:** یک کاربر با `register` ساخته می‌شود، با یک آگهی تأییدشده با `createListing`، `addPhoto` و `approve`، و یک رزرو با `reserve`، تا صفحه‌های سفر و نظر داده داشته باشند. برای صفحه‌ی نظر، تاریخ آن رزرو با helper `sql` به گذشته برده و `completed` می‌شود، مثل تست‌های e2e نظر، تا خود فرم نظر سنجیده و تصویر شود.
  - **صفحه‌ها:** هر ۱۲ صفحه (`contracts/ui.md`) در عرض‌های ۳۲۰، ۳۶۰، ۳۹۰، ۷۶۸ و ۱۲۸۰، به فارسی و انگلیسی: `document.documentElement.scrollWidth <= clientWidth` (SC-004).
  - **axe:** از `node_modules/axe-core/axe.min.js` با `addScriptTag` بار می‌شود، و `axe.run()` با همه‌ی قاعده‌ها هیچ violation ندارد (SC-002).
  - **نوار پایین:** در `/listings/:id` روی ۳۹۰ پیکسل نیست، و نوار رزرو هست.
  - **حرکت:** با `emulateMedia({ reducedMotion: "reduce" })` هیچ انیمیشنی در hero اجرا نمی‌شود.
  - **حالت تیره‌ی سیستم:** با `emulateMedia({ colorScheme: "dark" })`، صفحه‌ی اول، جستجو و رزرو بی violation در axe، و فیلدها روشن.
  - **چاپ:** با `emulateMedia({ media: "print" })`، صفحه‌ی جزئیات سفر زمینه‌ی تیره ندارد، و متن آن خواناست.
  - **hero:** نتیجه‌های `incomplete` کنتراست axe در hero هم بررسی می‌شوند، و نقطه‌ی زیر متن با رنگ `--night` سنجیده می‌شود.
  - **کشیدن گالری:** با `page.touchscreen` روی ۳۹۰ پیکسل، عکس دوم آگهی دیده می‌شود.
  - **تصویرها:** با `--grep screenshots`، تصویر کامل هر صفحه در ۱۲۸۰ و ۳۹۰، به `fa` و `en`، در `specs/007-caravansara-theme/screens/<page>-<width>-<locale>.png` (SC-001).
- [X] T042 ساختن دوباره‌ی stack (`docker compose -f docker-compose.yml -f e2e/compose.e2e.yml up -d --build`، بی `-v`) و اجرای `npx playwright test` در `e2e/`. همه‌ی e2e، چه ۰۰۵ و چه `theme.spec.ts`، پاس.
- [X] T043 اندازه‌گیری سرعت (SC-005) به روش `specs/005-frontend-guest/measurements.md` روی `/fa`، جستجوی لندن و یک آگهی، با نتیجه در `specs/007-caravansara-theme/measurements.md`. هدف: LCP کمتر از ۲٫۵ ثانیه و CLS کمتر از ۰٫۱.

### مستندها

- [X] T040 `docs/backend-design.md`، بخش «فرانت‌اند وب»:
  - زیربخش «تم کاروانسرایی (کار ۰۰۷)»، با جدول ساختار، چرا و اثر: tokenها و دلیل مسی تیره، `arch` و `arch-soft`، نشان، دسته‌ها و دلیل نبود نوع اقامتگاه، ردیف شهر و بار هنگام دیدن، نوار پایین و نوار رزرو، hero با SVG، و تست‌های `theme` و `no-raw-colors`.
  - سپس ساختن دوباره‌ی PDF آن.
- [X] T044 [P] `docs/future-work.md`:
  - بخش «کار ۰۰۷» به فهرست کارهای انجام‌شده در بند اول برود.
  - چهار کار آینده‌ی آن بمانند: علاقه‌مندی‌ها، دسته‌های تازه، فیلتر نوع اقامتگاه، و آگهی‌های «محبوب».
- [X] T045 [P] `frontend/README.md` (تم، tokenها، `arch`، تست‌های تازه)، و `README.md`: یک تصویر از `screens/home-1280-fa.png` در `docs/images/readme/`، و یک جمله درباره‌ی تم. همچنین `CONTEXT.md`.

### بررسی نهایی

- [X] T046 اجرای quickstart (`specs/007-caravansara-theme/quickstart.md`، بخش ۱ تا ۴)، و ثبت نتیجه در همین task. تصویرهای `screens/` برای تأیید SC-001 به مالک پروژه داده می‌شوند.
  - **SC-007:** یک کاربر تازه، ترجیحاً کسی جز سازنده، روی گوشی و بی راهنما، از صفحه‌ی اول تا دیدن نتیجه‌ی جستجو برای یک شهر و تاریخ. زمان در `measurements.md` ثبت می‌شود، و هدف کمتر از ۳۰ ثانیه است. اسکریپت Playwright همان مسیر زمان انسان را نمی‌سنجد، پس این گام دستی است (اصل IV).
  - **اجرا (2026-11-09):**
    - **بخش ۱:** lint، typecheck، Prettier و ۲۵۸ تست Vitest پاس؛ پوشش `src/lib` و `src/api` بالای ۹۰٪. همه‌ی ۸۵ تست e2e روی stack تازه‌ساخته پاس؛ ۲۸ تای آن از `theme.spec.ts` در Chrome واقعی.
    - **بخش ۲:** ۴۴ تصویر در `screens/` (۱۱ صفحه × ۲ عرض × ۲ زبان).
    - **بخش ۳:** سناریوهای دستی با تست مرورگر و بازدید در Chrome پوشیده شدند: دسته‌ی «جکوزی» در صفحه‌ی اول فقط ردیف استکهلم را نگه داشت؛ نوار رزرو جای نوار پایین را در صفحه‌ی آگهی گرفت؛ «کاهش حرکت» و حالت تیره‌ی سیستم.
    - **بخش ۴:** `measurements.md`.
    - **یافته‌ها:** تست مرورگر پنج مشکل یافت که jsdom نمی‌دید، و همه رفع شدند: پهن شدن صفحه در ۳۲۰ پیکسل با ردیف‌های افقی، ایمیل بلند حساب، متن hero روی درگاه در ۷۶۸ پیکسل، نام و اندازه‌ی پین‌های نقشه، و صفحه‌ی ۴۰۴ بی `lang`.
    - **صفحه‌ی خطا (`error.tsx`):** در مرورگر سنجیده نشد، چون بی خطای ساختگی در سرور نمی‌شود آن را باز کرد. همان ظاهر صفحه‌ی «یافت نشد» را دارد.
    - **مانده:** SC-007 زمان انسان است و با مالک پروژه می‌ماند، مثل SC-001 کار ۰۰۵. SC-001 هم تأیید تصویرها با مالک پروژه است.
- [X] T047 اجرای `/speckit-converge` تا Converged، پیش از pull request (constitution).
  - **اجرا (2026-11-10):** دور اول ۵ یافته داشت (Phase 8). پس از ساخت آن‌ها، دور دوم Converged گزارش داد، با یک استثنای پذیرفته‌شده‌ی مالک پروژه: T050 (SC-007، زمان انسان)، که پیگیری پس از pull request است.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1):** بی وابستگی. T001 فقط برای Phase 7 لازم است.
- **Foundational (Phase 2):** همه‌ی storyها را متوقف می‌کند، چون tokenها، طاق و `ArchFrame` پیش‌نیاز همه‌اند.
- **US1 (Phase 3):** پس از Phase 2. T018 جای `CategoryBar` را برای US3 خالی می‌گذارد.
- **US2 (Phase 4):** پس از Phase 2. `ResultCard` (T023) در `CityRow` (T017) به کار می‌رود، پس اگر US1 پیش از US2 ساخته شود، `CityRow` تا T023 همان کارت ۰۰۵ را نشان می‌دهد.
- **US3 (Phase 5):** پس از US1 (صفحه‌ی اول) و US2 (جستجو).
- **US4 (Phase 6):** پس از Phase 2، و مستقل از US1 تا US3.
- **Polish (Phase 7):** پس از همه. T041 به همه‌ی صفحه‌ها نیاز دارد. مستند طراحی (T040) پس از تست‌ها و سرعت (T041 تا T043) نوشته می‌شود، تا نتیجه‌ی آن‌ها را داشته باشد.

### User Story Dependencies

- **US1 و US2:** هر دو P1. US2 کارت را می‌دهد که US1 در ردیف‌ها به کار می‌برد.
- **US3:** به US1 و US2 تکیه دارد.
- **US4:** مستقل.

### Within Each User Story

- تست‌ها اول، و شکست‌خورده.
- `lib` (منطق)، سپس کامپوننت، سپس صفحه.

### Parallel Opportunities

- **Phase 2:** T003 با T004؛ T008 با T009.
- **US1:** T011 با T012؛ T015 با T016.
- **US2:** T020 با T021؛ T022 با T026.
- **US3:** T027 با T028؛ T029.
- **US4:** T032 با T033؛ T039.
- **مستندها:** T040، T044 و T045.
- **میان storyها:** پس از Phase 2، US4 با US1 و US2 هم‌زمان پیش می‌رود.

---

## Parallel Example: Phase 2

```bash
Task: "T003 theme contrast test in frontend/src/theme.test.ts"
Task: "T004 raw colour scan in frontend/src/no-raw-colors.test.ts"
```

---

## Implementation Strategy

### MVP First (Phase 2 + US1 + US2)

1. tokenها و طاق (Phase 2): کل سایت همان‌جا رنگ تم را می‌گیرد.
2. صفحه‌ی اول (US1) و کارت (US2).
3. **بایستید و بسنجید:** تصویر صفحه‌ی اول و جستجو را با `mockup/` مقایسه کنید.

### Incremental Delivery

- US3 (دسته‌ها)، سپس US4 (بقیه‌ی صفحه‌ها)، سپس Polish.
- یک pull request برای کل کار، با تصویرهای `screens/` در توضیح آن، برای تأیید مالک پروژه (SC-001).

## Phase 8: Convergence

- [X] T048 [US1] افزودن یک تست Vitest برای چیدمان صفحه‌ی اول در `frontend/src/app/[locale]/home.test.tsx`: عنوان hero («جایی برای ماندن…»)، قرص جستجو (`role="search"`)، ردیف دسته‌ها (`nav` «دسته‌ها»)، یک ردیف برای هر شهر پیشنهادی، و نوار طاقی؛ به فارسی و انگلیسی، طبق US1/AC1 (missing)
- [X] T049 ثبت تغییر عمدی دسترس‌پذیری پین‌های نقشه، که از ترتیب Tab و صفحه‌خوان بیرون رفتند چون پیوند هر پین همان کارت نتیجه است (WCAG 2.5.8)، به عنوان استثنای FR-011 که مالک پروژه باید ببیند، در `specs/007-caravansara-theme/research.md` (R13 تازه) و در توضیح pull request، طبق FR-011 (contradicts)
  - **اجرا:** در research.md به عنوان R13 ثبت شد، و مالک پروژه آن را پذیرفت (2026-11-10). در توضیح pull request هم می‌آید.
- [ ] T050 اندازه‌گیری SC-007 با یک انسان (کاربر تازه، روی گوشی، بی راهنما، از صفحه‌ی اول تا نتیجه‌ی جستجو برای یک شهر و تاریخ؛ هدف کمتر از ۳۰ ثانیه)، و ثبت آن در `specs/007-caravansara-theme/measurements.md` و `docs/backend-design.md`، طبق SC-007 و Constitution IV (missing)
  - **وضعیت:** پیگیری پس از pull request، با تصمیم مالک پروژه (2026-11-10)، مثل T083 کار ۰۰۵. یک انسان لازم دارد، ترجیحاً کسی جز سازنده. در `docs/future-work.md` ثبت شد.
- [X] T051 [P] برداشتن کلیدهای پیامی که با تم بی‌استفاده ماندند (`home.heading`، `home.lead`، `home.popular`، `search.suggested`، `listing.reserve`) از `frontend/scripts/messages_source.py`، و ساختن دوباره‌ی `frontend/messages/{fa,en}.json`، طبق FR-012 (unrequested)
- [X] T052 [P] [US2] افزودن تستی به `frontend/src/components/search/ResultCard.test.tsx` که عنوان بلند در یک خط بماند (`line-clamp-1`) و چیدمان کارت نشکند، طبق Edge Case «متن بلند» در spec (missing)
