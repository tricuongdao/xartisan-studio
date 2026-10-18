# Xartisan Studio website

Marketing site for **Xartisan Studio**, a web design, development and website operations studio.
It presents the studio's services, selected work, pricing, capability profile, careers and contact
details across 91 content pages plus site search.

- Website: https://xartisan.studio
- Email: hello@xartisan.studio
- WhatsApp: +61 435 878 929

## Stack

Static HTML documents with prebuilt React bundles, CSS, fonts, images and video. There is no runtime
build step. `server/serve.mjs` is a zero-dependency Node static server that adds clean URLs, the
`/dich-vu` alias, SPA fallbacks and a styled 404 page.

## Run

```bash
npm run serve
```

Open http://127.0.0.1:8788. No install is required.

## Structure

```
site/                  Deployable website. This directory is the public root.
server/serve.mjs       Local static server and URL behavior.
tools/brand/assets/    Logo lockups, favicons, app icons, OG card and WhatsApp icon.
tools/brand/           Scripts and source files used to produce the brand assets.
docs/BRAND.md          Brand system, palette, typography and asset inventory.
```

## Editing

`site/` is the live tree. Add a page by creating `site/<slug>/index.html`; clean URLs resolve
without a server change. Shared assets live in `site/assets/`, `site/fonts/` and `site/uploads/`.
What is on disk is what is served.

## Deploy

Publish the contents of `site/` to any static host. Point the host's 404 response at
`site/404/index.html` and keep directory index resolution enabled so clean URLs continue to work.
The local Node server is for preview only; it is not required in production.

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
