// -----------------------------------------------------------------------------
// The reading loop: reads the box once a minute and turns each reading into
// what Gladys needs.
//
//   - the discovered devices, re-published only when they change;
//   - the states of the CREATED devices only (Gladys drops the others), and
//     only the values that changed (300 states per minute at most);
//   - the presence of the connected devices: 1 on arrival, then every 5
//     minutes while the device stays connected;
//   - the "Internet connection lost / restored" scene triggers, from the
//     box's own WAN status;
//   - the connection status shown in the Configuration screen.
//
// One timer drives everything, created devices or not: the presence of a
// phone must not depend on the box device having been added.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { SfrBoxClient } from './sfr/client.js';
import { readSnapshot } from './sfr/snapshot.js';
import { buildDiscoveredDevices } from './devices/index.js';
import { boxIds, boxStates } from './devices/box.js';
import { hostIds, PRESENCE_FEATURE } from './devices/host.js';
import { tAll } from './i18n.js';

const logger = createLogger({ name: 'monitor' });

export const REFRESH_INTERVAL_MS = 60 * 1000;
// A stable value is re-sent this often, so it stays recently dated in Gladys.
export const BOX_HEARTBEAT_MS = 30 * 60 * 1000;
// "Seen" date of a connected device: the "check user presence" scene action
// must use a longer delay (10 minutes or more, see the docs).
export const PRESENCE_HEARTBEAT_MS = 5 * 60 * 1000;
// After a reboot asked through Gladys, the Internet connection drops for a
// few minutes: no scene trigger then, or a scene "connection lost → reboot
// the box" would loop through the integration.
export const REBOOT_QUIET_MS = 10 * 60 * 1000;

export const SCENE_TRIGGERS = {
  CONNECTION_LOST: 'connection_lost',
  CONNECTION_RESTORED: 'connection_restored',
};

export class RebootError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'RebootError';
    this.reason = reason;
  }
}

export class BoxMonitor {
  /**
   * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
   * @param {object} [options]
   * @param {(config: object) => SfrBoxClient} [options.createClient]
   * @param {() => number} [options.now]
   * @param {(changed: boolean) => void} [options.onSnapshot] called after each reading
   */
  constructor(gladys, { createClient, now = Date.now, onSnapshot = () => {} } = {}) {
    this.gladys = gladys;
    this.createClient =
      createClient ??
      ((config) =>
        new SfrBoxClient({
          host: config.host,
          username: config.username,
          password: config.password,
        }));
    this.now = now;
    this.onSnapshot = onSnapshot;
    this.timer = null;
    this.running = null;
    this.snapshot = null;
    this.reachable = null;
    this.statusKey = null;
    this.discoverySignature = null;
    this.widgetSignature = null;
    this.hostsSeen = new Map();
    this.lastWanUp = undefined;
    this.announcedWanUp = undefined;
    this.wanDownSince = null;
    this.quietUntil = 0;
    // Failures that repeat at every reading: logged once, then on recovery.
    this.failing = new Set();
  }

