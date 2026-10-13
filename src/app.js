// -----------------------------------------------------------------------------
// SDK wiring: every handler, registered before connect(). Separate from
// index.js so the tests drive it against the SDK's fake Gladys.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { BoxMonitor } from './monitor.js';
import { createActions } from './actions.js';
import { createSceneActions } from './scenes.js';
import { createWidgets, SFR_BOX_WIDGET } from './widgets.js';

const logger = createLogger({ name: 'app' });

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {object} [options] `createClient` and `now`, injected by the tests
 */
export function registerHandlers(gladys, options = {}) {
  const monitor = new BoxMonitor(gladys, {
    ...options,
    onSnapshot: (changed) => {
      if (changed) {
        gladys.requestWidgetRefresh(SFR_BOX_WIDGET);
      }
    },
  });
  monitor.configure(normalizeConfig());

  gladys.onScanRequest(async () => {
    await monitor.refresh();
    await monitor.publishDiscovery({ force: true });
  });

  // Gladys drops the states of a feature that does not exist yet: send them
  // again as soon as the user adds a device, or updates it from the Discovery
  // tab (new features: password added, line moved to fibre).
  gladys.onDeviceCreated(async (device) => {
    logger.info(`Device created: ${device.external_id}`);
    await monitor.onDeviceCreated();
  });
  gladys.onDeviceUpdated(async (device) => {
    logger.info(`Device updated: ${device.external_id}`);
    await monitor.onDeviceCreated();
  });

  // Fallback only: the devices are published with should_poll: false and the
  // monitor's own timer reads the box every minute (the core scheduler cannot
  // be relied on, Gladys#3198). Should Gladys poll anyway, read and publish.
  gladys.onPoll(async () => {
    await monitor.refresh();
  });

  gladys.onConfigUpdated(async (config) => {
    logger.info('Configuration updated');
    monitor.configure(normalizeConfig(config));
    await monitor.refresh();
  });

  const actions = createActions({
    getConfig: () => monitor.config,
    monitor,
    createClient: options.createClient,
  });
  for (const [key, handler] of Object.entries(actions)) {
    gladys.onAction(key, (fields) => handler(fields));
  }

  for (const [key, handler] of Object.entries(createSceneActions({ monitor }))) {
    gladys.onSceneAction(key, (fields) => handler(fields));
  }

  for (const [key, widget] of Object.entries(createWidgets({ monitor }))) {
    gladys.onWidgetGet(key, (request) => widget.get(gladys, request));
    gladys.onWidgetAction(key, (actionKey, params, extra) =>
      widget.action(gladys, { actionKey, params, ...extra }),
    );
  }

  gladys.on('connected', async () => {
    try {
      monitor.configure(normalizeConfig(await gladys.getConfig()));
      await monitor.refresh();
      monitor.start();
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
    }
  });

  gladys.on('disconnected', () => monitor.stop());

  return { monitor };
}
