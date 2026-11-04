# Deploying Xartisan Studio

The repository ships a **prebuilt static site**. There is no build step: the contents of `site/` are
the artifact. Publish that directory and the site is live.

```
site/                 → public root (publish this)
site/_redirects       → 90 legacy Vietnamese URLs → English 301s
site/_headers         → security + cache headers
site/404.html         → 404 response (copy of site/404/index.html)
wrangler.jsonc        → Cloudflare Workers static assets (recommended host)
netlify.toml          → Netlify (publish dir)
vercel.json           → Vercel (redirects converted, clean URLs)
```

Before every deploy:

```bash
npm run check     # 93 pages · internal links · canonicals · sitemap · stale tokens
npm run serve     # preview at http://127.0.0.1:8788
```

## Which host?

| Host | Cost for a commercial site | Static bandwidth | URL behaviour vs. our canonicals |
| --- | --- | --- | --- |
| **Cloudflare Workers** (recommended) | Free | **Unlimited** — "requests to static assets are free and unlimited" | Exact: `drop-trailing-slash` keeps `/contact` and 307s `/contact/` → `/contact` |
| Cloudflare Pages | Free | Unlimited | Forces a **308 to `/contact/`**, so canonicals (no slash) mismatch |
| Vercel | **Pro $20/seat/mo** — Hobby is non-commercial only | 100 GB/mo included | Exact: `trailingSlash: false` |
| Netlify | Free tier, credits-based | ~100 GB/mo | Exact: pretty URLs serve `/contact` directly |

Cloudflare is the default recommendation: free for commercial use, static asset requests are not
billed, and DNS + TLS + CDN live in one place. Vercel is the nicer product to work in, but a business
site on Vercel needs Pro, so it is a $20/month decision rather than a free one.

## Option A — Cloudflare Workers (recommended)

`wrangler.jsonc` is already configured:

```jsonc
"assets": {
  "directory": "./site",
  "html_handling": "drop-trailing-slash",   // /contact stays /contact
  "not_found_handling": "404-page"          // serves site/404.html with status 404
}
```

**Dashboard route (no CLI):** Workers & Pages → Create → Worker → Deploy a static site from Git →
pick the repo. Build command: *(empty)* · Deploy directory: `site`.

**CLI route:**

```bash
npx wrangler@4 deploy      # first run opens a browser to authorise
npx wrangler@4 dev         # local runtime on http://127.0.0.1:8787 before you ship
```

Then **Add a custom domain** → `xartisan.studio` (the zone must be on Cloudflare; the free plan is
enough). The certificate is issued automatically.

Why not Pages: Cloudflare's own Pages docs now say *"Workers supports most Pages use cases … start new
projects with Workers"*, and Pages forces trailing slashes. Pages still works if you prefer it — just
expect `/contact` to 308 to `/contact/`.

## Option B — Netlify

1. Push the repo to GitHub.
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. It reads `netlify.toml`: publish directory `site`, no build command.
4. Add the domain under **Domain management**, enable HTTPS, make `xartisan.studio` the primary domain.

`_redirects`, `_headers` and clean URLs work natively.

## Option C — Vercel (needs Pro for a business site)

Import the repo; `vercel.json` sets `outputDirectory: site`, `cleanUrls`, `trailingSlash: false`, the
90 redirects and the same cache/security headers. Hobby forbids commercial use, so use Pro.
Add the domain under **Settings → Domains**.

## Option D — any static host / S3 / nginx

Publish `site/` as the document root and configure:

- **Directory index resolution** so `/contact` serves `contact/index.html`
- **404 handler** → `site/404.html`, status 404
- **301 rules** from `site/redirects.json` (the JSON form of `_redirects`)
- `Content-Type: image/webp` for `.webp`, `font/woff2` for `.woff2`
- Long cache for `/assets/*`, `/fonts/*`, `/uploads/*`; revalidate HTML

GitHub Pages serves the pages but ignores `_redirects`, so the 90 legacy URLs would 404 — not
recommended without adding redirect stubs.

## Domain status

`xartisan.studio` does not resolve yet — nothing is live. All canonicals, `og:url`, `sitemap.xml` and
`robots.txt` are hard-coded to `https://xartisan.studio`:

- Deploy to that domain, **or**
- If you launch on a different domain, replace the origin across `site/` first and re-run `npm run check`.

Two subdomains are referenced by the site and must exist or the Lab links 404:

- `lab1.xartisan.studio`
- `lab2.xartisan.studio`

## Cache-busting rules (important when editing)

Every deploy that changes a JS/CSS bundle or an image must change the URL that points at it, or
returning visitors keep the cached old file (assets are served `immutable` for a year).

- **Bundles/pages:** bump the token with
  `python3 ~/.hermes/skills/web-development/static-site-content-updates/scripts/rehash_asset_versions.py site`
  (rewrites HTML refs and JS import specifiers to one `?v=` token).
- **Project images:** the URL builder appends `?v=demo3`; bump that string whenever the placeholder
  tiles (or real screenshots) change.
- `npm run check` fails on a stale asset token, so a missed bump is caught before deploy.

## Post-deploy verification

```bash
curl -sI https://xartisan.studio/            | head -5   # 200, text/html
curl -sI https://xartisan.studio/contact     | head -5   # 200, no redirect
curl -sI https://xartisan.studio/contact/    | head -5   # 307/308 → /contact
curl -s  https://xartisan.studio/sitemap.xml | head -3
curl -sI https://xartisan.studio/thiet-ke-website | grep -i location   # 301 → /website-design
curl -sI https://xartisan.studio/nope-404    | head -3   # 404, custom page
curl -sI "https://xartisan.studio/assets/index-DAfw2Y79.js?v=…" | grep -i cache-control  # immutable
```

Then submit `https://xartisan.studio/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Known follow-ups (not deploy blockers)

- `/projects/<slug>` paths still contain the original client slugs (e.g. `vinhomes-saigon-park`) even
  though the pages are anonymised placeholders. Rename them with 301s when the real demos land.
- The project-demo intro copy still reads awkwardly ("40 project? Number 50+").
- `robots.txt` disallows `/api/`, which does not exist — harmless, but it can be dropped.
