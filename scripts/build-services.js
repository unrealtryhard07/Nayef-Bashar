#!/usr/bin/env node
/* Generates services/<slug>.html from scripts/services-content.js.
   Usage: node scripts/build-services.js
   Writes nothing if the content fails validation. */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'services');
const SITE_URL = 'https://nayefbashar.com';
const LANGS = ['en', 'ar'];
const STEP_COUNT = 4;
const TEXT_FIELDS = ['title', 'kicker', 'lead', 'metaDescription'];
const LIST_FIELDS = ['included', 'steps', 'documents', 'faqs'];

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ---------- validation ---------- */
function validateLang(service, lang) {
  const block = service[lang];
  const where = `${service.key || '?'}.${lang}`;
  if (!block) return [`${where}: missing language block`];
  const errors = [];
  TEXT_FIELDS.filter((f) => !String(block[f] || '').trim()).forEach((f) => errors.push(`${where}.${f}: required`));
  LIST_FIELDS.filter((f) => !Array.isArray(block[f]) || block[f].length === 0).forEach((f) => errors.push(`${where}.${f}: must be a non-empty list`));
  if (Array.isArray(block.steps) && block.steps.length !== STEP_COUNT) errors.push(`${where}.steps: must have exactly ${STEP_COUNT} items`);
  return errors;
}

function validate(services) {
  const errors = [];
  const keys = new Set(services.map((s) => s.key));
  const slugs = new Set();
  services.forEach((s) => {
    if (!s.key || !s.slug) errors.push(`service ${JSON.stringify(s.key)}: key and slug are required`);
    if (slugs.has(s.slug)) errors.push(`${s.key}: duplicate slug "${s.slug}"`);
    slugs.add(s.slug);
    (s.related || []).filter((k) => !keys.has(k) || k === s.key).forEach((k) => errors.push(`${s.key}.related: unknown or self key "${k}"`));
    LANGS.forEach((lang) => errors.push(...validateLang(s, lang)));
  });
  return errors;
}

/* ---------- rendering ---------- */
const e = escapeHtml;
const byKey = (services, key) => services.find((s) => s.key === key);

