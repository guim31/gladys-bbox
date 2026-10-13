// -----------------------------------------------------------------------------
// The integration: reads the Bbox on a timer and keeps Gladys up to date.
//
// Everything is wired on the `gladys` client given to createApp, so the tests
// run the real wiring against the SDK's fake Gladys and an in-memory Bbox.
//
// One reading = one pass over the API routes (src/bbox/snapshot.js). Its
// result feeds:
//   - the discovered devices, re-published when their structure changes;
//   - the states, only the changed ones (publishChangedStates);
//   - the presence of the hosts the user added to Gladys;
//   - the scene triggers (src/triggers.js);
//   - the dashboard widget, nudged when its computed part changes.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { BboxError, createBboxClient } from './bbox/client.js';
import { createHttpsTransport } from './bbox/transport.js';
import { readSnapshot } from './bbox/snapshot.js';
import { createCapabilityStore } from './capabilities.js';
import {
  WIFI_COMMANDS,
  boxFeatureKey,
  boxIds,
  buildBoxStates,
  buildDiscoveredDevices,
  hostIds,
  presenceFeatureId,
} from './devices.js';
import { TRIGGER, detectEvents, readLastMissedCaller } from './triggers.js';
import { BBOX_WIDGET, buildWidgetContent } from './widget.js';
import { TEXTS, format, t } from './i18n.js';

// A stable value is re-sent this often, so it stays recently dated in Gladys.
const STATE_HEARTBEAT_MS = 30 * 60 * 1000;
// Presence is a "seen at" signal (presence-sensor/push, like the Bluetooth
// presence of the core): the core's "check presence" scene action reads how
// long ago it was last received. A host still connected is reported again
// every 5 minutes; a host that comes back is reported at once.
const PRESENCE_HEARTBEAT_MS = 5 * 60 * 1000;

export const ACTION = { TEST_CONNECTION: 'test_connection', REBOOT: 'reboot' };

/** The real Bbox client, built from the configuration. */
export function createClientFromConfig(config) {
  return createBboxClient({
    transport: createHttpsTransport({
      host: config.host,
      tlsVerify: config.tls_verify !== 'insecure',
    }),
    password: config.password,
  });
}

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {{ createClient?: Function, dataDir?: string, now?: () => number, logger?: object }} options
 */
