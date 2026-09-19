# Service pages — design

Date: 2026-09-18 · Site: `~/nb-website` (static HTML/CSS/JS, EN/AR, no build step until now)

## Goal

One page per service (6 total) that explains the service in English and Arabic, is fully readable by
search engines without JavaScript, and funnels visitors into the existing quote form with the service
pre-selected. Content is general and accurate — no company-specific claims (no invented lanes,
carriers, transit times, stats or testimonials).

## Approach

A dependency-free Node generator renders six static pages from one template and one content file.
Generated pages are saved in the folder, so the site works without running anything; the script is
only re-run after editing service content.

## Files

| File | Purpose |
|---|---|
| `scripts/services-content.js` | Content data: one entry per service, with `en` and `ar` blocks. The only file edited to change service text. |
| `scripts/build-services.js` | Reads the content, renders the template, writes `services/*.html`. Validates content before writing (see Error handling). |
| `services/<slug>.html` ×6 | Generated output. Starts with a "GENERATED — do not edit" comment. |
| `index.html` | Service tiles gain a "Learn more" link; footer service links point to the new pages. |
| `js/site.js` | Two small additions: per-page titles from `data-title-en/ar`, and `?service=<key>` pre-selects the quote checkbox. |
| `js/i18n.js` | New shared strings (`svc.more`, section headings used by the template). |
| `css/site.css` | Service-page styles, reusing existing tokens and components (kicker, headline, steps, faq-list, pill). |
| `sitemap.xml` | Six new URLs. |

## Services and URLs

| Key | Slug / URL | Title (EN) |
|---|---|---|
| `ocean` | `services/ocean-freight.html` | Ocean Freight |
| `air` | `services/air-freight.html` | Air Freight |
| `land` | `services/land-freight.html` | Land Freight |
| `customs` | `services/customs-clearance.html` | Customs Clearance |
| `trade` | `services/import-export.html` | Import & Export |
| `supply` | `services/supply-chain.html` | Supply Chain Management |

`key` matches the existing i18n keys (`svc.<key>.title`) and the quote form checkbox values.

## Content shape (per service, per language)

```js
{
  key: 'ocean', slug: 'ocean-freight', related: ['air', 'customs'],
  en: {
    title, kicker, lead,            // hero
    metaDescription,                // <meta name="description">
    included: [{ title, body }],    // "What's included" — 4–6 items
    steps: [{ title, body }],       // "How it works" — exactly 4
    documents: [string],            // "Documents you'll need"
    faqs: [{ q, a }],               // 3–4
  },
  ar: { /* same shape */ },
}
```

## Page layout (top to bottom)

1. Shared header (same as legal pages; links go to `../index.html#…`).
2. Hero: kicker, service title, lead, "Get a quote" pill → `../index.html?service=<key>#quote`.
3. What's included — grid of cards.
4. How it works — the existing 4-step component.
5. Documents you'll need — checklist.
6. FAQ — the existing `details` accordion.
7. Related services — links to 2 other service pages.
8. Shared footer; floating WhatsApp button.

EN and AR content are both in the HTML as `<article lang="en">` / `<article lang="ar" dir="rtl">`,
shown by `html[lang]` exactly like the legal pages. Header/footer chrome uses `data-i18n` as today.
All asset/script paths in generated pages are prefixed `../`.

## Behaviour changes in `site.js`

- **Title:** if `<html>` has `data-title-en`/`data-title-ar`, use it for `document.title`; otherwise the
  current `meta.title[.page]` lookup.
- **Pre-select:** on the home page, `?service=<key>` checks `input[name=service][value="svc.<key>.title"]`.
  Only the six known keys are accepted; anything else is ignored.

## Error handling (generator)

The script fails with a clear message and writes nothing if: a service is missing a required field in
either language, `steps` is not exactly 4, a `related` key doesn't exist, or two services share a slug.
All content is HTML-escaped in the template; no raw HTML is accepted from the content file.

## Testing

- Generator: run it; confirm six files are written and that invalid content (e.g. a removed field)
  aborts without writing.
- Headless Chrome under the production CSP (same harness as the legal pages), all six pages × EN/AR:
  no JS errors, no CSP violations, no horizontal overflow, correct title per language, exactly one
  visible article.
- Home page with `?service=customs`: the Customs Clearance checkbox is checked.
- Visual: screenshot one service page in each language.

## Out of scope

Company-specific facts, a separate `/ar/` URL tree, and deployment.
