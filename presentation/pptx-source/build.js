// Persian ERD demo deck as a real PowerPoint file with right-to-left paragraphs.
// Every Persian text box uses rtlMode (a:pPr rtl="1") + lang fa-IR, so PowerPoint
// lays it out RTL natively. Identifiers and code stay LTR in their own boxes.
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const tb = require("react-icons/tb");
const { applyTheme } = require("/root/.claude/skills/synced/4e1b679a-0acd-48d3-983c-308c5b11c07a_2bfedd8a-cb27-4bbe-80d5-a3d37865e660/pptx/scripts/apply_theme.js");

const OUT = process.argv[2] || "deck.pptx";
const ERD_PNG = process.argv[3];

const THEME = {
  name: "Reservation ERD",
  headFontFace: "Vazirmatn",
  bodyFontFace: "Vazirmatn",
  colors: {
    dk1: "14213D", lt1: "FFFFFF", dk2: "3A4558", lt2: "F7F5F1",
    accent1: "B23A48", accent2: "2B6CB0", accent3: "6B46C1", accent4: "1F6B62",
    accent5: "D94F5C", accent6: "F28B93", hlink: "2B6CB0", folHlink: "6B46C1",
  },
};

// palette (tints are hex on purpose: they are not theme slots)
const NAVY = "14213D", INK = "3A4558", SOFT = "4A5568", CORAL = "B23A48", CORAL_DK = "8A2534",
  CORAL_LT = "F28B93", CORAL_TINT = "FBE5E7", BLUE = "2B6CB0", BLUE_DK = "1A4A80", BLUE_TINT = "E3EDF8",
  PURPLE = "6B46C1", PURPLE_DK = "4A2F8F", PURPLE_TINT = "EEE8F9", TEAL = "1F6B62", TEAL_LT = "7FD1C7",
  CARD = "F7F5F1", LINE = "E3DDD2", STRIP = "F1EEE8", MUTED_ON_DARK = "C9D3E3", FAINT_ON_DARK = "8FA3C0";
const CODE = "Courier New";

const W = 13.333, M = 0.6, CW = W - 2 * M;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "دموی ERD سامانه رزرو اقامتگاه";
pres.author = "Zia";
pres.rtlMode = true;
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: "FFFFFF" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.85, w: CW, h: 0.85, fontSize: 32, bold: true, color: C.text1, align: "right", valign: "middle", rtlMode: true, lang: "fa-IR", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 0.35, y: 6.95, w: 0.6, h: 0.3, fontSize: 10, color: "8A8F98" },
});
pres.defineSlideMaster({
  title: "DARK",
  background: { color: NAVY },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.35, w: CW, h: 1.5, fontSize: 54, bold: true, color: C.background1, align: "right", valign: "middle", rtlMode: true, lang: "fa-IR", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "DIVIDER",
  background: { color: CORAL_DK },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.5, w: CW, h: 1.5, fontSize: 60, bold: true, color: C.background1, align: "right", valign: "middle", rtlMode: true, lang: "fa-IR", margin: 0 }, text: "" } },
  ],
});

// ---------- helpers ----------
let shapeId = 0;
const nm = (p) => `${p}-${++shapeId}`;
// Persian text box (RTL)
function fa(slide, text, o) {
  slide.addText(text, {
    isTextBox: true, rtlMode: true, lang: "fa-IR", align: "right", valign: "top", margin: 0,
    fontSize: 14, color: INK, paraSpaceAfter: 0, lineSpacingMultiple: 1.15, objectName: nm("fa"), ...o,
  });
}
// LTR text box (identifiers, code)
function en(slide, text, o) {
  slide.addText(text, {
    isTextBox: true, rtlMode: false, align: "left", valign: "top", margin: 0,
    fontFace: CODE, fontSize: 12, color: NAVY, objectName: nm("en"), ...o,
  });
}
function card(slide, x, y, w, h, o = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.12, fill: { color: o.fill || CARD }, line: { color: o.line || LINE, width: o.lineW || 1 },
    objectName: nm("card"),
  });
}
function eyebrow(slide, text, color) {
  fa(slide, text, { x: M, y: 0.45, w: CW, h: 0.4, fontSize: 14, bold: true, color, valign: "bottom" });
}
function bullets(items, o = {}) {
  return items.map((t, i) => ({
    text: t,
    options: { bullet: { indent: 14 }, rtlMode: true, lang: "fa-IR", breakLine: i < items.length - 1, paraSpaceAfter: 6, ...o },
  }));
}
// column x for RTL rows: i = 0 is the rightmost
const colX = (i, n, gap) => { const cw = (CW - (n - 1) * gap) / n; return { x: M + CW - (i + 1) * cw - i * gap, w: cw }; };

const iconCache = {};
async function icon(name, color) {
  const key = name + color;
  if (!iconCache[key]) {
    const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(tb[name], { color: "#" + color, size: 256 }));
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    iconCache[key] = "image/png;base64," + buf.toString("base64");
  }
  return iconCache[key];
}
async function iconCircle(slide, name, x, y, d, fill, color) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: nm("icon-bg") });
  const p = d * 0.22;
  slide.addImage({ data: await icon(name, color), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: "", objectName: nm("icon") });
}

