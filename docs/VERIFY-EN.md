# Live parity check: translated clone vs ximitech.vn

> Historical: this parity check predates the Xartisan Studio rebrand. The geometry and motion
> results still describe the layout; brand text, contact details and metadata have since changed.
> See [REBRAND.md](REBRAND.md).

Scope: verify that the English build keeps the origin's design, layout system and motion, not just
its strings. Live = `https://ximitech.vn`, clone = `http://127.0.0.1:8788`.

## Method

- Headless Brave over CDP, same viewport and device scale for both sides.
- `tools/qa/map.mjs` walks `main` two levels deep after the route loader settles and records every
  section's top and height, plus `documentElement.scrollHeight`.
- `tools/verify/map-diff.mjs` matches nodes by DOM path and reports geometry deltas.
- `tools/verify/motion-audit.mjs` counts animation hooks (`data-motion`, `data-scroll`, `data-cue`,
  split headings, canvas, video, CSS animations), checks Lenis, scrolls to reveal targets and
  confirms their computed opacity/transform actually change.
- Viewport captures at fixed offsets for the home page, 1440 and 390.

The origin still ships the exact assets the clone mirrors (`index-DAfw2Y79.js`,
`index-BT757EXe.css`, same vendor hashes), so this compares like with like.

## Geometry

| route | viewport | docH live | docH clone | delta | nodes matched | worst text block | max top shift |
|---|---|---|---|---|---|---|---|
| / | 1440 | 31422 | 31478 | +0.18% | 19/19 | 1.2% | 56px |
| /thiet-ke-website | 1440 | 15374 | 15374 | 0.00% | 19/19 | 10.7% | 0px |
| /bang-gia-thiet-ke-website | 1440 | 6021 | 6105 | +1.40% | 7/7 | 5.0% | 28px |
| /gioi-thieu | 1440 | 5395 | 5507 | +2.08% | 9/9 | 16.3% | 86px |
| /tuyen-dung | 1440 | 4161 | 4292 | +3.15% | 11/11 | 18.7% | 131px |
| /ho-so-nang-luc | 1440 | 18397 | 18625 | +1.24% | 29/29 | 15.4% | 261px |
| /du-an | 1440 | 12363 | 12363 | 0.00% | 7/7 | 5.7% | 0px |
| /blog | 1440 | 4283 | 4386 | +2.40% | 7/7 | 4.2% | 0px |
| /du-an/dastin-hullor | 1440 | 9436 | 9436 | 0.00% | 10/10 | 9.5% | 0px |
| / | 390 | 29957 | 30139 | +0.61% | 19/19 | 5.7% | 182px |
| /tuyen-dung | 390 | 5359 | 5355 | -0.07% | 11/11 | 9.8% | 110px |

Every route matched every section node. No missing, added or reordered sections. Pages built from
fixed-height compositions (`/du-an`, `/du-an/*`, `/thiet-ke-website`) are pixel-identical in
geometry. The deltas elsewhere come from English copy wrapping to more lines inside otherwise
unchanged blocks, and every top shift equals the accumulated height delta above it.

Full data: `research/verify/summary.md` and `summary.json`.

## Motion

Identical inventory at 1440:

| metric | live / | clone / | live /tuyen-dung | clone /tuyen-dung |
|---|---|---|---|---|
| data-motion | 77 | 77 | 31 | 31 |
| data-scroll | 3 | 3 | 0 | 0 |
| data-cue | 87 | 87 | 0 | 0 |
| canvas | 4 | 4 | 2 | 2 |
| video | 2 | 2 | 0 | 0 |
| CSS animations | 16 | 16 | 3 | 3 |
| Lenis active | yes | yes | yes | yes |
| reveal targets that animated | 4 / 6 | 4 / 6 | 6 / 6 | 6 / 6 |

Split-word headings: 46 word spans live vs 39 in English, which is the word count difference, not
a missing effect. The stylesheet is byte-identical, so keyframes, easing and timing functions are
the same definitions.

Captures at offsets 0, 3000, 6600, 12000, 20000 and 26000 show the same components in the same
positions: hero, pinned cost/asset narrative with the four pedestals, capability block, project
gallery, monthly operations panel, pricing cards, FAQ. Phase differs between shots (week counters,
glow intensity, carousel position) because those run on time and scroll velocity; that is expected
between any two runs, including live versus live.

## Notes

- A decorative blurred glow (`absolute h-72 w-72`) reports a variable rect because an entry
  transform is applied to it. With a 4s settle the value flips between live and clone, which
  confirms it is animation phase, not layout. Excluded from the height metric.
- The brand film section was removed from the site after this check. Home `docH` is now 28868 with
  18 sections instead of 19; every other route is unchanged. The English cut is kept in
  `research/video-en/` (`docs/VIDEO-EN.md`).
- No console errors, failed requests or broken images in either crawl. The only logged error is the
  `/404` route's expected client-side warning, present before translation.

Verdict: design, layout system and motion match the origin 1:1. Geometry is identical on fixed
compositions and within 0 to 3.15% on text-led pages, entirely from longer English copy.
