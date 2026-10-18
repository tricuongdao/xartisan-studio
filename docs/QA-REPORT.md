# XimiTech clone: QA report (this pass)

Scope: finish and verify the 1:1 clone of ximitech.vn in this repo (`site/` served by `server/serve.mjs`).
Method: static bundle analysis (REA + AST inspection) for behaviors, headless full-page capture and
pixel diffs for visual parity, viewport-by-viewport captures for scroll-animated pages.

## What was added or fixed this pass

1. Host-behavior parity in `server/serve.mjs` (mirrors observed origin behavior):
   - `/dich-vu` and `/dich-vu/` return `301 -> /thiet-ke-website` with the origin's exact 169-byte
     nginx body. The app itself also aliases this route (`<Navigate to="/thiet-ke-website">`).
   - Unknown paths under `/blog/*` and `/du-an/*` serve the generic SPA shell with status 200
     (`/blog/page/1`, `/blog/page/4`, `/blog/nope-slug`, `/du-an/nope-xyz` all match live).
   - Every other unknown path (including missing assets like `/nope.png`) serves the site's real
     404 page with status 404.
2. Mirrored the live 404 document (`upstream/404/index.html` -> `site/404/index.html`), rewritten by
   the build (fonts and R2 hosts localized).
3. `npm run build:site` rebuilt: 356 files, 58.3 MB. Server restarted on http://127.0.0.1:8788.
4. QA harness (all zero-dependency, headless Brave over CDP):
   - `tools/qa/parity.mjs` status + redirect + title parity, live vs clone (`research/reports/parity.json`)
   - `tools/qa/shoot.mjs` settled full-page or viewport-at-offsets captures (waits for the 20s
     route-transition loader, sweeps reveal animations); `SHOOT_NOSWEEP`, `SHOOT_OFFSETS` flags
   - `tools/qa/diff2.mjs` matched-filename pixel diff with summary
   - `tools/qa/diag.mjs` console errors, failed requests, DOM stats
   - `tools/qa/map.mjs` section layout map (offsets/heights) per viewport
   - npm scripts: `qa:parity`, `qa:shoot`, `qa:diff`, `qa:diag`, `qa:map`

## Parity results

Status/redirect/title parity: **36/36 paths match** (`research/reports/parity.json`).

Desktop full-page diffs, 1440px, settled captures, same method both sides (`research/diffs2/_summary.json`):

| route | diff | route | diff |
|---|---|---|---|
| / | animated sections, see below | /du-an | 0.131% |
| /thiet-ke-website | 0.078% | /du-an/apes-studio | 0.328% |
| /bang-gia-thiet-ke-website | 0.043% | /du-an/doux-nails-lounge | 0.000% |
| /dich-vu-seo-website | 0.000% | /blog | 0.000% |
| /lap-trinh-web-app | 0.000% | /blog/page/3 | 0.000% |
| /thiet-ke-landing-page | 0.000% | /blog/thiet-ke-website-ban-hang-can-gi | 0.003% |
| /thiet-ke-website-ban-hang | 0.000% | /blog/website-chuan-seo-la-gi | 0.000% |
| /thiet-ke-website-doanh-nghiep | 0.000% | /ho-so-nang-luc | 0.000% |
| /gioi-thieu | 0.244% | /tim-kiem?q=seo | 0.000% |
| /tuyen-dung | 0.095% | /lien-he | 0.000% |

Mobile full-page diffs, 390px (`research/diffs2m/_summary.json`):
du-an 0.000%, thiet-ke-website 0.000%, bang-gia 0.108%, lien-he 0.136%, gioi-thieu 0.595%,
ho-so-nang-luc and tuyen-dung and / re-verified by viewport offsets (below).

Scroll-animated pages, verified by viewport captures at fixed offsets (deterministic):
- / at 1440: 11 offsets, 9 at 0.000-0.9%; y0/y13600/y16000/y20000/y24000 differ only in
  marquee/carousel/glow animation phase (same content, same layout).
- /ho-so-nang-luc at 390: offsets 3800 and 18500 both 0.000% (`research/viewport/hsnlvp/diff/_summary.json`).
- /tuyen-dung at 390: y3000 0.000%; hero offsets differ 4.5-5.2% from the rotating orbit widget
  and animated hero glow (time phase); section maps identical (docH 5359 = 5359 on both).

