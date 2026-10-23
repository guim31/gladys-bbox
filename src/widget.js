// -----------------------------------------------------------------------------
// The "Bbox" dashboard widget (Gladys 5.1+).
//
// - Live tiles bound to the device features (throughput, connected devices):
//   they follow the published states without any refresh.
// - A status list computed from the last reading (Internet, line, IPv4,
//   Wi-Fi, missed calls, uptime), refreshed by the integration when it
//   changes (see src/app.js).
// - A guest Wi-Fi button bound to the device feature (onSetValue). The box
//   restart stays a Configuration action: the released cores (5.1.4, 5.2.0)
//   render no confirmation for a widget button.
// - A "lines" setting (multi_select) picks the rows shown; empty shows all.
//
// The core caches the content per language: it is pre-localized here.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { TEXTS, t } from './i18n.js';
import { FEATURE, boxIds } from './devices.js';

export const BBOX_WIDGET = 'bbox';

/** The rows a widget instance can show (the `lines` setting), in display order. */
export const WIDGET_LINES = [
  'download',
  'upload',
  'devices',
  'internet',
  'line',
  'ipv4',
  'wifi_24',
  'wifi_5',
  'wifi_guest',
  'missed_calls',
  'uptime',
  'guest_button',
];

/**
 * The rows to show: the known values of the `lines` setting, or every row
 * when it is missing, empty or holds nothing known.
 * @param {Record<string, unknown>} [settings] the instance settings
 * @returns {Set<string>}
 */
export function shownLines(settings = {}) {
  const lines = Array.isArray(settings?.lines)
    ? settings.lines.filter((line) => WIDGET_LINES.includes(line))
    : [];
  return new Set(lines.length > 0 ? lines : WIDGET_LINES);
}

const LINE_TYPE_LABELS = { ftth: 'FTTH', vdsl: 'VDSL2', adsl: 'ADSL' };

function onOff(value, language) {
  if (value === null || value === undefined) {
    return { value: t(TEXTS.word.unknown, language), color: WIDGET_COLORS.NEUTRAL };
  }
  return value
    ? { value: t(TEXTS.word.on, language), color: WIDGET_COLORS.SUCCESS }
    : { value: t(TEXTS.word.off, language), color: WIDGET_COLORS.NEUTRAL };
}

function statusItems(snapshot, capabilities, language, shown) {
  const W = TEXTS.widget;
  const items = [];
  items.push({
    key: 'internet',
    label: t(W.internet, language),
    icon: 'globe',
    ...(snapshot.internet === null
      ? { value: t(TEXTS.word.unknown, language), color: WIDGET_COLORS.NEUTRAL }
      : snapshot.internet
        ? { value: t(TEXTS.word.up, language), color: WIDGET_COLORS.SUCCESS }
        : { value: t(TEXTS.word.down, language), color: WIDGET_COLORS.DANGER }),
  });
  const lineType = LINE_TYPE_LABELS[snapshot.lineType] ?? snapshot.lineType?.toUpperCase() ?? '?';
  items.push({
    key: 'line',
    label: t(W.line, language),
    icon: 'activity',
    value:
      snapshot.lineSync === null
        ? lineType
        : `${lineType} · ${t(snapshot.lineSync ? TEXTS.word.synced : TEXTS.word.not_synced, language)}`,
    color:
      snapshot.lineSync === null
        ? WIDGET_COLORS.NEUTRAL
        : snapshot.lineSync
          ? WIDGET_COLORS.SUCCESS
          : WIDGET_COLORS.DANGER,
  });
  if (snapshot.ipv4) {
    items.push({
      key: 'ipv4',
      label: t(W.ipv4, language),
      icon: 'map-pin',
      value: snapshot.ipv4,
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  items.push({
    key: 'wifi_24',
    label: t(W.wifi_24, language),
    icon: 'wifi',
    ...onOff(snapshot.wifi24, language),
  });
  items.push({
    key: 'wifi_5',
    label: t(W.wifi_5, language),
    icon: 'wifi',
    ...onOff(snapshot.wifi5, language),
  });
  if (capabilities.wifiGuest) {
    items.push({
      key: 'wifi_guest',
      label: t(W.wifi_guest, language),
      icon: 'users',
      ...onOff(snapshot.wifiGuest, language),
    });
  }
  if (capabilities.voip && snapshot.missedCalls !== null) {
    items.push({
      key: 'missed_calls',
      label: t(W.missed_calls, language),
      icon: 'phone-missed',
      value: snapshot.missedCalls,
      color: snapshot.missedCalls > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (snapshot.uptime !== null) {
    items.push({
      key: 'uptime',
      label: t(W.uptime, language),
      icon: 'clock',
      value: t(TEXTS.word.days, language, { n: Math.floor(snapshot.uptime / 86400) }),
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  return items.filter((item) => shown.has(item.key)).map(({ key: _key, ...item }) => item);
}

/**
 * The widget content.
 * @param {object} gladys the SDK client (external ids)
 * @param {{ snapshot: object|null, capabilities: object, reachable: boolean, language: string, settings?: Record<string, unknown> }} state
 */
export function buildWidgetContent(
  gladys,
  { snapshot, capabilities, reachable, language, settings },
) {
  const W = TEXTS.widget;
  if (!snapshot) {
    return {
      ttl_seconds: 60,
      components: [{ type: 'text', variant: 'caption', text: t(W.waiting, language) }],
    };
  }
  const shown = shownLines(settings);
  const ids = boxIds(gladys, snapshot.serial);
  const tiles = [
    {
      type: 'value',
      label: t(W.download, language),
      icon: 'download',
      device_feature: ids.feature(FEATURE.RATE_DOWN),
    },
    {
      type: 'value',
      label: t(W.upload, language),
      icon: 'upload',
      device_feature: ids.feature(FEATURE.RATE_UP),
    },
    {
      type: 'value',
      label: t(W.devices, language),
      icon: 'smartphone',
      device_feature: ids.feature(FEATURE.CONNECTED_HOSTS),
    },
  ].filter((tile, index) => shown.has(['download', 'upload', 'devices'][index]));
  const components = [...tiles];
  const items = statusItems(snapshot, capabilities, language, shown);
  if (items.length > 0) {
    components.push({ type: 'status', items });
  }
  if (
    shown.has('guest_button') &&
    capabilities.wifiGuest &&
    typeof snapshot.wifiGuest === 'boolean'
  ) {
    // The current state shows through the icon, never the style: `primary`
    // is invisible in dark mode (Gladys#3153).
    components.push({
      type: 'button',
      label: t(snapshot.wifiGuest ? W.guest_off : W.guest_on, language),
      icon: snapshot.wifiGuest ? 'check-circle' : 'circle',
      style: 'secondary',
      device_feature: ids.feature(FEATURE.WIFI_GUEST),
      value: snapshot.wifiGuest ? 0 : 1,
    });
  }
  if (components.length === 0) {
    // Only rows this Bbox lacks (guest Wi-Fi, calls): never an empty widget.
    return buildWidgetContent(gladys, { snapshot, capabilities, reachable, language });
  }
  if (!reachable) {
    components.unshift({ type: 'text', variant: 'caption', text: t(W.unreachable, language) });
  }
  // The computed parts follow the readings; the integration nudges the
  // widget when they change, the TTL is a safety net.
  return { ttl_seconds: 300, components };
}
