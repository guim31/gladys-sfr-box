// The administrator password, the session token, the authentication hash and
// the Wi-Fi key the box returns must never reach the logs, nor anything sent
// to Gladys. A full session runs at the debug log level, every line captured.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { computeHash } from '../src/sfr/client.js';
import { createFakeBox, PASSWORD, TOKEN } from './helpers/fake-box.js';

const SECRETS = {
  password: PASSWORD,
  token: TOKEN,
  hash: computeHash(TOKEN, 'admin', PASSWORD),
  'Wi-Fi key': 'FAKE-WIFI-KEY-not-real',
};

function assertNoSecret(text, where) {
  for (const [name, secret] of Object.entries(SECRETS)) {
    assert.ok(!text.includes(secret), `the ${name} leaks into ${where}`);
  }
}

test('a full session never logs nor publishes a secret', async (t) => {
  const previousLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'debug';
  t.after(() => {
    process.env.LOG_LEVEL = previousLevel;
  });
  const lines = [];
  const capture = (...args) =>
    lines.push(args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(' '));
  t.mock.method(console, 'log', capture);
  t.mock.method(console, 'error', capture);
  t.mock.method(console, 'warn', capture);

  const box = createFakeBox({ hostsPrivate: true });
  const gladys = createFakeGladys({ config: { host: '192.168.1.1', password: PASSWORD } });
  const { monitor } = registerHandlers(gladys, { createClient: box.createClient });
  await gladys.connect();
  t.after(() => gladys.disconnect());

  // Every path: discovery, created devices, actions, scenes, widget, errors.
  for (const device of gladys.fake.discoveredDevices) {
    await gladys.fake.deviceCreated(device);
  }
  const results = [
    await gladys.fake.action('test_connection', {}),
    await gladys.fake.action('reboot', { confirm: true }),
    await gladys.fake.sceneAction('reboot_box', {}),
    await gladys.fake.widgetGet('sfr_box', { settings: { reboot_button: true } }),
    await gladys.fake.widgetAction('sfr_box', 'reboot', {}),
  ];
  box.wanStatus = 'down';
  await monitor.refresh();
  box.overrides['system.reboot'] =
    '<rsp stat="fail"><err code="115" msg="Authentication needed"/></rsp>';
  results.push(await gladys.fake.sceneAction('reboot_box', {}));
  box.password = 'changed-on-the-box';
  monitor.client.token = null;
  await monitor.refresh();
  box.reachable = false;
  await monitor.refresh();
  results.push(await gladys.fake.action('test_connection', {}));
  await gladys.fake.configUpdated({ host: '192.168.1.1', password: PASSWORD });

  assert.ok(box.calls('auth.checkToken').length > 0, 'the authentication really ran');
  assert.ok(lines.length > 0, 'the logs were captured');
  assertNoSecret(lines.join('\n'), 'the logs');
  assertNoSecret(JSON.stringify(gladys.fake.requests), 'the host API requests');
  assertNoSecret(JSON.stringify(gladys.fake.wsMessages), 'the WebSocket messages');
  assertNoSecret(JSON.stringify(results), 'the action, scene and widget results');
  assertNoSecret(JSON.stringify(monitor.snapshot), 'the snapshot');
});

test('the code writes no file (the container rootfs is read-only, /data is unused)', async () => {
  const sources = [new URL('../index.js', import.meta.url)];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
      if (entry.isDirectory()) {
        await walk(url);
      } else if (entry.name.endsWith('.js')) {
        sources.push(url);
      }
    }
  };
  await walk(new URL('../src/', import.meta.url));
  for (const source of sources) {
    const code = await readFile(source, 'utf8');
    assert.doesNotMatch(code, /node:fs|writeFile|createWriteStream/, `${source.pathname} writes`);
  }
});
