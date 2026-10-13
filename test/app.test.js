import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { FEATURE, boxIds, hostIds } from '../src/devices.js';
import { TRIGGER } from '../src/triggers.js';
import { BBOX_WIDGET } from '../src/widget.js';
import { TEXTS } from '../src/i18n.js';
import { connect, discovered, setup } from './helpers/setup.js';

const SERIAL = 'testserial0001';

test('the first reading publishes the Bbox and the hosts it knows', async () => {
  const { gladys } = await connect(await setup());
  const box = discovered(gladys, boxIds(gladys, SERIAL).device);
  assert.equal(box.name, 'Bbox');
  assert.equal(box.model, 'F@st5688b');
  assert.equal(box.should_poll, false);
  // Model capabilities of the fixture: temperature, guest Wi-Fi, telephony.
  const keys = box.features.map((feature) => feature.external_id.split(':').pop());
  assert.ok(keys.includes(FEATURE.TEMPERATURE));
  assert.ok(keys.includes(FEATURE.WIFI_GUEST));
  assert.ok(keys.includes(FEATURE.MISSED_CALLS));
  // The all-zero MAC of the fixture is skipped.
  const hosts = gladys.fake.discoveredDevices.filter((device) => device !== box);
  assert.deepEqual(
    hosts.map((host) => host.name),
    ['phone-alice', 'laptop'],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('feature names follow the language setting', async () => {
  const { gladys } = await connect(await setup({ config: { language: 'de' } }));
  const box = discovered(gladys, boxIds(gladys, SERIAL).device);
  const internet = box.features.find((f) => f.external_id.endsWith(`:${FEATURE.INTERNET}`));
  assert.equal(internet.name, TEXTS.feature.internet.de);
});

test('the Bbox states: numbers, booleans as 0/1, texts as { text }', async () => {
  const { gladys } = await connect(await setup());
  const ids = boxIds(gladys, SERIAL);
  const last = (key) => gladys.fake.lastState(ids.feature(key));
  assert.equal(last(FEATURE.INTERNET), 1);
  assert.equal(last(FEATURE.LINE_SYNC), 1);
  assert.equal(last(FEATURE.LINE_TYPE), 'FTTH');
  assert.equal(last(FEATURE.RATE_DOWN), 12.5);
  assert.equal(last(FEATURE.RATE_UP), 3.25);
  assert.equal(last(FEATURE.SYNC_DOWN), 2000);
  assert.equal(last(FEATURE.IPV4), '203.0.113.42');
  assert.equal(last(FEATURE.IPV6), '2001:db8::42');
  assert.equal(last(FEATURE.UPTIME), 5);
  assert.equal(last(FEATURE.FIRMWARE), '24.0.12');
  assert.equal(last(FEATURE.TEMPERATURE), 46.4);
  assert.equal(last(FEATURE.WIFI_24), 1);
  assert.equal(last(FEATURE.WIFI_GUEST), 0);
  assert.equal(last(FEATURE.MISSED_CALLS), 2);
  assert.equal(last(FEATURE.CONNECTED_HOSTS), 1);
});

test('an unchanged reading publishes nothing again', async () => {
  const { gladys, app } = await connect(await setup());
  const count = gladys.fake.states.length;
  const discoveries = gladys.fake.bodies('POST', '/discovered_device').length;
  await app.refresh();
  assert.equal(gladys.fake.states.length, count);
  assert.equal(gladys.fake.bodies('POST', '/discovered_device').length, discoveries);
});

test('only the changed values are published', async () => {
  const { gladys, app, bbox } = await connect(await setup());
  const before = gladys.fake.states.length;
  bbox.routes['wan/ip/stats'][0].wan.ip.stats.rx.bandwidth = 40000;
  await app.refresh();
  const sent = gladys.fake.states.slice(before);
  assert.deepEqual(sent, [
    {
      device_feature_external_id: boxIds(gladys, SERIAL).feature(FEATURE.RATE_DOWN),
      state: 40,
    },
  ]);
});

test('presence is published for the hosts added to Gladys only', async () => {
  const context = await setup();
  const { gladys } = context;
  const alice = hostIds(gladys, '02:00:00:00:10:01');
  const laptop = hostIds(gladys, '02:00:00:00:10:02');
  // The user added both, not the third one.
  gladys.fake.devices = [
    { external_id: alice.device, features: [{ external_id: alice.feature(FEATURE.PRESENCE) }] },
    { external_id: laptop.device, features: [{ external_id: laptop.feature(FEATURE.PRESENCE) }] },
  ];
  await connect(context);
  assert.equal(gladys.fake.lastState(alice.feature(FEATURE.PRESENCE)), 1);
  // A push presence sensor says "seen": nothing for an absent host.
  assert.equal(gladys.fake.lastState(laptop.feature(FEATURE.PRESENCE)), undefined);
});

test('a host that comes back is reported at once', async () => {
  const context = await setup();
  const { gladys, app, bbox } = context;
  const laptop = hostIds(gladys, '02:00:00:00:10:02');
  gladys.fake.devices = [
    { external_id: laptop.device, features: [{ external_id: laptop.feature(FEATURE.PRESENCE) }] },
  ];
  await connect(context);
  bbox.routes.hosts[0].hosts.list[1].active = 1;
  await app.refresh();
  assert.equal(gladys.fake.lastState(laptop.feature(FEATURE.PRESENCE)), 1);
});

test('track_hosts off: the Bbox alone', async () => {
  const { gladys } = await connect(await setup({ config: { track_hosts: false } }));
  assert.equal(gladys.fake.discoveredDevices.length, 1);
});

test('everything is published again when the user adds the Bbox', async () => {
  const { gladys } = await connect(await setup());
  const ids = boxIds(gladys, SERIAL);
  const box = discovered(gladys, ids.device);
  const before = gladys.fake.states.length;
  await gladys.fake.deviceCreated({ ...box, features: box.features });
  const sent = gladys.fake.states.slice(before).map((state) => state.device_feature_external_id);
  assert.ok(sent.includes(ids.feature(FEATURE.INTERNET)));
  assert.ok(sent.includes(ids.feature(FEATURE.IPV4)));
  assert.ok(gladys.fake.widgetRefreshes.includes(BBOX_WIDGET));
});

test('connection lost, then restored with its downtime', async () => {
  let clock = 1_000_000;
  const { gladys, app, bbox } = await connect(await setup({ now: () => clock }));
  bbox.routes['wan/ip'][0].wan.ip.state = 'Down';
  await app.refresh();
  clock += 5 * 60 * 1000;
  bbox.routes['wan/ip'][0].wan.ip.state = 'Up';
  await app.refresh();
  assert.deepEqual(gladys.fake.sceneEvents, [
    { key: TRIGGER.CONNECTION_LOST, data: {} },
    { key: TRIGGER.CONNECTION_RESTORED, data: { downtime_minutes: 5, ipv4: '203.0.113.42' } },
  ]);
});

test('no connection event when the Bbox itself does not answer', async () => {
  const { gladys, app, bbox } = await connect(await setup());
  bbox.networkError = 'ECONNREFUSED';
  await app.refresh();
  bbox.networkError = null;
  await app.refresh();
  assert.deepEqual(gladys.fake.sceneEvents, []);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  const statuses = gladys.fake.connectionStatuses.map((status) => status.connected);
  assert.deepEqual(statuses, [true, false, true]);
});

test('a new missed call fires the trigger with the caller number', async () => {
  const { gladys, app, bbox } = await connect(await setup());
  bbox.routes.voip[0].voip[0].notanswered = 3;
  await app.refresh();
  assert.deepEqual(gladys.fake.sceneEvents, [
    { key: TRIGGER.MISSED_CALL, data: { number: '0100000002', count: 3 } },
  ]);
  // Calls consulted: the count drops, nothing fires.
  bbox.routes.voip[0].voip[0].notanswered = 0;
  await app.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 1);
});

test('the Wi-Fi switches drive the Bbox', async () => {
  const { gladys, bbox } = await connect(await setup());
  const ids = boxIds(gladys, SERIAL);
  const box = discovered(gladys, ids.device);
  const feature = (key) => box.features.find((f) => f.external_id === ids.feature(key));
  assert.deepEqual(await gladys.fake.setValue(box, feature(FEATURE.WIFI_5), 0), { success: true });
  assert.deepEqual(await gladys.fake.setValue(box, feature(FEATURE.WIFI_GUEST), 1), {
    success: true,
  });
  assert.deepEqual(bbox.writes, [
    { method: 'PUT', route: 'wireless/5', form: { 'radio.enable': '0' } },
    { method: 'PUT', route: 'wireless/guestenable', form: { enable: '1' } },
  ]);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.WIFI_5)), 0);
  assert.equal(gladys.fake.lastState(ids.feature(FEATURE.WIFI_GUEST)), 1);
});