  /** (Re)apply the configuration: new client, so a refused password is retried. */
  configure(config) {
    this.config = config;
    this.client = this.createClient(config);
    this.statusKey = null;
    this.discoverySignature = null;
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      this.refresh().then(
        () => this.recovered('reading', 'Reading works again'),
        (err) => this.failed('reading', 'Reading failed', err),
      );
    }, REFRESH_INTERVAL_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  /** Read the box now; concurrent calls share the same reading. */
  refresh() {
    if (!this.running) {
      this.running = this.read().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  async read() {
    let snapshot;
    try {
      snapshot = await readSnapshot(this.client, this.config);
    } catch (err) {
      if (this.reachable !== false) {
        logger.warn(`SFR Box unreachable: ${err.message}`);
      } else {
        logger.debug(`SFR Box still unreachable: ${err.message}`);
      }
      this.reachable = false;
      await this.reportStatus('unreachable');
      this.notifyWidget();
      return null;
    }
    if (this.reachable === false) {
      logger.info('SFR Box reachable again');
    }
    this.reachable = true;
    this.snapshot = snapshot;
    await this.reportStatus(snapshot.auth);
    await this.handleWan(snapshot);
    await this.publishDiscovery();
    await this.publishStates();
    this.notifyWidget();
    logger.debug(
      `Reading: Internet ${snapshot.wan.up}, line ${snapshot.infra}, ` +
        `${snapshot.hosts?.length ?? '?'} hosts, auth ${snapshot.auth}`,
    );
    return snapshot;
  }

  /** Publish the discovered devices when they changed (or when `force`d). */
  async publishDiscovery({ force = false } = {}) {
    if (!this.snapshot) {
      return;
    }
    const devices = buildDiscoveredDevices(this.gladys, this.snapshot, this.config);
    const signature = JSON.stringify(devices);
    if (!force && signature === this.discoverySignature) {
      return;
    }
    await this.gladys.publishDiscoveredDevices(devices);
    this.discoverySignature = signature;
  }

  /** Publish the states of the created devices, changes only. */
  async publishStates() {
    const snapshot = this.snapshot;
    if (!snapshot) {
      return;
    }
    const created = new Set((this.gladys.devices ?? []).map((device) => device.external_id));
    if (created.has(boxIds(this.gladys, snapshot).device)) {
      await this.publish(boxStates(this.gladys, snapshot), BOX_HEARTBEAT_MS);
    }
    if (snapshot.hosts === null) {
      return;
    }
    const presence = [];
    for (const host of snapshot.hosts) {
      const wasSeen = this.hostsSeen.get(host.mac) === true;
      this.hostsSeen.set(host.mac, host.online);
      const ids = hostIds(this.gladys, host);
      if (!host.online || !created.has(ids.device)) {
        continue;
      }
      const featureId = ids.feature(PRESENCE_FEATURE);
      if (!wasSeen) {
        // An arrival: publish now, whatever the heartbeat remembers.
        this.gladys.forgetPublishedStates(featureId);
      }
      presence.push({ device_feature_external_id: featureId, state: 1 });
    }
    // Gone from the list: the next sighting is an arrival.
    const listed = new Set(snapshot.hosts.map((host) => host.mac));
    for (const mac of this.hostsSeen.keys()) {
      if (!listed.has(mac)) {
        this.hostsSeen.delete(mac);
      }
    }
    await this.publish(presence, PRESENCE_HEARTBEAT_MS);
  }

  async publish(states, heartbeat) {
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat });
      this.recovered('publish', 'Publishing states works again');
    } catch (err) {
      // Re-sent at the next reading: publishChangedStates only remembers what
      // Gladys accepted.
      this.failed('publish', `Publishing states failed: ${err.message}`);
    }
  }

  async reportStatus(key) {
    if (key === this.statusKey) {
      return;
    }
    const messages = {
      unreachable: tAll('status_unreachable', { host: this.config.host }),
      rejected: tAll('status_auth_rejected'),
      button_only: tAll('status_auth_button_only'),
    };
    try {
      if (key === 'unreachable') {
        await this.gladys.setConnectionStatus(false, messages.unreachable);
      } else if (messages[key]) {
        await this.gladys.setConnectionStatus(true, messages[key]);
      } else {
        await this.gladys.setConnectionStatus(true);
      }
      this.statusKey = key;
      this.recovered('status', 'Connection status published again');
    } catch (err) {
      // Retried at the next reading (statusKey unchanged).
      this.failed('status', `Connection status not published: ${err.message}`);
    }
  }

  async handleWan(snapshot) {
    const up = snapshot.wan.up;
    if (up === null) {
      return;
    }
    const now = this.now();
    if (!up && this.lastWanUp === true) {
      this.wanDownSince = now;
    } else if (!up && this.lastWanUp === undefined) {
      // Down from the first reading: the start of the outage is unknown.
      this.wanDownSince = null;
    }
    this.lastWanUp = up;
    if (now < this.quietUntil) {
      return;
    }
    const announced = this.announcedWanUp;
    this.announcedWanUp = up;
    if (announced === undefined || announced === up) {
      return;
    }
    const device = boxIds(this.gladys, snapshot).device;
    try {
      if (up) {
        const outage = this.wanDownSince === null ? null : (now - this.wanDownSince) / 1000;
        logger.info('Internet connection restored');
        await this.gladys.publishSceneEvent(SCENE_TRIGGERS.CONNECTION_RESTORED, {
          device,
          outage_seconds: outage === null ? null : Math.round(outage),
        });
      } else {
        logger.info('Internet connection lost');
        await this.gladys.publishSceneEvent(SCENE_TRIGGERS.CONNECTION_LOST, { device });
      }
    } catch (err) {
      logger.warn(`Scene event not published: ${err.message}`);
    }
  }

  /** Log a repeating failure once: warn the first time, debug afterwards. */
  failed(key, message, err) {
    const detail = err ? [err] : [];
    if (this.failing.has(key)) {
      logger.debug(message, ...detail);
      return;
    }
    this.failing.add(key);
    if (err) {
      logger.error(message, err);
    } else {
      logger.warn(message);
    }
  }

  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  notifyWidget() {
    const signature = JSON.stringify([
      this.reachable,
      this.snapshot && widgetFields(this.snapshot),
    ]);
    const changed = signature !== this.widgetSignature;
    this.widgetSignature = signature;
    this.onSnapshot(changed);
  }

  /** A device was created in Gladys: send it its current states right away. */
  async onDeviceCreated() {
    await this.publishStates();
    this.onSnapshot(true);
  }

  /** Reboot the box (needs the administrator password). */
  async reboot() {
    if (!this.client.hasCredentials) {
      throw new RebootError('no_password', 'No administrator password configured');
    }
    logger.info('Rebooting the SFR Box');
    await this.client.systemReboot();
    this.quietUntil = this.now() + REBOOT_QUIET_MS;
  }
}

// What the widget shows: a change of these values re-pulls it.
function widgetFields(snapshot) {
  return {
    wan: snapshot.wan.up,
    ipv6: snapshot.wan.ipv6Up,
    line: snapshot.line,
    wifi: snapshot.wifi,
    temperature: snapshot.temperature,
    // The uptime tile moves by the hour.
    uptimeHours: snapshot.uptime === null ? null : Math.floor(snapshot.uptime / 3600),
    auth: snapshot.auth,
  };
}
