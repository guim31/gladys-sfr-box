// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createActions } from '../src/actions.js';
import { createSceneActions } from '../src/scenes.js';
import { createWidgets } from '../src/widgets.js';
import { SCENE_TRIGGERS } from '../src/monitor.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const handlers = { monitor: {}, getConfig: () => DEFAULT_CONFIG };
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

// Every list of form fields the manifest declares (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

function isAtLeast(version, required) {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
}

test('identity: name, network category, local transport, image of the repository', () => {
  assert.equal(manifest.name, 'SFR Box');
  assert.equal(manifest.type, 'device');
  assert.deepEqual(manifest.categories, ['network']);
  assert.deepEqual(manifest.transports, ['local']);
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-sfr-box:/);
});

test('widgets, scene triggers and scene actions require Gladys >= 5.1.0', () => {
  assert.ok(isAtLeast(minGladysVersion(), [5, 1, 0]), manifest.gladys_version);
});

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), Object.keys(createActions(handlers)).sort());
});

test('every scene action has a handler, and vice versa', () => {
  assert.deepEqual(
    keysOf(manifest.scene_actions).sort(),
    Object.keys(createSceneActions(handlers)).sort(),
  );
});

test('every widget has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets).sort(), Object.keys(createWidgets(handlers)).sort());
});

test('the scene triggers the code fires are exactly the declared ones', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), Object.values(SCENE_TRIGGERS).sort());
});

test('the scene trigger variables are keys the code publishes', async () => {
  const monitor = await source('src/monitor.js');
  for (const trigger of manifest.scene_triggers) {
    for (const variable of trigger.variables ?? []) {
      assert.match(monitor, new RegExp(`\\b${variable.key}:`), `${trigger.key}.${variable.key}`);
    }
  }
});

test('the reboot action carries its confirmation box, read by the handler', async () => {
  const reboot = manifest.actions.find((action) => action.key === 'reboot');
  const confirm = reboot.fields.find((field) => field.key === 'confirm');
  assert.equal(confirm.type, 'boolean');
  // An action applies no default and refuses a missing required field (#3155).
  assert.notEqual(confirm.required, true);
  assert.match(await source('src/actions.js'), /fields\?\.confirm/);
});

test('the widget settings are read by the widget', async () => {
  const widgets = await source('src/widgets.js');
  for (const setting of manifest.widgets.flatMap((widget) => widget.settings ?? [])) {
    assert.match(widgets, new RegExp(`settings\\?\\.${setting.key}`), setting.key);
  }
});

test('config_schema keys and defaults match DEFAULT_CONFIG', () => {
  const fields = manifest.config_schema.filter((field) => field.type !== 'section');
  assert.deepEqual(fields.map((field) => field.key).sort(), Object.keys(DEFAULT_CONFIG).sort());
  for (const field of fields) {
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, field.key);
    }
  }
});

test('the language choices are the languages of the texts', () => {
  const language = manifest.config_schema.find((field) => field.key === 'language');
  assert.deepEqual(
    language.options.map((option) => option.value),
    LANGUAGES,
  );
});

test('the password is a secret field, and no action asks for one', () => {
  const password = manifest.config_schema.find((field) => field.key === 'password');
  assert.equal(password.type, 'secret');
  // A secret in an action form cannot be filled (#3154).
  for (const action of manifest.actions) {
    assert.ok(!(action.fields ?? []).some((field) => field.type === 'secret'), action.key);
  }
});

test('number fields declare integer bounds and defaults', () => {
  // Gladys 5.1 renders number fields without `step`: decimals are refused.
  for (const field of allFields.filter((f) => f.type === 'number')) {
    for (const key of ['min', 'max', 'default']) {
      if (field[key] !== undefined) {
        assert.ok(Number.isInteger(field[key]), `${field.key}.${key}`);
      }
    }
  }
});

test('section fields are purely presentational, and mention the non-affiliation', () => {
  const sections = manifest.config_schema.filter((f) => f.type === 'section');
  assert.ok(sections.length > 0);
  for (const section of sections) {
    for (const key of ['required', 'default', 'placeholder']) {
      assert.equal(section[key], undefined, `section "${section.key}" must not have ${key}`);
    }
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
  assert.match(sections[0].description.en, /Not affiliated with SFR/);
});

test('dynamic selects declare the devices source and no static options', () => {
  const dynamicSelects = allFields.filter((f) => f.source !== undefined);
  assert.ok(dynamicSelects.length > 0);
  for (const field of dynamicSelects) {
    assert.equal(field.source, 'devices');
    assert.equal(field.options, undefined, field.key);
    assert.equal(field.default, undefined, field.key);
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  // The Release workflow writes all three: a mismatch means one was edited by
  // hand, and Gladys would offer a version whose image is another one.
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(
    manifest.docker_image.endsWith(`:${manifest.version}`),
    `docker_image must be tagged :${manifest.version}, got "${manifest.docker_image}"`,
  );
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(
      text.length >= 10 && text.length <= 100,
      `description.${lang} has ${text.length} characters (10 to 100 allowed)`,
    );
  }
});

test('labels, descriptions and placeholders are multi-language objects', () => {
  for (const field of allFields) {
    for (const key of ['label', 'description', 'placeholder']) {
      if (field[key] !== undefined) {
        assert.equal(typeof field[key], 'object', `field "${field.key}": ${key}`);
        assert.ok(field[key].en, `field "${field.key}": ${key} needs an English text`);
      }
    }
  }
});