test('a read-only feature refuses commands', async () => {
  const { gladys } = await connect(await setup());
  const ids = boxIds(gladys, SERIAL);
  const box = discovered(gladys, ids.device);
  const internet = box.features.find((f) => f.external_id === ids.feature(FEATURE.INTERNET));
  const ack = await gladys.fake.setValue(box, internet, 0);
  assert.equal(ack.success, false);
});

test('the restart needs the confirmation box', async () => {
  const { gladys, bbox } = await connect(await setup());
  const refused = await gladys.fake.action('reboot', {});
  assert.deepEqual(refused, { success: true, data: { message: TEXTS.action.reboot_unconfirmed } });
  assert.deepEqual(bbox.writes, []);
  const done = await gladys.fake.action('reboot', { confirm: true });
  assert.equal(done.success, true);
  assert.deepEqual(bbox.writes, [{ method: 'POST', route: 'device/reboot', form: {} }]);
});

test('the connection test shows the model, firmware and Internet state', async () => {
  const { gladys } = await connect(await setup());
  const ack = await gladys.fake.action('test_connection');
  assert.equal(ack.success, true);
  assert.equal(
    ack.data.message.fr,
    'Connecté à la Bbox F@st5688b (micrologiciel 24.0.12). Internet : connecté.',
  );
});

