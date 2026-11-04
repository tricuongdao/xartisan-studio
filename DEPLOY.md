# Deploying Xartisan Studio

The repository ships a **prebuilt static site**. There is no build step: the contents of `site/` are
the artifact. Publish that directory and the site is live.

```
site/                 → public root (publish this)
site/_redirects       → 90 legacy Vietnamese URLs → English 301s
site/_headers         → security + cache headers (Netlify / Cloudflare Pages)
site/404.html         → 404 response (copy of site/404/index.html)
netlify.toml          → Netlify config (publish dir)
vercel.json           → Vercel config (redirects converted, clean URLs)
```

Before every deploy:

```bash
npm run check     # 93 pages · internal links · canonicals · sitemap · stale tokens
npm run serve     # preview at http://127.0.0.1:8788
```

## Option A — Netlify (recommended)

1. Push this repo to GitHub (already at `tricuongdao/xartisan-studio`).
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Settings it reads automatically from `netlify.toml`:
   - **Publish directory:** `site`
   - **Build command:** none (leave empty)
4. Deploy. First build is instant; you get a `*.netlify.app` URL.
5. **Domain management → Add domain** → `xartisan.studio`, then follow the DNS instructions
   (Netlify DNS nameservers, or an `A` record to the load balancer + `CNAME www → <site>.netlify.app`).
6. Enable **HTTPS** (Let's Encrypt, automatic once DNS resolves).
7. Set the primary domain to `https://xartisan.studio` and let `www` redirect to it.

Clean URLs (`/contact` → `site/contact/index.html`), `_redirects` and `_headers` all work natively.

## Option B — Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
2. Build command: *(empty)* · Build output directory: `site`.
3. Deploy, then **Custom domains → Set up a domain** → `xartisan.studio`.
4. In **Settings → Build → Build cache / trailing slash**, keep "remove trailing slash" if offered, so
   `/contact` matches the canonical URLs (which omit the trailing slash).

`_headers` and `_redirects` are supported. `404.html` is used automatically.

## Option C — Vercel

Import the repo; `vercel.json` sets `outputDirectory: site`, `cleanUrls`, `trailingSlash: false`,
the 90 redirects and the same cache/security headers. Add the domain under
**Settings → Domains**.

## Option D — any static host / S3 / nginx

Publish `site/` as the document root and configure:

- **Directory index resolution** so `/contact` serves `contact/index.html`
- **404 handler** → `site/404.html`, status 404
- **301 rules** from `site/redirects.json` (the JSON form of `_redirects`)
- `Content-Type: image/webp` for `.webp`, `font/woff2` for `.woff2`
- Long cache for `/assets/*`, `/fonts/*`, `/uploads/*`; `no-cache` for HTML

## Domain status

`xartisan.studio` does not resolve yet — nothing is live. Until DNS points at the host, the site is
only reachable on the host's preview URL (`*.netlify.app` etc.). All canonicals, `og:url` values,
`sitemap.xml` and `robots.txt` are hard-coded to `https://xartisan.studio`, so:

- Deploy to the real domain when you can, or
- If you launch on a different domain, replace `https://xartisan.studio` across `site/` first
  (`grep -rl` then a scripted replace), and re-run `npm run check`.

Two subdomains are referenced by the site and must exist or the Lab links will 404:

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
curl -sI https://xartisan.studio/contact     | head -5   # 200 (or 301 → 200)
curl -s  https://xartisan.studio/sitemap.xml | head -3
curl -sI https://xartisan.studio/thiet-ke-website | grep -i location   # 301 → /website-design
curl -sI https://xartisan.studio/nope-404    | head -3   # 404, custom page
curl -sI https://xartisan.studio/assets/index-DAfw2Y79.js?v=… | grep -i cache-control  # immutable
```

Then: submit `https://xartisan.studio/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Known follow-ups (not deploy blockers)

- `/projects/<slug>` paths still contain the original client slugs (e.g. `vinhomes-saigon-park`) even
  though the pages are anonymised placeholders. Rename them with 301s when the real demos land.
- The project-demo intro copy still reads awkwardly ("40 project? Number 50+").
- `robots.txt` disallows `/api/`, which does not exist — harmless, but it can be dropped.
