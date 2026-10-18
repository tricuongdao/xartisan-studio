# English version of the XimiTech clone

> Historical: this documents the translation pass. The site was subsequently rebranded to Xartisan
> Studio, which changed brand strings, asset paths and one blog slug (routing structure unchanged).
> See [REBRAND.md](REBRAND.md).

`site/` is now an English-language build of the same clone. Nothing about hosting, routing or
behaviour changed: same URLs, same 91 sitemap routes, same server.

## What was translated

| Surface | Coverage |
|---|---|
| React bundles in `site/assets/*.js` | 4,622 string tokens across 19 files |
| Static HTML shells (93 files) | 5,854 text nodes and attributes (`title`, meta, `alt`, `aria-label`, `placeholder`) |
| JSON-LD blocks | 92 blocks (Organization, Person, Service, FAQ, breadcrumbs, keywords) |
| Chatbot | questions, answers, keyword triggers and UI copy |
| Runtime formatting | dates and numbers switched from `vi-VN` to `en-US`; `inLanguage`, `lang`, `hreflang`, `og:locale` set to English |
| Page metadata | titles, descriptions, OG/Twitter cards, noscript and pre-render shells |

The source of truth is a translation catalog plus two small correction layers:

- `research/i18n/catalog.json`: every Vietnamese string with byte offsets (JS tokenizer + HTML parser)
- `research/i18n/cache.json`: machine translation per unique string (5,033 entries)
- `research/i18n/overrides.json`: 193 hand-written replacements for navigation, hero copy, CTAs and
  marketing headlines where machine output was weak
- `research/i18n/ascii.json`: strings that were Vietnamese but had no diacritics (`Xem`, `Trang`, `MST`)

## Rebuild

`site/` is generated. `tools/i18n/apply.mjs` restores the pristine tree from
`research/i18n/backup/site-original` and re-applies catalog + cache + overrides, so edits are
repeatable.

```bash
npm run i18n:apply       # regenerate site/ with the current dictionary
npm run i18n:verify      # crawl all routes: leftover VI, console errors, failed requests
```

Regenerate the catalog and re-translate only when the source bundles change:

```bash
npm run i18n:catalog     # rescan site/ (or the restored original tree)
npm run i18n:translate   # fill cache.json for new strings (Python, resumable)
npm run i18n:apply
```

Important: `npm run build:site` rebuilds `site/` from `upstream/` and would replace the English
build. Run `npm run i18n:apply` afterwards.

## Verification (this pass)

- 96 routes crawled headless at 1440px (91 sitemap routes, 404, search, blog pagination, SPA fallback)
- 0 Vietnamese characters in rendered text, attributes or titles; 0 ASCII-only Vietnamese labels
- 0 failed requests, 0 HTTP 4xx, 0 broken images
- 1 console error, on `/404` only, identical to the pre-translation baseline
- All 26 bundles pass `acorn.parse`; no page height changed by more than 12%
- Desktop and mobile captures reviewed at 1440px and 390px (hero, pricing, services, careers,
  profile)

Evidence: `research/i18n/baseline.json`, `research/i18n/final.json`,
`research/i18n/shots-en2/`, `research/i18n/shots-en2m/`.

## Known limits

- URLs keep their Vietnamese slugs (`/thiet-ke-website`, `/du-an/...`). Renaming them would break
  the server's route map, every internal link and the sitemap; the brief was to not break anything.
- Text baked into media: the brand film section has been removed from the site; its English re-edit
  is kept in `research/video-en/` (`docs/VIDEO-EN.md`). Project screenshots inside that film show
  client websites in their original languages. Hero background videos are abstract and carry no text.
- A handful of proper nouns stay as-is in structured data (the founder's Vietnamese alternate name).
- Developer comments in bundles and HTML remain Vietnamese; they are not rendered.
- Machine translation is used for long-form blog body copy. Headings, navigation, CTAs, pricing and
  service pages were reviewed and hand-corrected.