test('a wrong password: localized status, and no new login attempt', async () => {
  const context = await setup({ config: { password: 'wrong' } });
  const { gladys, app, bbox } = await connect(context);
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: TEXTS.status.wrong_password,
  });
  await app.refresh();
  assert.equal(bbox.logins, 1);
  const ack = await gladys.fake.action('test_connection');
  assert.equal(ack.success, false);
  assert.equal(ack.error, TEXTS.status.wrong_password.fr);
});

test('a new password in the configuration is tried', async () => {
  const context = await setup({ config: { password: 'wrong' } });
  const { gladys, bbox } = await connect(context);
  await gladys.fake.configUpdated({ password: 'correct-horse-battery' });
  context.app.stop();
  assert.equal(bbox.logins, 2);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('no password: nothing is asked to the Bbox', async () => {
  const { gladys, bbox } = await connect(await setup({ config: { password: '' } }));
  assert.equal(bbox.requests.length, 0);
  assert.deepEqual(gladys.fake.connectionStatus.message, TEXTS.status.missing_password);
});

test('the widget content fits the core vocabulary in every language', async () => {
  const { gladys } = await connect(await setup());
  const ids = boxIds(gladys, SERIAL);
  const created = new Set(discovered(gladys, ids.device).features.map((f) => f.external_id));
  for (const language of ['en', 'fr', 'de', 'es']) {
    const ack = await gladys.fake.widgetGet(BBOX_WIDGET, { language });
    assert.equal(ack.success, true);
    const { content } = ack.data;
    assert.deepEqual(validateWidgetContent(content), [], language);
    // The SDK validator does not check that bound features exist.
    for (const component of content.components) {
      if (component.device_feature) {
        assert.ok(created.has(component.device_feature), component.device_feature);
      }
    }
  }
});

test('the widget waits for a first reading', async () => {
  const { gladys } = await connect(await setup({ config: { password: '' } }));
  const ack = await gladys.fake.widgetGet(BBOX_WIDGET, { language: 'fr' });
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  assert.equal(ack.data.content.components[0].text, TEXTS.widget.waiting.fr);
});

test('the widget is nudged only when its computed part changes', async () => {
  const { gladys, app, bbox } = await connect(await setup());
  const nudges = gladys.fake.widgetRefreshes.length;
  bbox.routes['wan/ip/stats'][0].wan.ip.stats.rx.bandwidth = 99000; // a live tile
  await app.refresh();
  assert.equal(gladys.fake.widgetRefreshes.length, nudges);
  bbox.routes.wireless[0].wireless.radio['24'].enable = 0; // a status row
  await app.refresh();
  assert.equal(gladys.fake.widgetRefreshes.length, nudges + 1);
});

test('an older xDSL Bbox: no guest Wi-Fi nor telephony features', async () => {
  const { gladys } = await connect(await setup({ fixture: 'vdsl' }));
  const box = discovered(gladys, boxIds(gladys, 'testserial0002').device);
  const keys = box.features.map((feature) => feature.external_id.split(':').pop());
  assert.ok(!keys.includes(FEATURE.WIFI_GUEST));
  assert.ok(!keys.includes(FEATURE.MISSED_CALLS));
  assert.ok(keys.includes(FEATURE.TEMPERATURE));
  assert.equal(
    gladys.fake.lastState(boxIds(gladys, 'testserial0002').feature(FEATURE.LINE_TYPE)),
    'VDSL2',
  );
});
