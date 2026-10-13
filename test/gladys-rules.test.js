// -----------------------------------------------------------------------------
// Conformity of the discovered devices with what the Gladys core accepts and
// displays, against test/fixtures/gladys-feature-table.json (generated from
// the core's server/utils/constants.js, front/src/utils/consts.js and the
// front translations). Every device shape the integration can publish is
// checked (see test/helpers/scenarios.js).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { allDiscoveries } from './helpers/scenarios.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);
const discoveries = await allDiscoveries();
const everyFeature = discoveries.flatMap(({ scenario, language, devices }) =>
  devices.flatMap((device) =>
    device.features.map((feature) => ({ where: `${scenario}/${language}`, device, feature })),
  ),
);

test('the scenarios cover the box and the connected devices', () => {
  assert.ok(everyFeature.length > 0);
  assert.ok(discoveries.every(({ devices }) => devices.length >= 1));
});

test('every category/type couple is one the Gladys front can label and draw', () => {
  for (const { where, feature } of everyFeature) {
    const couple = `${feature.category}/${feature.type}`;
    assert.ok(table.categories.includes(feature.category), `${where}: unknown category ${couple}`);
    assert.ok(table.types.includes(feature.type), `${where}: unknown type ${couple}`);
    assert.ok(table.pairs[couple], `${where}: ${couple} is not in the feature table`);
  }
});

test('should_poll and poll_frequency follow the core rules', () => {
  for (const { scenario, devices } of discoveries) {
    for (const device of devices) {
      assert.equal(typeof device.should_poll, 'boolean', `${scenario}: ${device.name}`);
      if (device.should_poll) {
        assert.ok(
          table.poll_frequencies_ms.includes(device.poll_frequency),
          `${scenario}: ${device.name} poll_frequency must be one of ${table.poll_frequencies_ms} (ms)`,
        );
      } else if (device.poll_frequency !== undefined) {
        assert.ok(table.poll_frequencies_ms.includes(device.poll_frequency));
      }
    }
  }
});

test('min and max are numbers on every feature', () => {
  for (const { where, feature } of everyFeature) {
    assert.equal(typeof feature.min, 'number', `${where}: ${feature.external_id} min`);
    assert.equal(typeof feature.max, 'number', `${where}: ${feature.external_id} max`);
    assert.ok(Number.isFinite(feature.min) && Number.isFinite(feature.max));
    assert.ok(feature.min <= feature.max, `${where}: ${feature.external_id} min > max`);
  }
});

test('read_only, has_feedback and keep_history are booleans', () => {
  for (const { where, feature } of everyFeature) {
    for (const key of ['read_only', 'has_feedback', 'keep_history']) {
      assert.equal(typeof feature[key], 'boolean', `${where}: ${feature.external_id}.${key}`);
    }
  }
});

test('units are known, and among those the front offers for the category', () => {
  for (const { where, feature } of everyFeature) {
    if (feature.unit === undefined) {
      continue;
    }
    assert.ok(table.units.includes(feature.unit), `${where}: unknown unit ${feature.unit}`);
    const allowed = table.units_by_category[feature.category];
    if (allowed) {
      assert.ok(
        allowed.includes(feature.unit),
        `${where}: ${feature.unit} not offered for ${feature.category}`,
      );
    }
  }
});

test('external ids are unique within each publication', () => {
  for (const { scenario, language, devices } of discoveries) {
    const ids = devices.flatMap((device) => [
      device.external_id,
      ...device.features.map((feature) => feature.external_id),
    ]);
    assert.equal(new Set(ids).size, ids.length, `${scenario}/${language}: duplicate external_id`);
  }
});

test('every feature external id belongs to its device', () => {
  for (const { where, device, feature } of everyFeature) {
    assert.ok(
      feature.external_id.startsWith(`${device.external_id}:`),
      `${where}: ${feature.external_id} outside ${device.external_id}`,
    );
  }
});

test('names are non-empty strings', () => {
  for (const { where, device, feature } of everyFeature) {
    assert.ok(typeof device.name === 'string' && device.name.length > 0, where);
    assert.ok(typeof feature.name === 'string' && feature.name.length > 0, where);
  }
});
