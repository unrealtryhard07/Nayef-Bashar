/* Run: node --test scripts/site-services.test.js
   Every service in services-content.js must be wired into the homepage and sitemap. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SERVICES } = require('./services-content');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const index = read('index.html');
const sitemap = read('sitemap.xml');
const siteJs = read('js/site.js');
const preselectKeys = JSON.parse((siteJs.match(/const SERVICE_KEYS = (\[[^\]]*\]);/) || [])[1].replace(/'/g, '"'));

test('freehand shipments is a defined service', () => {
  const freehand = SERVICES.find((s) => s.key === 'freehand');
  assert.ok(freehand, 'missing freehand service');
  assert.equal(freehand.slug, 'freehand-shipments');
});

for (const s of SERVICES) {
  test(`${s.key}: homepage tile, quote checkbox, footer link and sitemap entry`, () => {
    assert.match(index, new RegExp(`class="link-arrow[^"]*" href="services/${s.slug}\\.html"`), 'tile "Learn more" link');
    assert.ok(index.includes(`data-service="svc.${s.key}.title"`), 'tile quote link');
    assert.ok(index.includes(`<input type="checkbox" name="service" value="svc.${s.key}.title">`), 'quote form checkbox');
    assert.ok(index.includes(`<a href="services/${s.slug}.html" data-i18n="svc.${s.key}.title">`), 'footer link');
    assert.ok(sitemap.includes(`<loc>https://nayefbashar.com/services/${s.slug}.html</loc>`), 'sitemap entry');
    assert.ok(preselectKeys.includes(s.key), 'js/site.js SERVICE_KEYS (quote preselect from service pages)');
  });
}
