# Xartisan Studio rebrand

The English site was rebranded from XimiTech to **Xartisan Studio** without changing its layout,
motion or URL structure. The original X mark is reused; only the wordmark, contact details, legal
copy and metadata changed. Everything is regenerated from the pristine backup by
`npm run i18n:apply`, so the rebrand is repeatable rather than a hand-edited build.

## Brand

| Field | Value |
| --- | --- |
| Name | Xartisan Studio |
| Domain | xartisan.studio |
| Email | hello@xartisan.studio |
| WhatsApp | 0435 878 929 · `+61 435 878 929` · `https://wa.me/61435878929` |
| Logo | Existing X mark, re-typeset as Xartisan Studio |
| Footer wordmark | XARTISAN |
| Address | Da Nang, Vietnam · serves nationwide |

## What changed

- **Copy**: all `XimiTech` / `XIMITECH` / `ximitech` strings in bundles, HTML shells, chatbot
  knowledge, metadata, JSON-LD, sitemap and robots.txt.
- **Contact**: old phone `088 888 9805` and `+84 888 898 05` replaced by `0435 878 929` /
  `+61 435 878 929`; email replaced by `hello@xartisan.studio`; every Zalo link becomes WhatsApp.
- **Legal**: original company name, tax code `4101691382`, tax-profile link, bank account and
  representative tax line removed. The About page's legal section is now "Studio information" with a
  neutral studio description. Footer shows only `© 2026 Xartisan Studio`.
- **Social**: TikTok, YouTube, Instagram and Threads handles point at `xartisanstudio`. The Zalo icon
  file was replaced by a WhatsApp glyph and renamed.
- **Metadata**: titles, descriptions, canonical, `og:url`, `og:image`, `application-name`,
  JSON-LD `url`, `logo`, `sameAs`, `telephone`, `email` and the sitemap all use `xartisan.studio`.
- **Paths**: `/uploads/ximitech/` → `/uploads/xartisan/`, `ximitech-logo*.webp` →
  `xartisan-logo*.webp`, `ximitech-mark.webp` → `xartisan-mark.webp`, `zalo-icon.png` →
  `whatsapp-icon.png`, and the mission blog slug now contains `xartisan-studio`.

## Colourway

The site uses the original blue/cyan palette, restored after the espresso Atelier experiment:

- Light (default): near-white `#F8FAFC`, navy text `#0F172A`, cyan `#00D4FF`, sky `#22D3EE`.
- Dark: deep navy `#0B1220`, white text, cyan accents.
- The theme toggle still offers both; light is the default again.

The new logo is recoloured to that same palette: a cyan chevron on the left, navy on the right with
an ice-cyan outline, a navy wordmark on light surfaces and an ice-white wordmark on dark surfaces.
No sienna, platinum or espresso tokens remain in the site chrome.

## Logo

The logo shape comes from the supplied Alabaster Atelier artwork, not the old XimiTech mark. It is
drawn as a bold cyan X with an outlined navy right stroke. The wordmark uses Manrope ExtraBold for
"Xartisan" with a larger, letterspaced "STUDIO" line that stays legible in the header, recoloured to
the site's cyan/navy palette.

- `xartisan-logo.webp` (256 px square, dark surfaces)
- `xartisan-logo-light.webp` (384 px square, light surfaces)
- `xartisan-logo-header.webp` / `xartisan-logo-header-light.webp` (horizontal header lockups)
- `xartisan-mark.webp`, `loader-logo.png`, `logo.png`, `logo192.png`, `logo512.png`,
  `apple-touch-icon.png`, `favicon.ico`, the 1200x630 `OG.png`, and `whatsapp-icon.png`

Source files live in `tools/brand/assets/` and are installed by `npm run i18n:apply`. The 20
design-library mockups also had a baked-in `XimiTech.vn` browser chip; they are re-lettered to
`xartisan.studio` on a white browser chip and served from a new `kho-giao-dien/v2/` path.

## Rebuild

```bash
npm run build:site     # restores the Vietnamese source + old brand
npm run i18n:apply     # translate, rebrand, install brand images, cache-bust
npm run serve          # http://127.0.0.1:8788
```

`i18n:apply` also versions brand image URLs with a content hash and versions the JS/CSS bundles, so
a cached old logo or bundle cannot survive a rebuild.

## Verification

- **96 routes** crawled after the final rebuild: **0** old-brand hits in rendered text, attributes,
  titles or JSON-LD, **0** broken images, **0** console errors on key routes.
- **All 26 JS bundles parse** (`node tools/i18n/check.mjs`).
- **Site-wide string audit** (including uploads): `XimiTech`, `XIMITECH`, `ximitech`, `4101691382`,
  `088 888 9805`, `0888889805`, `doximitech`, `masothue`, `zalo.me` all return **0**. The only
  remaining `Zalo` reference is **ZaloPay**, a third-party payment brand kept in the chatbot's
  industry examples.
- **No horizontal scroll at 390 px** on home, pricing, capability profile, careers, about or contact.
- **Layout heights at 1440 px** (unchanged structure; film already removed):

| Route | Height |
| --- | ---: |
| `/` | 28,868 |
| `/thiet-ke-website` | 15,374 |
| `/du-an` | 12,363 |
| `/du-an/dastin-hullor` | 9,436 |
| `/bang-gia-thiet-ke-website` | 6,105 |
| `/ho-so-nang-luc` | 18,019 |
| `/tuyen-dung` | 4,324 |
| `/gioi-thieu` | 4,850 |
| `/lien-he` | 2,476 |
| `/blog` | 4,386 |

- **Metadata spot-check**: title `Xartisan Studio - Your website is an asset, built right and run
  every month`; canonical `https://xartisan.studio/`; `og:image`
  `https://xartisan.studio/OG.png`; JSON-LD organization `name` and `legalName` Xartisan Studio,
  `telephone` +61435878929, `email` hello@xartisan.studio, no `taxID`.
- **Sitemap**: 91 URLs, all on `xartisan.studio`; robots points at the new sitemap.
- **Mockups**: 20 design-library images re-lettered from `XimiTech.vn` to `xartisan.studio`.

Evidence: `research/verify/brand-scan-{1,2,3}.json`, `research/verify/layout-1440.json`,
`research/verify/layout-390.json`.

## Known limits

- The old blog URL (`/blog/su-menh-tam-nhin-ximitech-website-la-tai-san`) is not redirected; it falls
  back to the blog index like any unknown `/blog/*` path.
- `upstream/` and `research/i18n/backup/site-original/` still contain the original mirror. Neither
  is served.
- The 3D logo model referenced by the About page was never present in the mirror; the page falls
  back to the static lockup, as before.
