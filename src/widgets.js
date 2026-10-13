// -----------------------------------------------------------------------------
// The "SFR Box" dashboard widget (manifest `widgets`, Gladys 5.1+): line rates,
// uptime and temperature as tiles, connection states as a status list, and an
// optional reboot button (widget setting, off by default: a dashboard may hang
// on a wall).
//
// The values come from the last reading of the monitor, pre-localized from the
// viewer's language (the core caches the content per language). The monitor
// asks for a refresh when they change; the TTL is the safety net.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { resolveLanguage, t } from './i18n.js';
import { rebootMessage } from './actions.js';

export const SFR_BOX_WIDGET = 'sfr_box';
const REBOOT_ACTION = 'reboot';

/** `450796` seconds → `5 d 5 h` (or `5 h 12 min` under a day). */
export function formatUptime(seconds, language) {
  const minutes = Math.floor(seconds / 60);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d >= 1000) {
    return t('duration_long', language, { d });
  }
  return d > 0 ? t('duration_days', language, { d, h }) : t('duration_hours', language, { h, m });
}

const mbps = (kbps) => Math.round(kbps / 100) / 10;

function stateItem(label, value, language, { on, off, icon }) {
  if (value === null || value === undefined) {
    return { label, icon, value: t('value_unknown', language), color: WIDGET_COLORS.NEUTRAL };
  }
  return value
    ? { label, icon, value: t(on, language), color: WIDGET_COLORS.SUCCESS }
    : { label, icon, value: t(off, language), color: WIDGET_COLORS.DANGER };
}

/** Widget content from the monitor state. */
export function buildWidgetContent({ snapshot, reachable, canReboot, settings, language }) {
  const lang = resolveLanguage(language);
  const components = [];
  if (reachable === false || !snapshot) {
    components.push({
      type: 'status',
      items: [
        reachable === false
          ? {
              label: t('widget_box', lang),
              icon: 'alert-triangle',
              value: t('box_unreachable', lang),
              color: WIDGET_COLORS.DANGER,
            }
          : {
              label: t('widget_box', lang),
              icon: 'clock',
              value: t('widget_waiting', lang),
              color: WIDGET_COLORS.NEUTRAL,
            },
      ],
    });
    return { ttl_seconds: 60, components };
  }

  if (snapshot.line?.kind === 'dsl') {
    if (snapshot.line.rateDown !== null) {
      components.push({
        type: 'value',
        label: t('widget_download', lang),
        icon: 'download',
        value: mbps(snapshot.line.rateDown),
        unit: 'Mbit/s',
      });
    }
    if (snapshot.line.rateUp !== null) {
      components.push({
        type: 'value',
        label: t('widget_upload', lang),
        icon: 'upload',
        value: mbps(snapshot.line.rateUp),
        unit: 'Mbit/s',
      });
    }
  }
  if (snapshot.uptime !== null) {
    components.push({
      type: 'value',
      label: t('widget_uptime', lang),
      icon: 'clock',
      value: formatUptime(snapshot.uptime, lang),
    });
  }
  if (snapshot.temperature !== null) {
    components.push({
      type: 'value',
      label: t('widget_temperature', lang),
      icon: 'thermometer',
      value: snapshot.temperature,
      unit: '°C',
    });
  }

  const items = [
    stateItem(t('widget_internet', lang), snapshot.wan.up, lang, {
      on: 'value_connected',
      off: 'value_disconnected',
      icon: 'globe',
    }),
  ];
  if (snapshot.line) {
    items.push(
      stateItem(
        t(snapshot.line.kind === 'dsl' ? 'widget_line_dsl' : 'widget_line_ftth', lang),
        snapshot.line.up,
        lang,
        { on: 'value_synchronized', off: 'value_not_synchronized', icon: 'activity' },
      ),
    );
  }
  items.push(
    stateItem(t('widget_ipv6', lang), snapshot.wan.ipv6Up, lang, {
      on: 'value_connected',
      off: 'value_disconnected',
      icon: 'globe',
    }),
  );
  if (snapshot.wifi) {
    items.push(
      stateItem(t('widget_wifi', lang), snapshot.wifi.active, lang, {
        on: 'value_enabled',
        off: 'value_disabled',
        icon: 'wifi',
      }),
    );
  }
  components.push({ type: 'status', items });

  if (settings?.reboot_button === true && canReboot) {
    components.push({
      type: 'button',
      label: t('widget_reboot', lang),
      icon: 'refresh-cw',
      style: 'danger',
      action: { key: REBOOT_ACTION, confirm: true },
    });
  }
  return { ttl_seconds: 60, components };
}

export function createWidgets({ monitor }) {
  return {
    [SFR_BOX_WIDGET]: {
      async get(_gladys, { settings, language }) {
        return buildWidgetContent({
          snapshot: monitor.snapshot,
          reachable: monitor.reachable,
          canReboot: Boolean(monitor.client?.hasCredentials),
          settings,
          language,
        });
      },
      async action(_gladys, { actionKey }) {
        if (actionKey !== REBOOT_ACTION) {
          throw new Error(`Unknown widget action: ${actionKey}`);
        }
        return rebootMessage(monitor);
      },
    },
  };
}