// ---------- table slide template ----------
function tableSlide(s) {
  const slide = pres.addSlide({ masterName: "CONTENT", sectionTitle: "جدول‌ها" });
  eyebrow(slide, s.group, s.color);
  slide.addText(s.title, { placeholder: "title", rtlMode: true, lang: "fa-IR" });
  // table-name chip, top left
  const chipFs = s.chip.length > 30 ? 14 : 18;
  const chipW = Math.min(6.6, s.chip.length * chipFs * 0.6 / 72 + 0.7);
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 0.95, w: chipW, h: 0.62, rectRadius: 0.1, fill: { color: s.tint }, line: { color: s.tint }, objectName: nm("chip") });
  en(slide, s.chip, { x: M + 0.2, y: 0.95, w: chipW - 0.4, h: 0.62, fontSize: chipFs, bold: true, color: s.dark, valign: "middle", align: "center" });

  const heads = ["چرا هست؟", "هدف", "کاربردهای اصلی"];
  for (let i = 0; i < 3; i++) {
    const { x, w } = colX(i, 3, 0.3);
    card(slide, x, 2.0, w, 3.2);
    fa(slide, heads[i], { x: x + 0.3, y: 2.25, w: w - 0.6, h: 0.45, fontSize: 18, bold: true, color: s.color });
    if (i < 2) fa(slide, s.cards[i], { x: x + 0.3, y: 2.85, w: w - 0.6, h: 2.2, fontSize: 16, color: INK, lineSpacingMultiple: 1.3 });
    else fa(slide, bullets(s.uses), { x: x + 0.3, y: 2.85, w: w - 0.6, h: 2.2, fontSize: 15, color: INK, lineSpacingMultiple: 1.2 });
  }
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.5, w: CW, h: 0.8, rectRadius: 0.1, fill: { color: STRIP }, line: { color: STRIP }, objectName: nm("strip") });
  fa(slide, "ستون‌های کلیدی", { x: M + CW - 2.1, y: 5.5, w: 1.85, h: 0.8, fontSize: 13, bold: true, color: SOFT, valign: "middle" });
  en(slide, s.cols, { x: M + 0.3, y: 5.5, w: CW - 2.6, h: 0.8, fontSize: 12, valign: "middle" });
  slide.addNotes(s.notes);
}

