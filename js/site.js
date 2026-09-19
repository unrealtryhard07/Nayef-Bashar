/* Site behaviour: language switch, contact details, legal facts, quote form, header state, reveal-on-scroll.
   Shared by index.html, terms.html and privacy.html — every feature checks that its elements exist. */
(function () {
  'use strict';

  const SITE = window.SITE;
  const I18N = window.I18N;
  const LANG_KEY = 'nb-site-lang';
  const SUPPORTED = ['en', 'ar'];
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const HEADER_SCROLL_OFFSET = 24;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const page = document.documentElement.dataset.page || 'home';

  let lang = 'en';
  const t = (key) => (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? key;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const storage = {
    get: () => { try { return localStorage.getItem(LANG_KEY); } catch { return null; } },
    set: (v) => { try { localStorage.setItem(LANG_KEY, v); } catch { /* private mode: language just isn't remembered */ } },
  };

  /* ---------- language ---------- */
  function applyLanguage(next) {
    lang = SUPPORTED.includes(next) ? next : 'en';
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    const pageTitle = root.dataset[lang === 'ar' ? 'titleAr' : 'titleEn'];
    document.title = pageTitle || t(page === 'home' ? 'meta.title' : `meta.title.${page}`);
    const year = String(new Date().getFullYear());

    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n).replace('{year}', year); });
    // Only trusted strings from i18n.js are used here (they contain <span>, <br> and internal links).
    $$('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $$('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
    $('#lang-toggle').setAttribute('aria-label', t('lang.label'));
    fillContacts();
    storage.set(lang);
  }

  /* ---------- contact details ---------- */
  const digits = (value) => String(value).replace(/\D/g, '');
  const whatsappUrl = (text = '') => `https://wa.me/${digits(SITE.whatsapp)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

  function setLink(el, text, href) {
    el.textContent = text;
    el.href = href;
    el.dir = 'ltr';
  }

  function fillContacts() {
    $$('[data-contact="phone"]').forEach((el) => setLink(el, SITE.phone, `tel:${SITE.phone.replace(/[^\d+]/g, '')}`));
    $$('[data-contact="whatsapp"]').forEach((el) => setLink(el, SITE.whatsappDisplay || `+${digits(SITE.whatsapp)}`, whatsappUrl()));
    $$('[data-contact="email"]').forEach((el) => setLink(el, SITE.email, `mailto:${SITE.email}`));
    $$('[data-contact="address"]').forEach((el) => { el.textContent = SITE.address[lang]; });
    $$('[data-contact="hours"]').forEach((el) => { el.textContent = SITE.hours[lang]; });
    $$('[data-contact="map"]').forEach((el) => {
      el.hidden = !SITE.mapUrl;
      if (SITE.mapUrl) el.href = SITE.mapUrl;
    });
    $$('[data-whatsapp]').forEach((a) => { a.href = whatsappUrl(); });
  }

  /* ---------- legal facts (hidden until filled in i18n.js) ---------- */
  function renderFacts() {
    const legal = SITE.legal || {};
    const values = {
      founded: legal.founded,
      cr: legal.crNumber,
      licence: legal.licenceNumber,
      customs: legal.customsLicence,
      memberships: (legal.memberships || []).join(' · '),
    };
    $$('[data-fact]').forEach((el) => {
      const value = String(values[el.dataset.fact] || '').trim();
      el.textContent = value;
      (el.closest('[data-fact-row]') || el).hidden = !value;
    });
  }

  /* ---------- quote form ---------- */
  function buildMessage(data) {
    const services = data.getAll('service').map(t).join(', ');
    const line = (labelKey, value) => (String(value || '').trim() ? `${t(labelKey)}: ${String(value).trim()}` : '');
    return [
      t('form.intro'), '',
      line('form.name', data.get('name')), line('form.company', data.get('company')),
      line('form.phone', data.get('phone')), line('form.email', data.get('email')),
      line('form.service', services), line('form.from', data.get('from')), line('form.to', data.get('to')),
      line('form.cargo', data.get('cargo')),
    ].filter((l, i) => l || i === 1).join('\n');
  }

  function validate(form, data) {
    const required = ['name', 'phone', 'from', 'to'];
    const missing = required.filter((name) => !String(data.get(name) || '').trim());
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    missing.forEach((name) => form.elements[name].setAttribute('aria-invalid', 'true'));
    if (missing.length) {
      form.elements[missing[0]].focus();
      return t('form.required');
    }
    const email = String(data.get('email') || '').trim();
    if (email && !EMAIL_PATTERN.test(email)) {
      form.elements.email.setAttribute('aria-invalid', 'true');
      form.elements.email.focus();
      return t('form.invalidEmail');
    }
    return '';
  }

  function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const errorEl = $('#form-error');
    const error = validate(form, data);
    errorEl.hidden = !error;
    errorEl.textContent = error;
    if (error) return;

    const message = buildMessage(data);
    const via = e.submitter && e.submitter.dataset.send === 'email' ? 'email' : 'whatsapp';
    if (via === 'email') {
      window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(`${t('form.subject')} — ${data.get('name')}`)}&body=${encodeURIComponent(message)}`;
    } else {
      window.open(whatsappUrl(message), '_blank', 'noopener');
    }
  }

  /* ---------- header, menu, motion ---------- */
  function bindHeader() {
    const header = $('.nav');
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > HEADER_SCROLL_OFFSET);
    update();
    window.addEventListener('scroll', update, { passive: true });

    const toggle = $('#menu-toggle');
    const nav = $('#nav-links');
    if (!toggle || !nav) return;
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  function bindReveal() {
    const items = $$('.reveal');
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((el) => observer.observe(el));
  }

  // Tile links preselect the matching service in the quote form.
  function bindServiceLinks() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-service]');
      if (!link) return;
      const box = $(`#quote-form input[name="service"][value="${link.dataset.service}"]`);
      if (box) box.checked = true;
    });
  }

  // Service pages link to index.html?service=<key>#quote; tick that service in the form.
  const SERVICE_KEYS = ['ocean', 'air', 'land', 'customs', 'trade', 'supply', 'freehand'];
  function preselectService() {
    const key = new URLSearchParams(window.location.search).get('service');
    if (!SERVICE_KEYS.includes(key)) return;
    const box = $(`#quote-form input[name="service"][value="svc.${key}.title"]`);
    if (box) box.checked = true;
  }

  function init() {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    const browserLang = (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
    applyLanguage(urlLang || storage.get() || browserLang);
    renderFacts();
    $('#lang-toggle').addEventListener('click', () => applyLanguage(lang === 'ar' ? 'en' : 'ar'));
    const form = $('#quote-form');
    if (form) form.addEventListener('submit', onSubmit);
    preselectService();
    bindHeader();
    bindReveal();
    bindServiceLinks();
    const globe = $('#globe');
    if (globe && window.NB_GLOBE) window.NB_GLOBE.mount(globe, { reducedMotion: reducedMotion.matches });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
