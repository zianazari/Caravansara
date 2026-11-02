# ERD demo deck (Persian, Vazirmatn)

Two versions of the same 17-slide deck:

| Version | Where | Use it for |
| --- | --- | --- |
| **PowerPoint** | `ERD-demo-fa.pptx` | Presenting from PowerPoint or Keynote. Right-to-left is built in: every Persian paragraph is marked RTL (`rtl="1"`, language `fa-IR`), so word order, punctuation and bullets are correct |
| Online | https://claude.ai/artifact/9aT5rXEGMY6FqEj4XNGukS | Presenting in the browser. Its own PowerPoint export does **not** keep RTL — use `ERD-demo-fa.pptx` instead |

## Before presenting the .pptx

Install the font once: open `fonts/Vazirmatn-Regular.ttf`, `Vazirmatn-Bold.ttf` and `Vazirmatn-ExtraBold.ttf`
and click **Install** (macOS Font Book). Without it PowerPoint substitutes another font, which still
shows Persian correctly but changes the look. The font is under the SIL Open Font License (`fonts/OFL.txt`).

## Files

- `ERD-demo-fa.pptx`: the PowerPoint deck, speaker notes included
- `fonts/`: Vazirmatn font files and license
- `pptx-source/build.js`: pptxgenjs script that generates the .pptx (`node build.js deck.pptx erd-overview.png`)
- `deck.json`, `slides/*.html`: source of the online deck (Persian text there is wrapped in U+202B … U+202C)
- `erd-overview.png` / `.mmd`: the colour-grouped ERD used on slide 3

The deck shows the 10-table design it was made for (2026-10-30); the schema has since grown to 12 tables
(see `db/README.md`).