Layout identity checks (tools/qa/map.mjs):
- / at 1440: 57 section nodes, identical tops/heights/footer on both sides.
- /tuyen-dung at 390: 11 nodes identical, docH 5359 both.

## REA evidence (this session)

- `assets/index-DAfw2Y79.js` analyzed statically: evidence `ev_8ce14c44...` (100,185 AST nodes,
  363 findings, loader logic and route table recovered from inert text; coverage partial as
  declared by the tool).
- Route table from the graph: 25 literal routes + `/blog/:slug`, `/blog/page/:page`,
  `/du-an/:slug` + catch-all `*` (NotFound). `/dich-vu` is a literal route at
  `assets/index-DAfw2Y79.js` L32:88401 (trace `ev_b7a4af93...`, 362 nodes, 146 terminal paths).
- Route loader (`.page-loader`): progress = images + fonts + route chunks + `[data-page-loading]`
  units; force-completes at 20s (s = 2e4) plus a frame-stability wait. This explains why captures
  must wait for the loader before the sweep.

## Known residual differences (animation phase, not structure)

- `/` full-page diff reads ~30%: the pinned scroll-narrative sections (`h-[500svh]` etc.) and the
  film/marquee layers freeze differently per capture run. Proof it is not a clone defect: section
  maps identical, and repeated captures flip the "heavier" rendering between live and clone.
- Hero orbit widget and animated glows differ by time phase on / and /tuyen-dung.
- Marquee strips differ by a few pixels of scroll phase.
- Reveal sections are timing-sensitive: a capture pair can agree at 0.000% while both sides are
  still in a pre-reveal (blank) state, or differ because one run swept the reveals and the other
  did not. Full-page percentages on animated pages are a smoke signal; viewport captures at fixed
  offsets plus the section map are the sign-off evidence.
- `site/` is byte-identical across the repository reorganization: 357 files, tree SHA-256
  `dc7f1d5f573fc26dad7ddf2c37a542ee8b0a1f18c12bd765ab445ffc361016b7` (see
  `research/meta/site-hash-before.txt` vs `site-hash-after.txt`).

## Media notes

- `uploads/ximitech/kho-giao-dien/v1/21.webp`..`40.webp` are 404 on all three origin R2 hosts,
  so the missing tiles are origin behavior; clone reproduces it.
- All other referenced media was mirrored locally (fonts, R2 videos, project images, profile).

## Behavior verification (interactive features)

- Theme toggle: works; clicking flips `html.class` `light` -> `dark` (and back). Smooth-scroll
  library (Lenis) and the `motion-ready` state classes match origin behavior.
- Chatbot ("Trợ lý XimiTech"): fully client-side. Verified round trip on both sides with the same
  question ("Chi phí thiết kế website là bao nhiêu?"): **identical answer text** on live and clone.
  Found and fixed during this check: `assets/chatbotKnowledge-CK2UAvVi.js` was missing from the
  clone (dynamic import target, never in the mirror asset list). Now mirrored, served, and listed
  in `tools/sync/mirror.mjs` ASSET_FILES. Before the fix the clone stalled at "Đang phân tích yêu cầu...".
- Contact: mailto / tel / Zalo links only (no form endpoint, no external API calls anywhere in the
  bundles). Contact routes work from the clone exactly as on origin.
- 3D sound prompt button and audio/theme controls present and wired.

## Completeness scans

- Dynamic chunk scan: 26 referenced chunks, all present after the chatbotKnowledge fix.
- Local asset reference scan over all site HTML/JS/CSS: 2 remaining dead references
  (`/home-hero-seed/...jpg`, `/uploads/2026/...banner-2.jpg`); both return 404 on the live origin
  too, so the clone reproduces origin behavior.
- Server persistence note: run the clone server detached (e.g. `Start-Process` or `npm run serve`).

## Re-run


```
npm run serve          # http://127.0.0.1:8788
npm run qa:parity      # live vs clone status/redirect/title parity
npm run qa:shoot -- <baseUrl> <routesFile> <outDir> 1440 900
npm run qa:diff        # pixel diff research/shots2 vs research/cloneshots2
npm run qa:map -- <url> 1440 900
npm run qa:diag -- <url>
```
