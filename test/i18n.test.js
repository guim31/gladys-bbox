// -----------------------------------------------------------------------------
// Every text a user sees exists in English, French, German and Spanish, is not
// empty, fits where Gladys shows it, and keeps the chosen register: German
// says "du", Spanish says "usted".
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES, TEXTS } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

// Every multi-language object of the manifest, with its path.
function manifestTexts(node, path = 'manifest', found = []) {
  if (Array.isArray(node)) {
    node.forEach((child, index) => manifestTexts(child, `${path}[${index}]`, found));
  } else if (node && typeof node === 'object') {
    if (typeof node.en === 'string') {
      found.push({ path, text: node });
      return found;
    }
    for (const [key, child] of Object.entries(node)) {
      manifestTexts(child, `${path}.${key}`, found);
    }
  }
  return found;
}

// Every multi-language entry of src/i18n.js, with its path.
function codeTexts() {
  return Object.entries(TEXTS).flatMap(([group, entries]) =>
    Object.entries(entries).map(([key, text]) => ({ path: `TEXTS.${group}.${key}`, text })),
  );
}

const allTexts = [...manifestTexts(manifest), ...codeTexts()];

test('the manifest and the code carry user texts', () => {
  assert.ok(manifestTexts(manifest).length > 20);
  assert.ok(codeTexts().length > 20);
});

test('every text exists in the four languages, never empty', () => {
  for (const { path, text } of allTexts) {
    for (const language of LANGUAGES) {
      assert.equal(typeof text[language], 'string', `${path}.${language} is missing`);
      assert.ok(text[language].trim().length > 0, `${path}.${language} is empty`);
    }
    for (const language of Object.keys(text)) {
      assert.ok(LANGUAGES.includes(language), `${path}: unexpected language "${language}"`);
    }
  }
});

test('German says "du", never the formal "Sie"', () => {
  const formal = /\b(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres|Ihnen)\b/;
  for (const { path, text } of allTexts) {
    assert.doesNotMatch(text.de, formal, `${path}.de uses the formal address: "${text.de}"`);
  }
});

test('Spanish says "usted", never "tú"', () => {
  const familiar = /\b(tú|tu|tus|ti|contigo)\b/i;
  for (const { path, text } of allTexts) {
    assert.doesNotMatch(text.es, familiar, `${path}.es uses the familiar address: "${text.es}"`);
  }
});

test('the placeholders of a text are the same in every language', () => {
  const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const { path, text } of codeTexts()) {
    for (const language of LANGUAGES) {
      assert.deepEqual(placeholders(text[language]), placeholders(text.en), `${path}.${language}`);
    }
  }
});

function assertMaxLength(entries, max, what) {
  for (const [path, text] of entries) {
    for (const language of LANGUAGES) {
      assert.ok(
        text[language].length <= max,
        `${path}.${language}: ${text[language].length} characters, ${max} allowed for ${what}`,
      );
    }
  }
}

test('texts fit where Gladys shows them', () => {
  // Catalog card (store rule) and widget picker.
  assertMaxLength([['description', manifest.description]], 100, 'the catalog description');
  for (const widget of manifest.widgets) {
    assertMaxLength([[`widgets.${widget.key}.description`, widget.description]], 100, 'a widget');
    for (const language of LANGUAGES) {
      assert.ok(widget.label[language].length >= 3 && widget.label[language].length <= 30);
    }
  }
  const widget = TEXTS.widget;
  // Widget vocabulary: button 24, value tile label 24, status label 40,
  // caption text 80.
  assertMaxLength(
    [
      ['guest_on', widget.guest_on],
      ['guest_off', widget.guest_off],
      ['download', widget.download],
      ['upload', widget.upload],
      ['devices', widget.devices],
    ],
    24,
    'a button or a tile',
  );
  assertMaxLength(
    ['internet', 'line', 'ipv4', 'wifi_24', 'wifi_5', 'wifi_guest', 'missed_calls', 'uptime'].map(
      (key) => [key, widget[key]],
    ),
    40,
    'a status row',
  );
  assertMaxLength(
    [
      ['waiting', widget.waiting],
      ['unreachable', widget.unreachable],
    ],
    80,
    'a caption',
  );
  // Action results are shown as a toast truncated at 200 characters; the
  // connection status the same way.
  assertMaxLength(Object.entries(TEXTS.action), 160, 'an action result');
  assertMaxLength(Object.entries(TEXTS.status), 200, 'a connection status');
  // The status values (on/off...) are 40 characters at most.
  assertMaxLength(Object.entries(TEXTS.word), 40, 'a status value');
});

test('the integration name is the same in every language', () => {
  assert.equal(typeof manifest.name, 'string');
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
});
