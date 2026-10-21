# Xartisan Studio website

Marketing site for **Xartisan Studio**, a web design, development and website operations studio.
It presents the studio's services, selected work, pricing, capability profile and contact
details across 90 content pages plus site search.

- Website: https://xartisan.studio
- Email: hello@xartisan.studio
- WhatsApp: +61 435 878 929

## Stack

Static HTML documents with prebuilt React bundles, CSS, fonts, images and video. There is no runtime
build step. `server/serve.mjs` is a zero-dependency Node static server that adds clean URLs, legacy
redirects, SPA fallbacks and a styled 404 page.

## Run

```bash
npm run serve
```

Open http://127.0.0.1:8788. No install is required.

## Structure

```
site/                  Deployable website. This directory is the public root.
site/redirects.json    Legacy URL to English URL redirect map.
site/_redirects        The same map in Netlify/Cloudflare Pages format.
server/serve.mjs       Local static server and URL behavior.
tools/brand/assets/    Logo lockups, favicons, app icons, OG card and WhatsApp icon.
tools/brand/           Scripts and source files used to produce the brand assets.
docs/BRAND.md          Brand system, palette, typography and asset inventory.
```

## Editing

`site/` is the live tree. Add a page by creating `site/<slug>/index.html`; clean URLs resolve
without a server change. Shared assets live in `site/assets/`, `site/fonts/` and `site/uploads/`.
What is on disk is what is served.

## Routes

Public sections use English URLs:

`/website-design`, `/business-website-design`, `/ecommerce-website-design`,
`/landing-page-design`, `/web-app-development`, `/seo-services`, `/website-design-pricing`,
`/website-design-process`, `/website-maintenance`, `/about`, `/capabilities`,
`/contact`, `/projects`, `/blog`, `/search`.

Project and article slugs are English too. Legacy Vietnamese URLs return a 301 to the matching
English page. The map lives in `site/redirects.json`; `site/_redirects` contains the same rules for
hosts that support Netlify-style redirects.

## Deploy

Publish the contents of `site/` to any static host. Point the host's 404 response at
`site/404/index.html` and keep directory index resolution enabled so clean URLs continue to work.
Load `site/_redirects` if the host supports Netlify-style redirects, or translate
`site/redirects.json` into the host's redirect configuration. The local Node server is for preview
only; it is not required in production.

## Brand

| Field | Value |
| --- | --- |
| Name | Xartisan Studio |
| Domain | xartisan.studio |
| Email | hello@xartisan.studio |
| WhatsApp | 0435 878 929 (`+61 435 878 929`) |
| Palette | Navy and cyan |
| Theme | Light by default; navy dark mode |
| Logo | Bold cyan X with outlined navy right stroke and sans wordmark |

See [docs/BRAND.md](docs/BRAND.md) for the full system.