function renderArticle(service, services, lang, labels) {
  const c = service[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const included = c.included.map((i) => `<li class="svc-card"><h3>${e(i.title)}</h3><p>${e(i.body)}</p></li>`).join('\n            ');
  const steps = c.steps.map((s, i) => `<li class="step"><span class="step-num">0${i + 1}</span><h3>${e(s.title)}</h3><p>${e(s.body)}</p></li>`).join('\n            ');
  const docs = c.documents.map((d) => `<li>${e(d)}</li>`).join('\n            ');
  const faqs = c.faqs.map((f) => `<details><summary>${e(f.q)}</summary><p>${e(f.a)}</p></details>`).join('\n            ');
  const related = service.related.map((k) => {
    const r = byKey(services, k);
    return `<li><a class="svc-related-link" href="${e(r.slug)}.html"><span class="kicker">${e(r[lang].kicker)}</span><strong>${e(r[lang].title)}</strong></a></li>`;
  }).join('\n            ');

  return `<article class="lang-block" lang="${lang}" dir="${dir}" aria-labelledby="title-${lang}">
      <section class="svc-hero">
        <div class="container">
          <p class="kicker kicker--hero">${e(c.kicker)}</p>
          <h1 id="title-${lang}" class="display">${e(c.title)}</h1>
          <p class="hero-lead">${e(c.lead)}</p>
          <a class="pill" href="../index.html?service=${e(service.key)}#quote">${e(labels.quote)}</a>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <h2 class="headline svc-h2">${e(labels.included)}</h2>
          <ul class="svc-cards" role="list">
            ${included}
          </ul>
        </div>
      </section>
      <section class="section section--gray">
        <div class="container">
          <h2 class="headline svc-h2">${e(labels.steps)}</h2>
          <ol class="steps" role="list">
            ${steps}
          </ol>
        </div>
      </section>
      <section class="section">
        <div class="container svc-split">
          <div>
            <h2 class="headline svc-h2">${e(labels.documents)}</h2>
            <p class="subhead">${e(labels.documentsNote)}</p>
          </div>
          <ul class="svc-docs" role="list">
            ${docs}
          </ul>
        </div>
      </section>
      <section class="section section--gray">
        <div class="container">
          <h2 class="headline svc-h2">${e(labels.faq)}</h2>
          <div class="faq-list">
            ${faqs}
          </div>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <h2 class="headline svc-h2">${e(labels.related)}</h2>
          <ul class="svc-related" role="list">
            ${related}
            <li><a class="svc-related-link svc-related-link--all" href="../index.html#services"><strong>${e(labels.back)}</strong></a></li>
          </ul>
        </div>
      </section>
    </article>`;
}

function renderFooterServices(services) {
  return services.map((s) => `<a href="${e(s.slug)}.html" data-i18n="svc.${e(s.key)}.title">${e(s.en.title)}</a>`).join('');
}

function renderPage(service, services, labels) {
  const url = `${SITE_URL}/services/${service.slug}.html`;
  return `<!doctype html>
<!-- GENERATED by scripts/build-services.js — do not edit. Change scripts/services-content.js and re-run the script. -->
<html lang="en" dir="ltr" data-page="service" data-title-en="${e(service.en.title)} — Nayef Bashar Trading Est." data-title-ar="${e(service.ar.title)} — مؤسسة نايف بشر تجارية">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${e(service.en.title)} — Nayef Bashar Trading Est.</title>
  <meta name="description" content="${e(service.en.metaDescription)}">
  <meta name="theme-color" content="#000000">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="Nayef Bashar Trading Est.">
  <meta property="og:title" content="${e(service.en.title)} — Nayef Bashar Trading Est.">
  <meta property="og:description" content="${e(service.en.metaDescription)}">
  <meta property="og:image" content="${SITE_URL}/assets/logo.png">
  <meta name="twitter:card" content="summary">
  <link rel="icon" type="image/png" href="../assets/favicon.png">
  <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
  <link rel="stylesheet" href="../css/fonts.css">
  <link rel="stylesheet" href="../css/site.css">
</head>
<body>
  <a class="skip-link" href="#main" data-i18n="skip">Skip to content</a>

  <header class="nav" id="top">
    <div class="nav-inner">
      <a class="nav-brand" href="../index.html" aria-label="Nayef Bashar Trading Est. — home">
        <img src="../assets/apple-touch-icon.png" alt="" width="28" height="28">
        <span data-i18n="brand">Nayef Bashar</span>
      </a>
      <nav class="nav-links" id="nav-links" aria-label="Main navigation">
        <a href="../index.html" data-i18n="legal.home">Home</a>
        <a href="../index.html#services" data-i18n="nav.services">Services</a>
        <a href="../index.html#about" data-i18n="nav.about">About</a>
        <a href="../index.html#contact" data-i18n="nav.contact">Contact</a>
      </nav>
      <div class="nav-actions">
        <button type="button" class="nav-lang" id="lang-toggle"><span data-i18n="lang.switch">العربية</span></button>
        <a class="pill pill--sm" href="../index.html?service=${e(service.key)}#quote" data-i18n="nav.quote">Get a quote</a>
        <button type="button" class="nav-menu" id="menu-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Menu"><span></span><span></span></button>
      </div>
    </div>
  </header>

  <main id="main">
    ${LANGS.map((lang) => renderArticle(service, services, lang, labels[lang])).join('\n\n    ')}
  </main>

  <a class="wa-float" href="#" data-whatsapp target="_blank" rel="noopener" data-i18n-label="wa.float" aria-label="Chat with us on WhatsApp">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2z"/></svg>
  </a>

  <footer class="footer">
    <div class="container">
      <div class="footer-top">
        <img class="footer-logo" src="../assets/logo.webp" alt="Nayef Bashar Trading Est." width="566" height="388" loading="lazy">
        <nav class="footer-nav" aria-label="Footer">
          <div><h3 data-i18n="footer.services">Services</h3>
            ${renderFooterServices(services)}
          </div>
          <div><h3 data-i18n="footer.company">Company</h3>
            <a href="../index.html#about" data-i18n="nav.about">About</a><a href="../index.html#faq" data-i18n="nav.faq">FAQ</a>
            <a href="../index.html#quote" data-i18n="nav.quote">Get a quote</a><a href="../index.html#contact" data-i18n="nav.contact">Contact</a>
          </div>
          <div><h3 data-i18n="footer.legal">Legal</h3>
            <a href="../terms.html" data-i18n="footer.terms">Terms of Service</a><a href="../privacy.html" data-i18n="footer.privacy">Privacy Notice</a>
          </div>
        </nav>
      </div>
      <p class="footer-legal">
        <span data-i18n="footer.copy">Copyright © Nayef Bashar Trading Est. All rights reserved.</span>
        <span class="footer-ids"><span data-fact-row hidden><span data-i18n="footer.cr">CR No.</span> <span data-fact="cr" dir="ltr"></span></span><span class="footer-ar" lang="ar" dir="rtl">مؤسسة نايف بشر تجارية</span></span>
      </p>
    </div>
  </footer>

  <script src="../js/i18n.js"></script>
  <script src="../js/site.js"></script>
</body>
</html>
`;
}

/* ---------- CLI ---------- */
function main() {
  const { LABELS, SERVICES } = require('./services-content');
  const errors = validate(SERVICES);
  if (errors.length) {
    process.stderr.write(`Service content is invalid — nothing was written:\n  ${errors.join('\n  ')}\n`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  SERVICES.forEach((s) => {
    fs.writeFileSync(path.join(OUT_DIR, `${s.slug}.html`), renderPage(s, SERVICES, LABELS));
    process.stdout.write(`wrote services/${s.slug}.html\n`);
  });
}

if (require.main === module) main();

module.exports = { validate, renderPage, escapeHtml };