(async () => {
  // 1. cover
  pres.addSection({ title: "هدف و نمای کلی" });
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: "هدف و نمای کلی" });
    fa(s, "دموی ERD · طراحی پایگاه داده", { x: M, y: 1.75, w: CW, h: 0.5, fontSize: 16, bold: true, color: CORAL_LT });
    s.addText("سامانه رزرو اقامتگاه", { placeholder: "title", rtlMode: true, lang: "fa-IR" });
    fa(s, "یک نمونه ساده شبیه Airbnb: ده جدول، یک قانون مهم، و هیچ رزرو تکراری", { x: M, y: 4.0, w: CW, h: 0.9, fontSize: 22, color: MUTED_ON_DARK });
    en(s, "PostgreSQL · dbdiagram.io · Mermaid", { x: M, y: 5.6, w: CW, h: 0.4, fontSize: 13, color: FAINT_ON_DARK, align: "right" });
    s.addNotes("سلام. در این ارائه طراحی پایگاه داده یک سامانه رزرو اقامتگاه را نشان می‌دهم؛ چیزی شبیه Airbnb ولی ساده‌شده. اول هدف و نمای کلی ERD را می‌بینیم، بعد تک‌تک جدول‌ها را مرور می‌کنیم، و در پایان به مهم‌ترین مشکل این سیستم‌ها یعنی رزرو هم‌زمان می‌پردازیم.");
  }

  // 2. goal
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "هدف و نمای کلی" });
    eyebrow(s, "هدف", CORAL);
    s.addText("می‌خواهیم برای یک سامانه رزرو اقامتگاه ERD بکشیم", { placeholder: "title", rtlMode: true, lang: "fa-IR" });
    fa(s, "جدول‌ها آماده شده‌اند. این ارائه نشان می‌دهد هر جدول چرا هست و پایگاه داده چطور جلوی رزرو هم‌زمان را می‌گیرد.", { x: M, y: 1.75, w: CW, h: 0.45, fontSize: 15, color: SOFT });
    const items = [
      ["TbWorld", "کجا؟", "جستجو با کشور و شهر", BLUE, BLUE_TINT],
      ["TbClock", "کی؟", "تاریخ ورود و خروج", BLUE, BLUE_TINT],
      ["TbUsers", "چند نفر؟", "بزرگسال، کودک، نوزاد، حیوان خانگی", BLUE, BLUE_TINT],
      ["TbMap", "نقشه", "اقامتگاه‌ها روی نقشه، با مختصات", PURPLE, PURPLE_TINT],
      ["TbHome", "عکس و امکانات", "گالری عکس، وای‌فای، آشپزخانه", PURPLE, PURPLE_TINT],
      ["TbStar", "امتیاز و نظر", "ستاره و متن نظر مهمان", PURPLE, PURPLE_TINT],
    ];
    for (let k = 0; k < 6; k++) {
      const row = Math.floor(k / 3), i = k % 3;
      const { x, w } = colX(i, 3, 0.3);
      const y = 2.45 + row * 1.5;
      const [ic, h3, p, col, tint] = items[k];
      card(s, x, y, w, 1.25);
      await iconCircle(s, ic, x + w - 1.05, y + 0.25, 0.75, tint, col);
      fa(s, h3, { x: x + 0.25, y: y + 0.2, w: w - 1.5, h: 0.45, fontSize: 18, bold: true, color: NAVY });
      fa(s, p, { x: x + 0.25, y: y + 0.65, w: w - 1.5, h: 0.45, fontSize: 14, color: SOFT });
    }
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.55, w: CW, h: 0.95, rectRadius: 0.12, fill: { color: CORAL_TINT }, line: { color: CORAL, width: 1.5 }, objectName: nm("band") });
    await iconCircle(s, "TbLock", M + CW - 0.95, 5.67, 0.7, "FFFFFF", CORAL);
    fa(s, "و مهم‌تر از همه: دو نفر هرگز نتوانند یک اقامتگاه را برای شب‌های یکسان رزرو کنند", { x: M + 0.3, y: 5.55, w: CW - 1.5, h: 0.95, fontSize: 17, bold: true, color: CORAL_DK, valign: "middle" });
    s.addNotes("هدف این است که برای یک سامانه رزرو اقامتگاه، شبیه Airbnb، نمودار ERD بکشیم. جدول‌ها را آماده کرده‌ایم. نیازها از صفحه جستجوی Airbnb آمده‌اند: کجا، کی، و چند نفر؛ به‌علاوه نقشه، عکس‌ها، امکانات و امتیاز. مهم‌ترین نیاز همان نوار قرمز پایین است: هیچ دو رزروی برای یک اقامتگاه نباید شب‌های مشترک داشته باشند.");
  }

  // 3. ERD overview
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "هدف و نمای کلی" });
    eyebrow(s, "نمای کلی ERD", CORAL);
    s.addText("ده جدول در سه گروه", { placeholder: "title", rtlMode: true, lang: "fa-IR" });
    const lw = 3.5, lx = M + CW - lw;
    const groups = [
      ["کاربران و مکان", "users · countries · cities · listings", BLUE, BLUE_DK, BLUE_TINT],
      ["جزئیات اقامتگاه", "listing_photos · amenity_categories · amenities · listing_amenities", PURPLE, PURPLE_DK, PURPLE_TINT],
      ["رزرو و نظر", "bookings · reviews", CORAL, CORAL_DK, CORAL_TINT],
    ];
    let y = 2.0;
    for (const [h, t, c, dk, tint] of groups) {
      const h2 = t.length > 45 ? 1.35 : 1.05;
      card(s, lx, y, lw, h2, { fill: tint, line: c, lineW: 1.25 });
      fa(s, h, { x: lx + 0.2, y: y + 0.12, w: lw - 0.4, h: 0.42, fontSize: 16, bold: true, color: dk });
      en(s, t, { x: lx + 0.2, y: y + 0.55, w: lw - 0.4, h: h2 - 0.65, fontSize: 11, color: dk });
      y += h2 + 0.2;
    }
    fa(s, "تصمیم‌ها: رتبه یعنی ستاره · نظر فقط متن · دامنه ساده (بدون پرداخت، علاقه‌مندی و پیام)", { x: lx, y: y + 0.05, w: lw, h: 0.9, fontSize: 12, color: SOFT, lineSpacingMultiple: 1.25 });
    const iw = CW - lw - 0.35, ih = iw / (3879 / 2043);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 2.0, w: iw, h: ih + 0.2, rectRadius: 0.12, fill: { color: "FFFDF9" }, line: { color: LINE }, objectName: nm("erd-frame") });
    s.addImage({ path: ERD_PNG, x: M + 0.1, y: 2.1, w: iw - 0.2, h: ih, altText: "نمودار ERD با ده جدول و رابطه‌های یک‌به‌چند", objectName: "erd-image" });
    s.addNotes("این نمای کلی است. ده جدول داریم که در سه گروه رنگی دسته‌بندی شده‌اند. آبی: کاربران، کشور، شهر و خود اقامتگاه. بنفش: عکس‌ها و امکانات. قرمز: رزروها و نظرها. جدول listings در مرکز است و پنج رابطه دارد. علامت‌های پنجه‌کلاغی یعنی رابطه یک‌به‌چند؛ مثلاً هر اقامتگاه چند رزرو دارد. تصمیم‌ها: رتبه همان ستاره است، نظر فقط متن است، و دامنه را ساده نگه داشتیم.");
  }

  // 4–10. table slides
  pres.addSection({ title: "جدول‌ها" });
  const G1 = { group: "گروه ۱ · کاربران و مکان", color: BLUE, dark: BLUE_DK, tint: BLUE_TINT };
  const G2 = { group: "گروه ۲ · جزئیات اقامتگاه", color: PURPLE, dark: PURPLE_DK, tint: PURPLE_TINT };
  const G3 = { group: "گروه ۳ · رزرو و نظر", color: CORAL, dark: CORAL_DK, tint: CORAL_TINT };
  tableSlide({ ...G1, title: "کاربران", chip: "users",
    cards: ["هر آگهی یک صاحب دارد و هر رزرو یک مسافر. بدون کاربر، هیچ‌کدام معنی ندارد.", "یک جدول برای همه، مهمان و میزبان. میزبان یعنی کاربری که اقامتگاه دارد؛ جدول یا نقش جداگانه لازم نیست."],
    uses: ["ثبت‌نام و ورود با ایمیل یکتا", "صاحب آگهی (host_id)", "رزروکننده (guest_id)", "نویسنده نظر"],
    cols: "id · email UNIQUE · password_hash · full_name · avatar_url · created_at",
    notes: "جدول کاربران. هر آگهی صاحبی دارد و هر رزرو مسافری؛ پس اول به کاربر نیاز داریم. یک جدول برای همه داریم؛ میزبان کسی است که حداقل یک اقامتگاه ثبت کرده، پس نقش جداگانه لازم نیست. ایمیل یکتاست تا هر نفر فقط یک حساب داشته باشد. این جدول از سه جا ارجاع می‌گیرد: صاحب آگهی، رزروکننده، و نویسنده نظر." });
  tableSlide({ ...G1, title: "کشور و شهر", chip: "countries · cities",
    cards: ["اولین کادر جستجو «کجا» است. مقصد باید یک نام استاندارد داشته باشد، نه هر بار املایی تازه.", "فهرستی کنترل‌شده از کشورها و شهرها؛ هر شهر یک بار و با یک شناسه. نام شهر در هر کشور یکتاست."],
    uses: ["پیشنهاد خودکار در کادر «کجا»", "فیلتر سریع اقامتگاه‌ها با city_id", "آمار بر اساس شهر"],
    cols: "countries(id, code UNIQUE, name) · cities(id, country_id, name)",
    notes: "کشور و شهر. اولین چیزی که کاربر در جستجو وارد می‌کند «کجا» است. اگر شهر را به‌صورت متن آزاد ذخیره کنیم، یکی می‌نویسد Helsinki و دیگری helsinki و جستجو خراب می‌شود. پس یک فهرست استاندارد داریم: هر کشور یک کد دوحرفی مثل FI دارد و نام هر شهر در کشورش یکتاست. محله، مثل Pasila، فقط یک ستون متنی روی خود اقامتگاه است." });
  tableSlide({ ...G1, title: "اقامتگاه (آگهی)", chip: "listings",
    cards: ["این همان چیزی است که مهمان جستجو و رزرو می‌کند؛ مرکز ERD با پنج رابطه.", "همه مشخصات یک آگهی: عنوان، نوع، ظرفیت، قیمت، ساعت ورود و خروج و مختصات. listing یعنی «آگهی»، نه خود ساختمان."],
    uses: ["کارت نتایج و پین روی نقشه", "فیلتر «چند نفر» با max_guests", "نمایش امتیاز مثل ۴٫۷۶ (۲۷۹)"],
    cols: "host_id · city_id · property_type · latitude · longitude · max_guests · pets_allowed · price_per_night · avg_rating · review_count",
    notes: "جدول اصلی، listings. چرا اسمش listing است و نه place؟ چون این جدول آگهی را نگه می‌دارد: عنوان، قیمت، عکس‌ها و وضعیت فعال بودن؛ Airbnb هم همین واژه را به کار می‌برد. عرض و طول جغرافیایی برای نمایش روی نقشه است. ظرفیت مهمان و اجازه حیوان خانگی برای فیلتر «چند نفر» است. امتیاز میانگین و تعداد نظرها کش شده‌اند تا کارت جستجو سریع ساخته شود و یک تریگر آن‌ها را به‌روز نگه می‌دارد." });
  tableSlide({ ...G2, title: "عکس‌ها", chip: "listing_photos",
    cards: ["هر اقامتگاه چندین عکس دارد و مهمان قبل از هر چیز عکس‌ها را می‌بیند.", "خود فایل در Object Storage (مثل S3) و پشت CDN است؛ جدول فقط کلید فایل، ابعاد و ترتیب را نگه می‌دارد."],
    uses: ["عکس کاور: sort_order = 0", "تور عکس اتاق‌به‌اتاق با room_tag", "عرض و ارتفاع تا صفحه هنگام بارگذاری نپرد"],
    cols: "listing_id · storage_key UNIQUE · width · height · caption · room_tag · sort_order",
    notes: "عکس‌ها. خود تصویر را در پایگاه داده نمی‌گذاریم؛ سی عکس چندمگابایتی جدول را سنگین و پشتیبان‌گیری را کند می‌کند. فایل در Object Storage مثل S3 است و از طریق CDN به کاربر می‌رسد؛ Airbnb هم عکس‌ها را از CDN خودش با پارامتر اندازه، مثل im_w=720، می‌دهد. ما فقط کلید فایل را نگه می‌داریم، نه آدرس کامل، تا اگر CDN عوض شد چیزی در پایگاه داده تغییر نکند. sort_order صفر یعنی عکس کاور." });
  tableSlide({ ...G2, title: "امکانات", chip: "amenity_categories · amenities · listing_amenities",
    cards: ["وای‌فای، آشپزخانه، مایکروویو… مهمان بر اساس همین‌ها انتخاب و فیلتر می‌کند.", "یک کاتالوگ به‌جای ستون‌های بله/خیر: امکان تازه فقط یک ردیف است، بدون تغییر ساختار. ۱۲ دسته و ۳۱ امکان."],
    uses: ["فیلتر چیپی مثل Wifi و Kitchen؛ آگهی باید همه را داشته باشد", "نمایش دسته‌بندی‌شده در صفحه آگهی", "شمارش برای پنل فیلتر"],
    cols: "amenities(category_id, name UNIQUE, icon) · listing_amenities(listing_id, amenity_id) PK",
    notes: "امکانات سه جدول دارد. دسته‌ها، مثل «آشپزخانه و غذاخوری»؛ خود امکانات، مثل وای‌فای و مایکروویو؛ و جدول واسط listing_amenities که می‌گوید کدام اقامتگاه چه امکاناتی دارد. این یک رابطه چندبه‌چند است. اگر برای هر امکان یک ستون بله/خیر می‌گذاشتیم، هر امکان تازه یعنی تغییر ساختار جدول. ستون icon فقط یک کلید مثل wifi است و خود آیکون در رابط کاربری است. حیوان خانگی عمداً امکان نیست، چون در ستون pets_allowed اقامتگاه است." });
  tableSlide({ ...G3, title: "رزروها", chip: "bookings",
    cards: ["قلب سامانه: هر رزرو یعنی این اقامتگاه، این شب‌ها، برای این مهمان.", "ثبت تاریخ‌ها، تعداد مهمانان، قیمتِ لحظه رزرو و وضعیت. قانون «بدون هم‌پوشانی» هم روی همین جدول است."],
    uses: ["بررسی آزاد بودن تاریخ‌ها در جستجو", "چرخه وضعیت: pending ← confirmed ← completed", "تاریخچه سفر و صورت‌حساب"],
    cols: "listing_id · guest_id · check_in · check_out · stay · adults · children · infants · pets · total_price · status · idempotency_key",
    notes: "جدول رزروها مهم‌ترین جدول است. هر ردیف می‌گوید کدام مهمان، کدام اقامتگاه را، برای چه شب‌هایی رزرو کرده. تعداد بزرگسال، کودک، نوزاد و حیوان خانگی جدا ذخیره می‌شود، همان چهار شمارنده صفحه جستجو. قیمت را در لحظه رزرو کپی می‌کنیم چون قیمت آگهی بعداً عوض می‌شود. ستون stay بازه تاریخ است و قانون جلوگیری از رزرو هم‌زمان روی همین ستون تعریف می‌شود؛ در بخش بعد به آن می‌رسیم." });
  tableSlide({ ...G3, title: "نظرها و امتیاز", chip: "reviews",
    cards: ["امتیاز ستاره‌ای و متن نظر به مهمان بعدی کمک می‌کند با اطمینان انتخاب کند.", "فقط مهمانی که اقامتش تمام شده نظر می‌دهد، و برای هر رزرو فقط یک نظر. این قانون‌ها در خود پایگاه داده است."],
    uses: ["میانگین ستاره روی کارت؛ تریگر به‌روزش می‌کند", "مرتب‌سازی نتایج بر اساس امتیاز", "شش امتیاز جزئی: تمیزی، دقت، ورود، ارتباط، موقعیت، ارزش"],
    cols: "booking_id UNIQUE · listing_id · guest_id · rating 1–5 · 6 sub-ratings · comment",
    notes: "نظرها. هر نظر به یک رزرو تمام‌شده وصل است. سه قانون در پایگاه داده داریم: یک تریگر بررسی می‌کند که رزرو در وضعیت completed باشد؛ booking_id یکتاست پس هر رزرو فقط یک نظر دارد؛ و یک کلید خارجی ترکیبی مطمئن می‌شود اقامتگاه و مهمانِ نظر همان‌هایی باشند که در رزرو آمده‌اند. این‌طوری نظر جعلی سخت می‌شود. بعد از هر نظر، تریگر دیگری میانگین امتیاز اقامتگاه را به‌روز می‌کند." });

  // 11. divider
  pres.addSection({ title: "رزرو هم‌زمان" });
  {
    const s = pres.addSlide({ masterName: "DIVIDER", sectionTitle: "رزرو هم‌زمان" });
    fa(s, "بخش سوم", { x: M, y: 1.9, w: CW, h: 0.5, fontSize: 16, bold: true, color: "F6C9CD" });
    s.addText("رزرو هم‌زمان", { placeholder: "title", rtlMode: true, lang: "fa-IR" });
    fa(s, "مهم‌ترین مشکل هر سیستم رزرو: دو نفر، یک اقامتگاه، همان شب‌ها، همان لحظه", { x: M, y: 4.2, w: CW, h: 0.9, fontSize: 24, color: "F6DDE0" });
    s.addNotes("حالا به مهم‌ترین بخش می‌رسیم. هر سیستم رزرو، از هتل و پرواز تا بلیت کنسرت، با یک مشکل مشترک روبه‌روست: دو نفر هم‌زمان یک چیز را رزرو کنند. اول می‌بینیم این مشکل دقیقاً چیست و کی پیش می‌آید، بعد راه‌حل‌های رایج را مقایسه می‌کنیم، و در آخر راه‌حلی را که در خود پایگاه داده پیاده کردیم و آزمایش کردیم.");
  }

  // 12. the race
  const th = (t, o = {}) => ({ text: t, options: { bold: true, fill: { color: STRIP }, color: NAVY, align: "right", rtlMode: true, lang: "fa-IR", ...o } });
  const td = (t, o = {}) => ({ text: t, options: { align: "right", rtlMode: true, lang: "fa-IR", color: INK, ...o } });
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "رزرو هم‌زمان" });
    eyebrow(s, "مشکل چیست؟", CORAL);
    s.addText("هر دو «آزاد» می‌بینند، هر دو ثبت می‌کنند", { placeholder: "title", rtlMode: true, lang: "fa-IR" });
    const tw = 7.6, tx = M + CW - tw;
    const hot = { fill: { color: CORAL_TINT } };
    s.addTable([
      [th("مهمان ب"), th("مهمان الف"), th("زمان")],
      [td("—"), td("آیا ۲۲ تا ۲۴ آذر آزاد است؟ بله"), td("لحظه ۱")],
      [td("آیا همان شب‌ها آزاد است؟ بله، هنوز"), td("—"), td("لحظه ۲")],
      [td("—"), td("رزرو ثبت شد"), td("لحظه ۳")],
      [td("رزرو دوم هم ثبت شد", { ...hot, color: CORAL_DK, bold: true }), td("—", hot), td("لحظه ۴", hot)],
    ], { x: tx, y: 2.0, w: tw, colW: [3.0, 3.0, 1.6], fontSize: 14, fontFace: "Vazirmatn", border: { type: "solid", pt: 0.75, color: LINE }, valign: "middle", rowH: 0.62, margin: 0.08, objectName: "race-table" });
    fa(s, "نتیجه: دو رزرو برای یک شب؛ یکی از مهمان‌ها پشت در می‌ماند.", { x: tx, y: 5.35, w: tw, h: 0.5, fontSize: 16, bold: true, color: CORAL_DK });
    const cw = CW - tw - 0.35;
    card(s, M, 2.0, cw, 4.0);
    fa(s, "کی پیش می‌آید؟", { x: M + 0.3, y: 2.2, w: cw - 0.6, h: 0.45, fontSize: 18, bold: true, color: CORAL });
    fa(s, bullets(["آگهی پرطرفدار و ایام تعطیل", "الگوی «اول بررسی، بعد ثبت» بدون قفل", "فاصله بین انتخاب تاریخ و پرداخت", "کلیک دوباره یا تلاش مجدد شبکه", "چند سرور برنامه که از هم خبر ندارند"]), { x: M + 0.3, y: 2.8, w: cw - 0.6, h: 3.0, fontSize: 14 });
    s.addNotes("این را «شرایط مسابقه» یا Race Condition می‌گویند. مهمان الف می‌پرسد آیا این شب‌ها آزاد است؛ جواب بله است. چند میلی‌ثانیه بعد، قبل از اینکه رزرو الف ثبت شود، مهمان ب همین سؤال را می‌پرسد و او هم جواب بله می‌گیرد. حالا هر دو ثبت می‌کنند. مشکل این است که «بررسی» و «ثبت» دو قدم جدا هستند و بینشان فاصله است. هرچه ترافیک بیشتر، مثلاً آگهی محبوب در تعطیلات، یا هرچه فاصله تا پرداخت طولانی‌تر، احتمالش بیشتر است. کلیک دوباره کاربر یا تلاش مجدد خودکار شبکه هم همین اثر را دارد.");
  }

  // 13. six solutions
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "رزرو هم‌زمان" });
    eyebrow(s, "راه‌حل‌های رایج", CORAL);
    s.addText("شش راه برای جلوگیری از رزرو تکراری", { placeholder: "title", rtlMode: true, lang: "fa-IR" });
    const sol = [
      ["قفل در برنامه", "یک قفل، مثلاً در Redis، روی اقامتگاه قبل از ثبت", "ضعف: با چند سرور و قفل منقضی‌شده شکننده است"],
      ["قفل بدبینانه", "SELECT … FOR UPDATE روی ردیف اقامتگاه؛ نفر دوم صبر می‌کند", "ضعف: درخواست‌ها صف می‌شوند"],
      ["قفل خوش‌بینانه", "ستون version؛ اگر کسی زودتر تغییر داد، ثبت شکست می‌خورد", "ضعف: بازنده باید دوباره تلاش کند"],
      ["ایزوله‌سازی SERIALIZABLE", "پایگاه داده تداخل تراکنش‌ها را خودش تشخیص می‌دهد", "ضعف: خطا و تلاش مجدد، هزینه بیشتر"],
      ["یک ردیف برای هر شب", "جدول شب‌ها با UNIQUE روی اقامتگاه و شب", "ضعف: ردیف‌های زیاد؛ ولی روی هر پایگاه داده‌ای کار می‌کند"],
      ["محدودیت EXCLUDE", "قانون «بدون هم‌پوشانی» در خود PostgreSQL", "ضعف: مخصوص PostgreSQL"],
    ];
    for (let k = 0; k < 6; k++) {
      const row = Math.floor(k / 3), i = k % 3;
      const { x, w } = colX(i, 3, 0.3);
      const y = 2.0 + row * 2.4, ours = k === 5;
      card(s, x, y, w, 2.15, ours ? { fill: CORAL_TINT, line: CORAL, lineW: 2 } : {});
      fa(s, sol[k][0], { x: x + 0.25, y: y + 0.2, w: w - 0.5 - (ours ? 1.25 : 0), h: 0.45, fontSize: 17, bold: true, color: ours ? CORAL_DK : NAVY, ...(ours ? { x: x + 1.3, w: w - 1.55 } : {}) });
      if (ours) {
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.2, y: y + 0.24, w: 0.95, h: 0.38, rectRadius: 0.19, fill: { color: CORAL }, line: { color: CORAL }, objectName: "our-pick" });
        fa(s, "انتخاب ما", { x: x + 0.2, y: y + 0.24, w: 0.95, h: 0.38, fontSize: 11, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
      }
      fa(s, sol[k][1], { x: x + 0.25, y: y + 0.75, w: w - 0.5, h: 0.75, fontSize: 14, color: INK });
      fa(s, sol[k][2], { x: x + 0.25, y: y + 1.5, w: w - 0.5, h: 0.55, fontSize: 12, color: ours ? CORAL_DK : CORAL });
    }
    s.addNotes("شش راه رایج داریم. قفل در لایه برنامه ساده است ولی وقتی چند سرور داریم یا قفل منقضی می‌شود قابل اعتماد نیست. قفل بدبینانه با FOR UPDATE مطمئن است ولی درخواست‌ها را پشت هم صف می‌کند. قفل خوش‌بینانه منتظر نمی‌ماند و فقط موقع ثبت تداخل را می‌فهمد. SERIALIZABLE کار را به پایگاه داده می‌سپارد ولی خطای بیشتری می‌دهد. جدول شب‌ها با UNIQUE روی همه پایگاه داده‌ها کار می‌کند. ما EXCLUDE را انتخاب کردیم چون قانون را مستقیم در پایگاه داده تعریف می‌کند؛ هیچ کدی، حتی کد اشتباه، نمی‌تواند دورش بزند.");
  }

  // 14. our solution
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "رزرو هم‌زمان" });
    eyebrow(s, "راه‌حل ما در پایگاه داده", CORAL);
    s.addText("قانون را به خود پایگاه داده بسپاریم", { placeholder: "title", rtlMode: true, lang: "fa-IR" });
    const pts = [
      "«=» یعنی همان اقامتگاه و «&&» یعنی بازه‌ها هم‌پوشانی دارند؛ این دو با هم ممنوع است",
      "بازه نیمه‌باز [ورود، خروج): مهمان بعدی همان روزی می‌آید که قبلی می‌رود",
      "فقط رزروهای فعال حساب می‌شوند؛ رزرو لغوشده تاریخ‌ها را آزاد می‌کند",
      "ثبت دوم خطای 23P01 می‌گیرد و برنامه می‌گوید «این تاریخ‌ها همین الان رزرو شد»",
    ];
    const codeW = 5.7, rx = M + codeW + 0.4, rw = CW - codeW - 0.4;
    const nums = ["۱", "۲", "۳", "۴"];
    pts.forEach((t, i) => {
      const y = 2.05 + i * 1.12;
      s.addShape(pres.shapes.OVAL, { x: M + CW - 0.6, y, w: 0.55, h: 0.55, fill: { color: CORAL }, line: { color: CORAL }, objectName: nm("num") });
      fa(s, nums[i], { x: M + CW - 0.6, y, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
      fa(s, t, { x: rx, y: y - 0.02, w: rw - 0.85, h: 0.95, fontSize: 15, color: INK, lineSpacingMultiple: 1.25 });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 2.0, w: codeW, h: 3.6, rectRadius: 0.12, fill: { color: NAVY }, line: { color: NAVY }, objectName: "code-block" });
    const nb = "    ";
    const L = (t, o = {}) => ({ text: t, options: { color: "D7DEEA", ...o } });
    const hl = { color: CORAL_LT, bold: true };
    s.addText([
      L("CONSTRAINT no_double_booking", { breakLine: true }),
      L("EXCLUDE USING gist (", { breakLine: true }),
      L(nb + "listing_id "), L("WITH =", hl), L(",", { breakLine: true }),
      L(nb + "stay" + " ".repeat(7)), L("WITH &&", { ...hl, breakLine: true }),
      L(")", { breakLine: true }),
      L("WHERE (status IN ('pending',", { breakLine: true }),
      L(nb + "'confirmed', 'completed'))", { breakLine: true }),
      L(" ", { breakLine: true }),
      L("stay = daterange(check_in, check_out, '[)')", { color: FAINT_ON_DARK, fontSize: 12 }),
    ], { x: M + 0.35, y: 2.3, w: codeW - 0.7, h: 3.1, fontFace: CODE, fontSize: 15, isTextBox: true, rtlMode: false, align: "left", valign: "top", margin: 0, lineSpacingMultiple: 1.25, objectName: "code-text" });
    s.addNotes("راه‌حل ما یک محدودیت EXCLUDE در PostgreSQL است. معنی‌اش این است: هیچ دو ردیفی در جدول bookings نمی‌توانند هم listing_id یکسان داشته باشند و هم بازه تاریخشان هم‌پوشانی داشته باشد. علامت && یعنی هم‌پوشانی دو بازه. بازه نیمه‌باز است، یعنی روز خروج جزو اقامت نیست، پس مهمان بعدی همان روز می‌تواند وارد شود. شرط WHERE فقط رزروهای فعال را حساب می‌کند. نکته مهم: این قانون با یک ایندکس GiST اجرا می‌شود، پس حتی اگر دو درخواست دقیقاً هم‌زمان برسند، پایگاه داده آن‌ها را پشت سر هم بررسی می‌کند و دومی خطای 23P01 می‌گیرد.");
  }

  // 15. test
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "رزرو هم‌زمان" });
    eyebrow(s, "آزمون روی PostgreSQL 16", CORAL);
    s.addText("قانون واقعاً کار می‌کند", { placeholder: "title", rtlMode: true, lang: "fa-IR" });
    const kw = 3.9, kx = M + CW - kw;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: kx, y: 2.0, w: kw, h: 4.55, rectRadius: 0.12, fill: { color: NAVY }, line: { color: NAVY }, objectName: "kpi" });
    fa(s, "۲۰", { x: kx, y: 2.15, w: kw, h: 1.15, fontSize: 72, bold: true, color: CORAL_LT, align: "center", valign: "middle" });
    fa(s, "درخواست هم‌زمان برای یک شب", { x: kx, y: 3.3, w: kw, h: 0.4, fontSize: 14, color: MUTED_ON_DARK, align: "center" });
    fa(s, "↓", { x: kx, y: 3.7, w: kw, h: 0.5, fontSize: 24, color: FAINT_ON_DARK, align: "center", valign: "middle" });
    fa(s, "۱", { x: kx, y: 4.2, w: kw, h: 1.15, fontSize: 72, bold: true, color: TEAL_LT, align: "center", valign: "middle" });
    fa(s, "رزرو ثبت شد؛ ۱۹ درخواست رد شد", { x: kx, y: 5.4, w: kw, h: 0.4, fontSize: 14, color: MUTED_ON_DARK, align: "center" });
    const no = { color: CORAL_DK, bold: true }, ok = { color: TEAL, bold: true };
    s.addTable([
      [th("نتیجه"), th("آزمون")],
      [td("رد شد", no), td("رزرو هم‌پوشان: روز ۱ تا ۳ و روز ۲ تا ۴")],
      [td("پذیرفته شد", ok), td("ورود همان روزی که مهمان قبلی خارج می‌شود")],
      [td("پذیرفته شد", ok), td("لغو رزرو، سپس رزرو همان تاریخ‌ها")],
      [td("رد شد؛ فقط یک رزرو", no), td("دو درخواست با یک idempotency_key")],
      [td("رد شد", no), td("نظر برای رزروی که تمام نشده")],
    ], { x: M, y: 2.0, w: CW - kw - 0.35, colW: [2.4, CW - kw - 0.35 - 2.4], fontSize: 14, fontFace: "Vazirmatn", border: { type: "solid", pt: 0.75, color: LINE }, valign: "middle", rowH: 0.62, margin: 0.08, objectName: "test-table" });
    s.addNotes("این‌ها را واقعاً روی PostgreSQL 16 اجرا کردیم. مهم‌ترین آزمون: بیست درخواست کاملاً هم‌زمان برای یک اقامتگاه و همان شب‌ها فرستادیم. فقط یکی ثبت شد و نوزده تای دیگر خطای no_double_booking گرفتند. آزمون‌های دیگر هم نشان می‌دهند قانون نه زیادی سخت است و نه زیادی شل: ورود همان روز خروج قبلی مجاز است، لغو رزرو تاریخ را آزاد می‌کند، کلیک دوباره رزرو دوم نمی‌سازد، و برای رزرو تمام‌نشده نمی‌شود نظر نوشت.");
  }

  // 16. helpers
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "رزرو هم‌زمان" });
    eyebrow(s, "دو لایه کمکی", CORAL);
    s.addText("نگه‌داشت موقت و کلید یکتایی", { placeholder: "title", rtlMode: true, lang: "fa-IR" });
    const cards2 = [
      ["TbClock", "نگه‌داشت موقت", "با انتخاب تاریخ، رزروی با وضعیت pending و مهلت حدود ۱۵ دقیقه (hold_expires_at) ثبت می‌شود و شب‌ها برای بقیه بسته است.", "پرداخت ← confirmed · بدون پرداخت ← expired"],
      ["TbKey", "کلید یکتایی", "هر کلیک «رزرو» یک idempotency_key یکتا دارد. اگر شبکه قطع شود و درخواست دوباره برسد، UNIQUE جلوی ثبت دوم را می‌گیرد.", "دو کلیک = یک رزرو، یک پرداخت"],
    ];
    for (let i = 0; i < 2; i++) {
      const { x, w } = colX(i, 2, 0.35);
      const [ic, h, p, pill] = cards2[i];
      card(s, x, 2.0, w, 3.05);
      await iconCircle(s, ic, x + w - 1.0, 2.2, 0.7, CORAL_TINT, CORAL);
      fa(s, h, { x: x + 0.3, y: 2.3, w: w - 1.5, h: 0.5, fontSize: 19, bold: true, color: NAVY, valign: "middle" });
      fa(s, p, { x: x + 0.3, y: 3.05, w: w - 0.6, h: 1.1, fontSize: 15, color: INK, lineSpacingMultiple: 1.3 });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.3, y: 4.3, w: w - 0.6, h: 0.55, rectRadius: 0.1, fill: { color: CORAL_TINT }, line: { color: CORAL_TINT }, objectName: nm("pill") });
      fa(s, pill, { x: x + 0.45, y: 4.3, w: w - 0.9, h: 0.55, fontSize: 14, bold: true, color: CORAL_DK, valign: "middle" });
    }
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.35, w: CW, h: 1.2, rectRadius: 0.12, fill: { color: NAVY }, line: { color: NAVY }, objectName: "example-band" });
    await iconCircle(s, "TbBulb", M + CW - 1.0, 5.6, 0.7, "2A3A5E", CORAL_LT);
    fa(s, "نمونه واقعی: تیم مهندسی Airbnb در ۲۰۱۹ نوشت که تلاش مجدد خودکار در شبکه می‌تواند به پرداخت تکراری برسد، و برای جلوگیری از آن کتابخانه‌ای به نام Orpheus برای idempotency ساخت.", { x: M + 0.35, y: 5.35, w: CW - 1.6, h: 1.2, fontSize: 15, color: "E6EDF7", valign: "middle", lineSpacingMultiple: 1.25 });
    s.addNotes("محدودیت EXCLUDE تضمین اصلی است، ولی دو لایه کمکی هم داریم. اول، نگه‌داشت موقت: وقتی مهمان تاریخ را انتخاب می‌کند و به صفحه پرداخت می‌رود، رزرو با وضعیت pending ثبت می‌شود و حدود پانزده دقیقه مهلت دارد. در این مدت کسی نمی‌تواند همان شب‌ها را بگیرد. اگر پرداخت نشد، یک کار زمان‌بندی‌شده وضعیت را expired می‌کند و تاریخ آزاد می‌شود. دوم، کلید یکتایی: هر درخواست رزرو یک شناسه یکتا دارد، پس اگر کاربر دو بار کلیک کند یا شبکه درخواست را تکرار کند، رزرو دوم ساخته نمی‌شود. Airbnb در مقاله‌ای در سال ۲۰۱۹ درباره همین مشکل در پرداخت‌ها نوشت و کتابخانه Orpheus را معرفی کرد.");
  }

  // 17. summary
  pres.addSection({ title: "جمع‌بندی" });
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: "جمع‌بندی" });
    fa(s, "جمع‌بندی", { x: M, y: 0.45, w: CW, h: 0.4, fontSize: 14, bold: true, color: CORAL_LT, valign: "bottom" });
    fa(s, "سه چیزی که باید بماند", { x: M, y: 0.85, w: CW, h: 0.85, fontSize: 32, bold: true, color: "FFFFFF", valign: "middle" });
    const rows = [
      "ده جدول در سه گروه: کاربران و مکان، جزئیات اقامتگاه، رزرو و نظر",
      "قانون‌های مهم در خود پایگاه داده‌اند، نه فقط در کد برنامه",
      "رزرو هم‌زمان با یک محدودیت EXCLUDE حل شد: ۲۰ درخواست، ۱ رزرو",
    ];
    ["۱", "۲", "۳"].forEach((n, i) => {
      const y = 2.2 + i * 1.15;
      s.addShape(pres.shapes.OVAL, { x: M + CW - 0.8, y, w: 0.75, h: 0.75, fill: { color: "2A3A5E" }, line: { color: "2A3A5E" }, objectName: nm("sum-num") });
      fa(s, n, { x: M + CW - 0.8, y, w: 0.75, h: 0.75, fontSize: 24, bold: true, color: CORAL_LT, align: "center", valign: "middle" });
      fa(s, rows[i], { x: M, y, w: CW - 1.1, h: 0.75, fontSize: 21, color: "E6EDF7", valign: "middle" });
    });
    fa(s, "پرسش و پاسخ", { x: M + CW - 4, y: 6.0, w: 4, h: 0.6, fontSize: 24, bold: true, color: "FFFFFF", valign: "bottom" });
    en(s, "schema.sql · schema.dbml · erd.mmd", { x: M, y: 6.1, w: 6, h: 0.5, fontSize: 13, color: FAINT_ON_DARK, valign: "bottom" });
    s.addNotes("جمع‌بندی. ده جدول داریم در سه گروه. مهم‌ترین تصمیم طراحی این بود که قانون‌های حیاتی، مثل عدم هم‌پوشانی رزروها و یک نظر برای هر رزرو، در خود پایگاه داده باشند؛ چون کد برنامه ممکن است اشتباه کند یا چند سرور هم‌زمان کار کنند، ولی پایگاه داده همیشه آخرین نگهبان است. و رزرو هم‌زمان با یک محدودیت EXCLUDE حل شد که در آزمون، از بیست درخواست هم‌زمان فقط یکی را پذیرفت. فایل‌های SQL، کد dbdiagram و نمودار Mermaid آماده‌اند. سؤالی هست؟");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
