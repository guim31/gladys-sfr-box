// Every text shown to a user exists in English, French, German and Spanish:
// the texts of the container (src/i18n.js) and those of the manifest. German
// says "du", Spanish says "usted" (project rule, CLAUDE.md).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES, TEXTS, t, tAll, resolveLanguage } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

// Formal German ("Sie", "Ihr", "Ihnen"…): the project addresses the user as "du".
const FORMAL_GERMAN = /\b(Sie|Ihnen|Ihr|Ihre|Ihrem|Ihren|Ihrer|Ihres)\b/;
// Informal Spanish: the project addresses the user as "usted".
const INFORMAL_SPANISH = /\b(tú|tu|tus|te|ti|contigo)\b/i;

// Maximum lengths, from where each text is displayed.
const LIMITS = [
  [/^feature_/, 40], // feature names
  [/^status_/, 200], // connection status messages
  [/^widget_(download|upload|uptime|temperature|reboot)$/, 24], // tile labels, button
  [/^(widget_|value_|box_unreachable)/, 40], // status rows
  [/^duration_/, 12], // checked with real values in test/widgets.test.js
  [/./, 300], // action messages
];

function checkText(where, language, text) {
  assert.equal(typeof text, 'string', `${where}.${language} must be a string`);
  assert.ok(text.trim().length > 0, `${where}.${language} is empty`);
  if (language === 'de') {
    assert.doesNotMatch(text, FORMAL_GERMAN, `${where}.de uses the formal "Sie"`);
  }
  if (language === 'es') {
    assert.doesNotMatch(text, INFORMAL_SPANISH, `${where}.es must use "usted"`);
  }
}

test('every text of the container exists in the four languages', () => {
  for (const [key, entry] of Object.entries(TEXTS)) {
    assert.deepEqual(Object.keys(entry).sort(), [...LANGUAGES].sort(), `${key}: languages`);
    for (const language of LANGUAGES) {
      checkText(key, language, entry[language]);
    }
  }
});

test('every text fits where it is displayed', () => {
  for (const [key, entry] of Object.entries(TEXTS)) {
    const [, limit] = LIMITS.find(([pattern]) => pattern.test(key));
    for (const language of LANGUAGES) {
      const length = entry[language].replace(/\{\w+\}/g, '').length;
      assert.ok(length <= limit, `${key}.${language}: ${length} characters, ${limit} allowed`);
    }
  }
});

test('the placeholders are the same in every language', () => {
  for (const [key, entry] of Object.entries(TEXTS)) {
    const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const language of LANGUAGES) {
      assert.deepEqual(placeholders(entry[language]), placeholders(entry.en), `${key}.${language}`);
    }
  }
});

test('t falls back to English and fills the placeholders', () => {
  assert.equal(resolveLanguage('fr-FR'), 'fr');
  assert.equal(resolveLanguage('it'), 'en');
  assert.equal(resolveLanguage(undefined), 'en');
  assert.equal(t('test_hosts', 'de', { count: 3 }), 'Geräte im Netzwerk: 3.');
  assert.deepEqual(Object.keys(tAll('feature_wan')), LANGUAGES);
  assert.equal(
    tAll('test_connected', { internet: (language) => t('value_connected', language) }).es.includes(
      'Internet: Conectada',
    ),
    true,
  );
  assert.throws(() => t('no_such_text', 'en'), /Unknown text/);
});

// Every multi-language object of the manifest: label, description, placeholder…
function manifestTexts(node, path = 'manifest') {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => manifestTexts(item, `${path}[${index}]`));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    ['label', 'description', 'placeholder'].includes(key) && value && typeof value === 'object'
      ? [{ where: `${path}.${key}`, value }]
      : manifestTexts(value, `${path}.${key}`),
  );
}

test('every text of the manifest exists in the four languages', () => {
  const texts = manifestTexts(manifest);
  assert.ok(texts.length > 30);
  for (const { where, value } of texts) {
    assert.deepEqual(Object.keys(value).sort(), [...LANGUAGES].sort(), `${where}: languages`);
    for (const language of LANGUAGES) {
      checkText(where, language, value[language]);
    }
  }
});

test('the manifest name is short and the same in every language', () => {
  assert.equal(typeof manifest.name, 'string');
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
});

test('the formal-German and informal-Spanish checks do catch them', () => {
  assert.match('Prüfen Sie die Adresse', FORMAL_GERMAN);
  assert.match('Ihr Passwort', FORMAL_GERMAN);
  assert.doesNotMatch('Prüfe die Adresse in deiner Box', FORMAL_GERMAN);
  assert.match('Compruebe tu dirección', INFORMAL_SPANISH);
  assert.doesNotMatch('Compruebe su dirección', INFORMAL_SPANISH);
});
