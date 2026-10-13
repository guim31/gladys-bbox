// -----------------------------------------------------------------------------
// The devices published to Gladys, and the states they carry.
//
// - One "Bbox" device: line, WAN, throughput, system and Wi-Fi features. Its
//   external id derives from the box serial number.
// - One presence device per host the Bbox knows (optional, `track_hosts`),
//   keyed by its MAC address: the user adds the ones to follow (phones...).
//
// Feature keys and the MAC-based ids are forever: Gladys keys the history,
// scenes and dashboards on them.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { TEXTS, t } from './i18n.js';

export const BOX_TYPE = 'bbox';
export const HOST_TYPE = 'host';

export const FEATURE = {
  INTERNET: 'internet',
  LINE_SYNC: 'line_sync',
  LINE_TYPE: 'line_type',
  SYNC_DOWN: 'sync_down',
  SYNC_UP: 'sync_up',
  RATE_DOWN: 'rate_down',
  RATE_UP: 'rate_up',
  IPV4: 'ipv4',
  IPV6: 'ipv6',
  UPTIME: 'uptime',
  FIRMWARE: 'firmware',
  MODEL: 'model',
  TEMPERATURE: 'temperature',
  WIFI_24: 'wifi_24',
  WIFI_5: 'wifi_5',
  WIFI_GUEST: 'wifi_guest',
  MISSED_CALLS: 'missed_calls',
  CONNECTED_HOSTS: 'connected_hosts',
  PRESENCE: 'presence',
};

// The Wi-Fi switches and the API route that drives each of them.
export const WIFI_COMMANDS = {
  [FEATURE.WIFI_24]: { route: 'wireless/24', field: 'radio.enable' },
  [FEATURE.WIFI_5]: { route: 'wireless/5', field: 'radio.enable' },
  [FEATURE.WIFI_GUEST]: { route: 'wireless/guestenable', field: 'enable' },
};

// Upper bound of the throughput features, in Mbit/s (8 Gbit/s fibre offers).
const MAX_RATE_MBIT = 10000;

const LINE_TYPE_LABELS = { ftth: 'FTTH', vdsl: 'VDSL2', adsl: 'ADSL' };

// The ":" separates the parts of an external id: keep the platform id plain.
function platformId(value) {
  return String(value)
    .replace(/[^A-Za-z0-9_-]/g, '')
    .toLowerCase();
}

export function boxIds(gladys, serial) {
  return gladys.externalIds(BOX_TYPE, platformId(serial));
}

export function hostIds(gladys, mac) {
  return gladys.externalIds(HOST_TYPE, platformId(mac));
}

function sensor(ids, key, language, category, type, extra = {}) {
  return {
    name: t(TEXTS.feature[key], language),
    external_id: ids.feature(key),
    category,
    type,
    read_only: true,
    has_feedback: false,
    keep_history: false,
    // NOT NULL in Gladys, text features included (a 422 on "Add" otherwise).
    min: 0,
    max: 0,
    ...extra,
  };
}

function wifiSwitch(ids, key, language) {
  return {
    ...sensor(ids, key, language, CATEGORIES.SWITCH, TYPES.SWITCH.BINARY),
    read_only: false,
    has_feedback: true,
    keep_history: true,
    max: 1,
  };
}

function rate(ids, key, language, keepHistory) {
  return sensor(ids, key, language, CATEGORIES.DATARATE, TYPES.DATARATE.RATE, {
    unit: UNITS.MEGABITS_PER_SECOND,
    max: MAX_RATE_MBIT,
    keep_history: keepHistory,
  });
}

/**
 * The Bbox device. `capabilities` (src/capabilities.js) adds the features the
 * model exposes; the others are always there.
 */
export function buildBoxDevice(gladys, { snapshot, capabilities, language }) {
  const ids = boxIds(gladys, snapshot.serial);
  const binary = (key) =>
    sensor(ids, key, language, CATEGORIES.INPUT, TYPES.SENSOR.BINARY, {
      max: 1,
      keep_history: true,
    });
  const text = (key) => sensor(ids, key, language, CATEGORIES.TEXT, TYPES.TEXT.TEXT);

  const features = [
    binary(FEATURE.INTERNET),
    binary(FEATURE.LINE_SYNC),
    text(FEATURE.LINE_TYPE),
    rate(ids, FEATURE.SYNC_DOWN, language, true),
    rate(ids, FEATURE.SYNC_UP, language, true),
    rate(ids, FEATURE.RATE_DOWN, language, true),
    rate(ids, FEATURE.RATE_UP, language, true),
    text(FEATURE.IPV4),
    text(FEATURE.IPV6),
    sensor(ids, FEATURE.UPTIME, language, CATEGORIES.DURATION, TYPES.DURATION.DECIMAL, {
      unit: UNITS.DAYS,
      max: 3650,
    }),
    text(FEATURE.FIRMWARE),
    text(FEATURE.MODEL),
    sensor(
      ids,
      FEATURE.CONNECTED_HOSTS,
      language,
      CATEGORIES.COUNTER_SENSOR,
      TYPES.SENSOR.INTEGER,
      {
        max: 255,
        keep_history: true,
      },
    ),
    wifiSwitch(ids, FEATURE.WIFI_24, language),
    wifiSwitch(ids, FEATURE.WIFI_5, language),
  ];
  if (capabilities.wifiGuest) {
    features.push(wifiSwitch(ids, FEATURE.WIFI_GUEST, language));
  }
  if (capabilities.temperature) {
    features.push(
      sensor(
        ids,
        FEATURE.TEMPERATURE,
        language,
        CATEGORIES.DEVICE_TEMPERATURE_SENSOR,
        TYPES.SENSOR.DECIMAL,
        {
          unit: UNITS.CELSIUS,
          max: 120,
          keep_history: true,
        },
      ),
    );
  }
  if (capabilities.voip) {
    features.push(
      sensor(ids, FEATURE.MISSED_CALLS, language, CATEGORIES.COUNTER_SENSOR, TYPES.SENSOR.INTEGER, {
        max: 999,
        keep_history: true,
      }),
    );
  }

  return {
    name: 'Bbox',
    external_id: ids.device,
    model: snapshot.model ?? undefined,
    // The integration reads the box with its own timer (refresh interval of
    // the configuration, one minute or slower): Gladys does not poll it.
    should_poll: false,
    features,
  };
}

