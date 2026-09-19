/* Run: node --test scripts/i18n.test.js
   Every data-i18n* key used in any page must exist in both languages. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KEY_ATTR = /data-i18n(?:-html|-placeholder|-label)?="([^"]+)"/g;

global.window = {};
require('../js/i18n.js');
const { en, ar } = global.window.I18N;

const pages = ['index.html', 'terms.html', 'privacy.html',
  ...fs.readdirSync(path.join(ROOT, 'services')).map((f) => `services/${f}`)];

test('both languages define the same keys', () => {
  assert.deepEqual(Object.keys(en).filter((k) => !(k in ar)), []);
  assert.deepEqual(Object.keys(ar).filter((k) => !(k in en)), []);
});

for (const page of pages) {
  test(`${page}: every translation key exists`, () => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const keys = [...new Set([...html.matchAll(KEY_ATTR)].map((m) => m[1]))];
    assert.deepEqual(keys.filter((k) => !(k in en) || !(k in ar)), []);
  });
}
