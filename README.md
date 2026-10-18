# Xartisan Studio website

An English-language, design- and motion-accurate static site for **Xartisan Studio**, rebuilt from
a 1:1 mirror of https://ximitech.vn (91 sitemap routes plus the search page) and served by a
zero-dependency Node server. It keeps the origin's shipped HTML documents, JS bundles, CSS, images,
fonts and videos, along with its URL behavior (clean URLs, a 301 alias, SPA fallbacks and the real
404 page).

Copy is translated in place: bundles, HTML shells, metadata and the client-side chatbot. The site is
then rebranded end to end: name, domain, email, WhatsApp contact, social handles, legal copy and
brand images. See [docs/TRANSLATION.md](docs/TRANSLATION.md) and
[docs/REBRAND.md](docs/REBRAND.md) for coverage, rebuild commands and verification evidence. The
brand film section has been removed; its English re-edit is kept in `research/video-en/`
([docs/VIDEO-EN.md](docs/VIDEO-EN.md)). `npm run build:site` restores the Vietnamese source and the
old brand, so run `npm run i18n:apply` after any rebuild.

- **Website entry point:** `site/` (deployable as-is to any static host)
- **Local preview:** `npm run serve` -> http://127.0.0.1:8788
- **Status and evidence:** [docs/QA-REPORT.md](docs/QA-REPORT.md), [docs/REBRAND.md](docs/REBRAND.md)

## Brand

| Field | Value |
| --- | --- |
| Name | Xartisan Studio |
| Domain | xartisan.studio |
| Email | hello@xartisan.studio |
| WhatsApp | 0435 878 929 (`+61 435 878 929`) |
| Logo | New Atelier X mark, recoloured cyan/navy |
| Palette | Original blue/cyan (restored) |
| Theme | Light by default; original navy dark mode |
| Removed | Original legal entity, tax ID, bank details, Zalo, old social handles |

Brand text and images live in `tools/brand/assets/` and are installed by `npm run i18n:apply`, so a
rebuild cannot leave stale logos behind.

## Structure

```
ximitech-clone/
├── site/                    THE WEBSITE. Served files, deployable unchanged.
├── server/
│   └── serve.mjs            Zero-dependency static server (URL semantics + 404 page + 301s).
├── upstream/                Raw snapshot of ximitech.vn used to rebuild site/ (mirror input).
│   └── _r2/                 Media downloaded from the origin's R2 buckets.
├── tools/
│   ├── lib/paths.mjs        Project paths resolved from the file, so tools work from any cwd.
│   ├── sync/                mirror.mjs, dl-union.mjs, probe-media.mjs  (origin -> upstream/)
│   ├── build/               build-site.mjs, extract-data.mjs           (upstream/ -> site/)
│   ├── i18n/                catalog, translate, apply, crawl, version-assets
│   ├── brand/assets/        Xartisan lockups, favicons, OG card, WhatsApp icon
│   ├── qa/                  parity, shoot, diff2, diff-shots, diag, map, probe-ui, hash-site
│   │   ├── routes/          Route lists for batch capture runs.
│   │   └── vendor/          QA-only deps (pngjs, pixelmatch). `cd tools/qa/vendor && npm install`
│   └── inspect-bundles.mjs  Lists R2/uploads refs found in the mirrored bundles.
├── research/                Evidence and working material (never served).
│   ├── crawl/               Per-route network/asset crawl JSONs.
│   ├── shots/ shots2/ shots2m/   Live full-page screenshots (v1, desktop v2, mobile v2).
│   ├── cloneshots/ cloneshots2/ cloneshots2m/  Matching clone screenshots.
│   ├── diffs/ diffs2/ diffs2m/   Pixel-diff images and summaries.
│   ├── viewport/            Viewport-at-offset checks for scroll-animated pages.
│   ├── recap/               Ad-hoc comparison crops.
│   ├── beautified/          Prettified bundles used for the content extraction.
│   ├── rea/                 REA static-analysis output for the app bundle.
│   ├── meta/                sitemap + manifests + build/probe reports + site hash snapshots.
│   ├── reports/             parity.json, qa-summary.json.
│   └── runtime/             Server log/pid from local runs.
└── docs/
    ├── QA-REPORT.md         What was verified, how, and the known limits.
    ├── TRANSLATION.md       English localization method and coverage.
    ├── REBRAND.md           Xartisan Studio rebrand: scope, assets, verification.
    └── VIDEO-EN.md          English brand-film re-edit (not mounted).
```

## Run and inspect

```bash
npm run serve          # http://127.0.0.1:8788  (no install needed, zero dependencies)
```

Server behavior mirrors the origin: directory URLs resolve without redirect, `/dich-vu` returns
301 to `/thiet-ke-website`, unknown paths under `/blog/*` and `/du-an/*` serve the SPA shell with
200, everything else unknown serves the styled 404 page with status 404, HTML is `no-cache`,
assets are immutable-cached, byte ranges are supported.

## Continue building on it

`site/` is the live tree. To add or change pages, edit files there directly:

- New page: create `site/<slug>/index.html`. Clean URLs work without any server change.
- Shared assets: `site/assets/`, `site/fonts/`, `site/uploads/`.
- The server has no build step, so what is on disk is what is served.

Important: `npm run build:site` **rebuilds `site/` from `upstream/` and overwrites manual edits**.
Use it only when intentionally re-syncing with the origin:

```bash
npm run mirror         # refresh upstream/ pages + assets from ximitech.vn
npm run sync:all       # mirror + union asset download + media probe
npm run build:site     # rebuild site/ (R2 + font localization, third-party tag cleanup)
npm run i18n:apply     # translate + rebrand + install brand images + cache-bust
npm run qa:parity      # live vs clone status/redirect/title parity
npm run qa:hash        # byte manifest + aggregate hash of site/ (prove "no changes")
```

Because `site/` is minified build output from the origin, prefer adding new pages/sections as
separate static files rather than editing the bundled JS. Copy an existing page shell
(`site/index.html` or a simpler route like `site/gioi-thieu/index.html`) and keep its head/scripts.

## QA

```bash
npm run qa:parity                          # needs the clone running; writes research/reports/parity.json
npm run qa:shoot -- http://127.0.0.1:8788 tools/qa/routes/desktop-routes.txt research/cloneshots2 1440 900
npm run qa:diff                            # pixel diff research/shots2 vs research/cloneshots2
npm run qa:diag -- http://127.0.0.1:8788/  # console errors, failed requests, DOM stats
npm run qa:map -- http://127.0.0.1:8788/ 1440 900   # section layout map
```

Capture notes: the site shows a route-transition loader (`.page-loader`) that force-completes
after 20s; the shooter waits it out, sweeps reveal animations and captures headless. Scroll-linked
pinned sections never freeze identically between runs, so those pages are verified with
`SHOOT_OFFSETS` viewport captures and section maps instead of full-page pixel diffs.

## Known limits

- Analytics/tracking tags from the origin are removed during the build.
- Canonicals, schema.org URLs, `og:url` and the sitemap point at `xartisan.studio`.
- `upstream/` and the pristine backup still contain the original XimiTech mirror; neither is served.
- The old blog URL `su-menh-tam-nhin-ximitech-website-la-tai-san` is not redirected; it falls back to
  the blog index like any unknown `/blog/*` path.
- The local server replicates observed HTTP behavior, not nginx/TLS/CDN details.
- Two origin assets referenced by the bundle are dead on the origin as well
  (`/home-hero-seed/...jpg`, `/uploads/2026/...banner-2.jpg`) and stay dead here.