/** One presence device per host with a MAC address. */
export function buildHostDevice(gladys, host, language) {
  const ids = hostIds(gladys, host.mac);
  return {
    name: host.name ?? host.mac,
    external_id: ids.device,
    should_poll: false,
    params: [{ name: 'MAC_ADDRESS', value: host.mac }],
    features: [
      {
        ...sensor(ids, FEATURE.PRESENCE, language, CATEGORIES.PRESENCE_SENSOR, TYPES.SENSOR.PUSH, {
          max: 1,
          keep_history: true,
        }),
      },
    ],
  };
}

export function buildDiscoveredDevices(gladys, { snapshot, capabilities, config }) {
  if (!snapshot) {
    return [];
  }
  const devices = [buildBoxDevice(gladys, { snapshot, capabilities, language: config.language })];
  if (config.track_hosts) {
    for (const host of snapshot.hosts ?? []) {
      devices.push(buildHostDevice(gladys, host, config.language));
    }
  }
  return devices;
}

/**
 * States of the Bbox device. A value the box did not give is skipped, never
 * sent as 0; a text feature never receives an empty text (Gladys drops it).
 */
export function buildBoxStates(gladys, snapshot, capabilities) {
  const ids = boxIds(gladys, snapshot.serial);
  const states = [];
  const number = (key, value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      states.push({ device_feature_external_id: ids.feature(key), state: value });
    }
  };
  const bool = (key, value) => {
    if (typeof value === 'boolean') {
      number(key, value ? 1 : 0);
    }
  };
  const text = (key, value) => {
    if (typeof value === 'string' && value !== '') {
      states.push({ device_feature_external_id: ids.feature(key), text: value });
    }
  };

  bool(FEATURE.INTERNET, snapshot.internet);
  bool(FEATURE.LINE_SYNC, snapshot.lineSync);
  text(FEATURE.LINE_TYPE, LINE_TYPE_LABELS[snapshot.lineType] ?? snapshot.lineType?.toUpperCase());
  number(FEATURE.SYNC_DOWN, snapshot.syncDown);
  number(FEATURE.SYNC_UP, snapshot.syncUp);
  number(FEATURE.RATE_DOWN, snapshot.rateDown);
  number(FEATURE.RATE_UP, snapshot.rateUp);
  text(FEATURE.IPV4, snapshot.ipv4);
  text(FEATURE.IPV6, snapshot.ipv6);
  // Days with one decimal: a new value every 2.4 hours, not every reading.
  number(FEATURE.UPTIME, snapshot.uptime === null ? null : Math.floor(snapshot.uptime / 8640) / 10);
  text(FEATURE.FIRMWARE, snapshot.firmware);
  text(FEATURE.MODEL, snapshot.model);
  if (snapshot.hosts) {
    number(FEATURE.CONNECTED_HOSTS, snapshot.hosts.filter((host) => host.active).length);
  }
  bool(FEATURE.WIFI_24, snapshot.wifi24);
  bool(FEATURE.WIFI_5, snapshot.wifi5);
  if (capabilities.wifiGuest) {
    bool(FEATURE.WIFI_GUEST, snapshot.wifiGuest);
  }
  if (capabilities.temperature) {
    number(FEATURE.TEMPERATURE, snapshot.temperature);
  }
  if (capabilities.voip) {
    number(FEATURE.MISSED_CALLS, snapshot.missedCalls);
  }
  return states;
}

/** Presence feature of a host. */
export function presenceFeatureId(gladys, mac) {
  return hostIds(gladys, mac).feature(FEATURE.PRESENCE);
}

/** Which feature of the Bbox device an external id names, or null. */
export function boxFeatureKey(gladys, serial, featureExternalId) {
  const ids = boxIds(gladys, serial);
  return Object.values(FEATURE).find((key) => ids.feature(key) === featureExternalId) ?? null;
}
