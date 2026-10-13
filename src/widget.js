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
//
// The core caches the content per language: it is pre-localized here.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { TEXTS, t } from './i18n.js';
import { FEATURE, boxIds } from './devices.js';

export const BBOX_WIDGET = 'bbox';

const LINE_TYPE_LABELS = { ftth: 'FTTH', vdsl: 'VDSL2', adsl: 'ADSL' };

function onOff(value, language) {
  if (value === null || value === undefined) {
    return { value: t(TEXTS.word.unknown, language), color: WIDGET_COLORS.NEUTRAL };
  }
  return value
    ? { value: t(TEXTS.word.on, language), color: WIDGET_COLORS.SUCCESS }
    : { value: t(TEXTS.word.off, language), color: WIDGET_COLORS.NEUTRAL };
}

function statusItems(snapshot, capabilities, language) {
  const W = TEXTS.widget;
  const items = [];
  items.push({
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
      label: t(W.ipv4, language),
      icon: 'map-pin',
      value: snapshot.ipv4,
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  items.push({ label: t(W.wifi_24, language), icon: 'wifi', ...onOff(snapshot.wifi24, language) });
  items.push({ label: t(W.wifi_5, language), icon: 'wifi', ...onOff(snapshot.wifi5, language) });
  if (capabilities.wifiGuest) {
    items.push({
      label: t(W.wifi_guest, language),
      icon: 'users',
      ...onOff(snapshot.wifiGuest, language),
    });
  }
  if (capabilities.voip && snapshot.missedCalls !== null) {
    items.push({
      label: t(W.missed_calls, language),
      icon: 'phone-missed',
      value: snapshot.missedCalls,
      color: snapshot.missedCalls > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (snapshot.uptime !== null) {
    items.push({
      label: t(W.uptime, language),
      icon: 'clock',
      value: t(TEXTS.word.days, language, { n: Math.floor(snapshot.uptime / 86400) }),
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  return items;
}

/**
 * The widget content.
 * @param {object} gladys the SDK client (external ids)
 * @param {{ snapshot: object|null, capabilities: object, reachable: boolean, language: string }} state
 */
export function buildWidgetContent(gladys, { snapshot, capabilities, reachable, language }) {
  const W = TEXTS.widget;
  if (!snapshot) {
    return {
      ttl_seconds: 60,
      components: [{ type: 'text', variant: 'caption', text: t(W.waiting, language) }],
    };
  }
  const ids = boxIds(gladys, snapshot.serial);
  const components = [
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
    { type: 'status', items: statusItems(snapshot, capabilities, language) },
  ];
  if (!reachable) {
    components.unshift({ type: 'text', variant: 'caption', text: t(W.unreachable, language) });
  }
  if (capabilities.wifiGuest && typeof snapshot.wifiGuest === 'boolean') {
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
  // The computed parts follow the readings; the integration nudges the
  // widget when they change, the TTL is a safety net.
  return { ttl_seconds: 300, components };
}
