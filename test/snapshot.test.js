import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBboxClient } from '../src/bbox/client.js';
import { normalizeMac, readSnapshot } from '../src/bbox/snapshot.js';
import { PASSWORD, createFakeBbox } from './helpers/fakeBbox.js';

async function snapshotOf(fixture, mutate) {
  const fake = createFakeBbox(fixture);
  mutate?.(fake.routes);
  const client = createBboxClient({ transport: fake.transport, password: PASSWORD });
  return { snapshot: await readSnapshot(client), fake };
}

test('a fibre Bbox reading', async () => {
  const { snapshot } = await snapshotOf('ftth');
  assert.deepEqual(snapshot, {
    serial: 'TESTSERIAL0001',
    model: 'F@st5688b',
    firmware: '24.0.12',
    uptime: 432000,
    temperature: 46.4,
    lineType: 'ftth',
    lineSync: true,
    syncDown: 2000,
    syncUp: 900,
    internet: true,
    ipv4: '203.0.113.42',
    ipv6: '2001:db8::42',
    rateDown: 12.5,
    rateUp: 3.25,
    wifi24: true,
    wifi5: true,
    wifiGuest: false,
    voipLines: [{ id: 1, notAnswered: 2 }],
    missedCalls: 2,
    hosts: [
      { mac: '02:00:00:00:10:01', name: 'phone-alice', ip: '192.0.2.10', active: true },
      { mac: '02:00:00:00:10:02', name: 'laptop', ip: '192.0.2.11', active: false },
    ],
  });
});

test('an xDSL Bbox reading: synchronized rates from /wan/xdsl, no telephony', async () => {
  const { snapshot, fake } = await snapshotOf('vdsl');
  assert.equal(snapshot.lineType, 'vdsl');
  assert.equal(snapshot.lineSync, true);
  assert.equal(snapshot.syncDown, 52);
  assert.equal(snapshot.syncUp, 8);
  // Given by /device on this model: /device/cpu is not even asked.
  assert.equal(snapshot.temperature, 51.3);
  assert.ok(!fake.requests.some((request) => request.path === '/api/v1/device/cpu'));
  assert.equal(snapshot.wifiGuest, null);
  assert.equal(snapshot.missedCalls, null);
  assert.equal(snapshot.ipv6, null);
  assert.deepEqual(snapshot.hosts, []);
});

test('a line out of sync and a WAN down', async () => {
  const { snapshot } = await snapshotOf('ftth', (routes) => {
    routes['wan/ftth'][0].wan.ftth.state = 'Down';
    routes['wan/ip'][0].wan.ip.state = 'Down';
  });
  assert.equal(snapshot.lineSync, false);
  assert.equal(snapshot.internet, false);
});

test('an optional route that answers an error leaves its values unknown', async () => {
  const { snapshot } = await snapshotOf('ftth', (routes) => {
    delete routes['wan/ip/stats'];
    delete routes.voip;
  });
  assert.equal(snapshot.rateDown, null);
  assert.equal(snapshot.syncDown, null);
  assert.equal(snapshot.missedCalls, null);
  assert.equal(snapshot.internet, true);
});

test('the reading fails without /device or /wan/ip', async () => {
  const fake = createFakeBbox();
  delete fake.routes['wan/ip'];
  const client = createBboxClient({ transport: fake.transport, password: PASSWORD });
  await assert.rejects(readSnapshot(client), { kind: 'api_error' });
});

test('the serial number falls back to the WAN MAC address', async () => {
  const { snapshot } = await snapshotOf('ftth', (routes) => {
    delete routes.device[0].device.serialnumber;
  });
  assert.equal(snapshot.serial, '02:00:00:00:00:01');
});

test('normalizeMac', () => {
  assert.equal(normalizeMac('02-00-00-AA-BB-CC'), '02:00:00:aa:bb:cc');
  assert.equal(normalizeMac('00:00:00:00:00:00'), null);
  assert.equal(normalizeMac('ff:ff:ff:ff:ff:ff'), null);
  assert.equal(normalizeMac('not a mac'), null);
  assert.equal(normalizeMac(undefined), null);
});
