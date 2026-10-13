// A running integration for the tests that let the monitor's own timer drive
// the readings: setInterval and Date are mocked, nothing calls refresh() or
// onPoll. `minute()` advances the clock by one reading and waits for it.

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { REFRESH_INTERVAL_MS } from '../../src/monitor.js';
import { createFakeBox } from './fake-box.js';

export const BOX_ID = 'ext:test-integration:box:02005e100001';
export const ALICE = 'ext:test-integration:host:02005e0000a1';

export async function startSession(t, { box: boxOptions, config } = {}) {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: Date.parse('2026-10-13T08:00:00Z') });
  const box = createFakeBox(boxOptions);
  const gladys = createFakeGladys({
    config: { host: '192.168.1.1', password: box.password, language: 'en', ...config },
  });
  const { monitor } = registerHandlers(gladys, { createClient: box.createClient });
  await gladys.connect();
  t.after(() => gladys.disconnect());
  const create = async (externalId) =>
    gladys.fake.deviceCreated(
      gladys.fake.discoveredDevices.find((device) => device.external_id === externalId),
    );
  const minute = async () => {
    t.mock.timers.tick(REFRESH_INTERVAL_MS);
    // The timer started a reading: wait for it, and for its error handler.
    await monitor.running?.catch(() => {});
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { box, gladys, monitor, create, minute };
}

/** Every console line, with the level the SDK logger prefixed it with. */
export function captureLogs(t, level) {
  const previous = process.env.LOG_LEVEL;
  if (level) {
    process.env.LOG_LEVEL = level;
  } else {
    delete process.env.LOG_LEVEL;
  }
  t.after(() => {
    if (previous === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = previous;
    }
  });
  const lines = [];
  const capture = (...args) =>
    lines.push(args.map((arg) => (arg instanceof Error ? arg.stack : String(arg))).join(' '));
  t.mock.method(console, 'log', capture);
  t.mock.method(console, 'error', capture);
  t.mock.method(console, 'warn', capture);
  const at = (name) => lines.filter((line) => line.includes(`[${name.toUpperCase()}]`));
  return { lines, at };
}