export function createApp(gladys, options = {}) {
  const createClient = options.createClient ?? createClientFromConfig;
  const now = options.now ?? Date.now;
  const logger = options.logger ?? createLogger({ name: 'bbox' });
  const capabilityStore = createCapabilityStore(options.dataDir ?? process.env.DATA_DIR ?? '/data');

  let config = normalizeConfig();
  let client = createClient(config);
  let snapshot = null;
  let reachable = false;
  let lostAt = null;
  let discoverySignature = null;
  let widgetSignature = null;
  let statusKey = null;
  let timer = null;
  let running = false;
  let readingPromise = null;
  // Calm logs: a normal reading writes nothing at info level. A failure
  // writes one line when it starts (or changes kind) and one when it ends,
  // not one per reading; the repeats go to debug.
  let failure = null;
  let announced = false;

  function setConfig(raw) {
    const previous = config;
    config = normalizeConfig(raw);
    if (
      previous.host !== config.host ||
      previous.password !== config.password ||
      previous.tls_verify !== config.tls_verify
    ) {
      // A new client also clears a refused password or a login lock.
      client = createClient(config);
    }
    if (config.tls_verify === 'insecure') {
      logger.warn('Certificate verification of the Bbox is turned off (tls_verify: insecure)');
    }
  }

  function reportFailure(kind, message, err) {
    if (kind === failure) {
      logger.debug(message);
      return;
    }
    failure = kind;
    if (err) {
      logger.error(message, err);
    } else {
      logger.warn(message);
    }
  }

  function reportSuccess() {
    if (failure !== null) {
      logger.info('Reading the Bbox works again');
    } else if (!announced) {
      logger.info(
        `Connected to the Bbox ${snapshot.model ?? '?'} (firmware ${snapshot.firmware ?? '?'})`,
      );
    }
    failure = null;
    announced = true;
  }

  async function setStatus(key) {
    if (key === statusKey) {
      return;
    }
    statusKey = key;
    if (key === 'ok') {
      await gladys.setConnectionStatus(true);
    } else {
      await gladys.setConnectionStatus(false, TEXTS.status[key] ?? TEXTS.status.api_error);
    }
  }

  function createdExternalIds() {
    return new Set((gladys.devices ?? []).map((device) => device.external_id));
  }

  async function publishDiscovery({ force = false } = {}) {
    const devices = buildDiscoveredDevices(gladys, {
      snapshot,
      capabilities: capabilityStore.get(),
      config,
    });
    const signature = JSON.stringify(devices);
    if (!force && signature === discoverySignature) {
      return;
    }
    await gladys.publishDiscoveredDevices(devices);
    discoverySignature = signature;
  }

  async function publishBoxStates() {
    await gladys.publishChangedStates(buildBoxStates(gladys, snapshot, capabilityStore.get()), {
      heartbeat: STATE_HEARTBEAT_MS,
    });
  }

  // Presence only for the hosts the user added: the others would be dropped
  // by Gladys, and count against its 300 states per minute.
  async function publishPresence() {
    if (!config.track_hosts || !snapshot.hosts) {
      return;
    }
    const created = createdExternalIds();
    const present = [];
    for (const host of snapshot.hosts) {
      if (!created.has(hostIds(gladys, host.mac).device)) {
        continue;
      }
      const featureId = presenceFeatureId(gladys, host.mac);
      if (host.active) {
        present.push({ device_feature_external_id: featureId, state: 1 });
      } else {
        // Nothing is sent for an absent host (a push presence sensor only
        // says "seen"); forgetting it re-sends at once when it comes back.
        gladys.forgetPublishedStates(featureId);
      }
    }
    if (present.length > 0) {
      await gladys.publishChangedStates(present, { heartbeat: PRESENCE_HEARTBEAT_MS });
    }
  }

  async function publishEvents(previous) {
    const { events, missedLines } = detectEvents(previous, snapshot, { lostAt, now: now() });
    // Remember when the connection was lost, for the downtime of the
    // `connection_restored` event (unknown when lost before the start).
    if (previous?.internet === true && snapshot.internet === false) {
      lostAt = now();
    } else if (snapshot.internet === true) {
      lostAt = null;
    }
    for (const event of events) {
      // The Internet connection of the box going down or up is worth a line;
      // the scene event itself is a detail.
      if (event.key === TRIGGER.CONNECTION_LOST) {
        logger.info('Internet connection of the Bbox lost');
      } else if (event.key === TRIGGER.CONNECTION_RESTORED) {
        logger.info('Internet connection of the Bbox restored');
      }
      logger.debug(`Scene event ${event.key}`);
      await gladys.publishSceneEvent(event.key, event.data);
    }
    for (const lineId of missedLines) {
      const number = await readLastMissedCaller(client, lineId);
      logger.debug('Scene event missed_call');
      await gladys.publishSceneEvent(TRIGGER.MISSED_CALL, {
        number,
        count: snapshot.missedCalls,
      });
    }
  }

  function refreshWidgetIfChanged() {
    const signature = JSON.stringify(widgetContent('en'));
    if (signature !== widgetSignature) {
      widgetSignature = signature;
      gladys.requestWidgetRefresh(BBOX_WIDGET);
    }
  }

  function widgetContent(language) {
    return buildWidgetContent(gladys, {
      snapshot,
      capabilities: capabilityStore.get(),
      reachable,
      language,
    });
  }

  async function read() {
    if (!config.password) {
      reachable = false;
      await setStatus('missing_password');
      refreshWidgetIfChanged();
      return;
    }
    const previous = snapshot;
    let next;
    try {
      next = await readSnapshot(client, { logger });
    } catch (err) {
      reachable = false;
      // The message names the route and the status, never a credential.
      reportFailure(
        err instanceof BboxError ? err.kind : 'api_error',
        `Reading the Bbox failed: ${err.message}`,
      );
      await setStatus(err instanceof BboxError ? err.kind : 'api_error');
      refreshWidgetIfChanged();
      return;
    }
    if (!next.serial) {
      reachable = false;
      reportFailure('no_serial', 'The Bbox gave neither its serial number nor its WAN MAC address');
      await setStatus('api_error');
      return;
    }
    snapshot = next;
    reachable = true;
    await capabilityStore.merge(snapshot);
    await publishDiscovery();
    await publishBoxStates();
    await publishPresence();
    await publishEvents(previous);
    await setStatus('ok');
    refreshWidgetIfChanged();
    reportSuccess();
  }

  /** One reading at a time: the timer, a scan and a poll can overlap. */
  function refresh() {
    readingPromise ??= read()
      .catch((err) => reportFailure('cycle', 'Reading cycle failed', err))
      .finally(() => {
        readingPromise = null;
      });
    return readingPromise;
  }

  function schedule() {
    clearTimeout(timer);
    if (!running) {
      return;
    }
    timer = setTimeout(async () => {
      await refresh();
      schedule();
    }, config.refresh_interval * 1000);
  }

  async function start() {
    running = true;
    await refresh();
    schedule();
  }

  function stop() {
    running = false;
    clearTimeout(timer);
    timer = null;
  }

  // Errors of the actions reach the user under the button, in the language
  // of the configuration (an action does not receive the user's).
  function userError(err) {
    const key = err instanceof BboxError ? err.kind : 'api_error';
    return new Error(t(TEXTS.status[key] ?? TEXTS.status.api_error, config.language));
  }

  async function testConnection() {
    if (!config.password) {
      throw userError(new BboxError('missing_password', 'No password'));
    }
    let tested;
    try {
      tested = await readSnapshot(client, { logger });
    } catch (err) {
      logger.warn(`Connection test failed: ${err.message}`);
      throw userError(err);
    }
    logger.info('Connection test succeeded');
    return format(TEXTS.action.test_ok, (language) => ({
      model: tested.model ?? '?',
      firmware: tested.firmware ?? '?',
      internet: t(tested.internet ? TEXTS.word.up : TEXTS.word.down, language),
    }));
  }

  async function reboot(fields) {
    // No confirmation dialog exists for a manifest action: the form carries
    // a checkbox, and an unticked one restarts nothing.
    if (fields?.confirm !== true && fields?.confirm !== 'true') {
      return TEXTS.action.reboot_unconfirmed;
    }
    try {
      await client.write('POST', 'device/reboot');
    } catch (err) {
      logger.warn(`Restart failed: ${err.message}`);
      throw userError(err);
    }
    logger.info('Bbox restart requested');
    return TEXTS.action.reboot_ok;
  }

  async function setValue(device, feature, value) {
    const key = snapshot ? boxFeatureKey(gladys, snapshot.serial, feature.external_id) : null;
    const command = key ? WIFI_COMMANDS[key] : undefined;
    if (!command || device.external_id !== boxIds(gladys, snapshot.serial).device) {
      throw new Error(`No command for ${feature.external_id}`);
    }
    const enabled = Number(value) === 1;
    logger.info(`Wi-Fi ${key} -> ${enabled ? 'on' : 'off'}`);
    await client.write('PUT', command.route, { [command.field]: enabled ? 1 : 0 });
    // The write succeeded: reflect it now, the next reading confirms it.
    const field = { wifi_24: 'wifi24', wifi_5: 'wifi5', wifi_guest: 'wifiGuest' }[key];
    snapshot = { ...snapshot, [field]: enabled };
    await gladys.publishState(feature.external_id, enabled ? 1 : 0);
    refreshWidgetIfChanged();
  }

  function register() {
    gladys.onScanRequest(async () => {
      await refresh();
      await publishDiscovery({ force: true });
    });

    // Gladys does not poll these devices (should_poll: false): kept as a
    // fallback, a poll just triggers a reading.
    gladys.onPoll(() => refresh());

    gladys.onSetValue((device, feature, value) => setValue(device, feature, value));

    // States sent before the user added the device were dropped by Gladys:
    // send them again now (the SDK forgot them on creation).
    gladys.onDeviceCreated(async () => {
      if (snapshot) {
        await publishBoxStates();
        await publishPresence();
      }
      gladys.requestWidgetRefresh(BBOX_WIDGET);
    });

    gladys.onAction(ACTION.TEST_CONNECTION, () => testConnection());
    gladys.onAction(ACTION.REBOOT, (fields) => reboot(fields));

    gladys.onWidgetGet(BBOX_WIDGET, ({ language }) => widgetContent(language));

    gladys.onConfigUpdated(async (newConfig) => {
      setConfig(newConfig);
      statusKey = null;
      failure = null;
      announced = false;
      await refresh();
      // Language or host tracking may change the published devices.
      await publishDiscovery();
      schedule();
    });

    gladys.on('connected', async () => {
      try {
        setConfig(await gladys.getConfig());
        await capabilityStore.load();
        statusKey = null;
        failure = null;
        announced = false;
        discoverySignature = null;
        widgetSignature = null;
        await start();
      } catch (err) {
        logger.error('Post-connection initialization failed', err);
      }
    });

    gladys.on('disconnected', () => stop());
  }

  return {
    register,
    refresh,
    start,
    stop,
    getSnapshot: () => snapshot,
  };
}
