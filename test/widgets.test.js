import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { buildWidgetContent, formatUptime } from '../src/widgets.js';
import { LANGUAGES } from '../src/i18n.js';
import { SCENARIOS, snapshotFor } from './helpers/scenarios.js';

const DAY = 86400;

test('the uptime fits a widget value (12 characters) in every language', () => {
  for (const language of LANGUAGES) {
    for (const seconds of [0, 59, 3599, DAY - 1, DAY, 999 * DAY + 23 * 3600, 5000 * DAY]) {
      const text = formatUptime(seconds, language);
      assert.ok(text.length <= 12, `${language} ${seconds}s: "${text}"`);
    }
  }
  assert.equal(formatUptime(450796, 'fr'), '5 j 5 h');
  assert.equal(formatUptime(5334, 'en'), '1 h 28 min');
  assert.equal(formatUptime(5000 * DAY, 'de'), '5000 T');
});

test('every box shape gives a valid widget, within the core budget', async () => {
  for (const scenario of SCENARIOS) {
    const { snapshot } = await snapshotFor(scenario);
    for (const language of LANGUAGES) {
      const content = buildWidgetContent({
        snapshot,
        reachable: true,
        canReboot: true,
        settings: { reboot_button: true },
        language,
      });
      // validateWidgetContent also enforces the budget (8 components, 6 tiles…).
      assert.deepEqual(validateWidgetContent(content), [], `${scenario.name}/${language}`);
    }
  }
});

test('the fibre widget shows no DSL rates', async () => {
  const { snapshot } = await snapshotFor(SCENARIOS.find((s) => s.name === 'fibre box'));
  const content = buildWidgetContent({ snapshot, reachable: true, settings: {}, language: 'en' });
  const labels = content.components.filter((c) => c.type === 'value').map((c) => c.label);
  assert.deepEqual(labels, ['Uptime', 'Temperature']);
  const status = content.components.find((c) => c.type === 'status');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value]),
    [
      ['Internet', 'Connected'],
      ['Fibre line', 'Synchronized'],
      ['IPv6', 'Disconnected'],
      ['Wi-Fi', 'Enabled'],
    ],
  );
});

test('no reboot button without a password, even when the setting asks for it', async () => {
  const { snapshot } = await snapshotFor(SCENARIOS[0]);
  const content = buildWidgetContent({
    snapshot,
    reachable: true,
    canReboot: false,
    settings: { reboot_button: true },
    language: 'en',
  });
  assert.ok(!content.components.some((c) => c.type === 'button'));
});

test('before the first reading, the widget says it is waiting', () => {
  const content = buildWidgetContent({ snapshot: null, reachable: null, language: 'es' });
  assert.equal(content.components[0].items[0].value, 'Esperando la primera lectura');
  assert.deepEqual(validateWidgetContent(content), []);
});
