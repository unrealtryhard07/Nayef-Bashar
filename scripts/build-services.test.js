/* Run: node --test scripts/build-services.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, renderPage, escapeHtml } = require('./build-services');
const { LABELS, SERVICES } = require('./services-content');

const clone = (v) => JSON.parse(JSON.stringify(v));

test('real service content passes validation', () => {
  assert.deepEqual(validate(SERVICES), []);
});

test('reports a missing field in one language', () => {
  const services = clone(SERVICES);
  delete services[0].ar.lead;
  assert.deepEqual(validate(services), ['ocean.ar.lead: required']);
});

test('requires exactly four steps', () => {
  const services = clone(SERVICES);
  services[1].en.steps.pop();
  assert.deepEqual(validate(services), ['air.en.steps: must have exactly 4 items']);
});

test('rejects unknown and self related keys', () => {
  const services = clone(SERVICES);
  services[2].related = ['nope', 'land'];
  assert.deepEqual(validate(services), [
    'land.related: unknown or self key "nope"',
    'land.related: unknown or self key "land"',
  ]);
});

test('rejects duplicate slugs', () => {
  const services = clone(SERVICES);
  services[3].slug = services[0].slug;
  assert.deepEqual(validate(services), ['customs: duplicate slug "ocean-freight"']);
});

test('escapes HTML in content', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  const services = clone(SERVICES);
  services[0].en.lead = '<script>alert(1)</script>';
  const html = renderPage(services[0], services, LABELS);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('page links the quote button to the preselected service and both languages exist', () => {
  const html = renderPage(SERVICES[3], SERVICES, LABELS);
  assert.ok(html.includes('href="../index.html?service=customs#quote"'));
  assert.ok(html.includes('<article class="lang-block" lang="en"'));
  assert.ok(html.includes('<article class="lang-block" lang="ar" dir="rtl"'));
  assert.ok(html.includes('<link rel="canonical" href="https://nayefbashar.com/services/customs-clearance.html">'));
});
