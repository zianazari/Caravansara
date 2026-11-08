# Fonts

`Vazirmatn-Variable.woff2` is the variable Vazirmatn font (weights 100–900), version 33.0.3. It was taken from
the `vazirmatn` npm package, file `fonts/webfonts/Vazirmatn[wght].woff2`
(https://github.com/rastikerdar/vazirmatn).

- **License:** SIL Open Font License 1.1, in `OFL.txt`.
- **Why it is served from the site:** it is loaded with `next/font/local` rather than from a font CDN. The site then
  depends on no outside service, and the page does not shift while the font loads (specs/005-frontend-guest,
  future-work section 1). The font has Persian and Latin letters, so one font serves both `/fa` and `/en`.
