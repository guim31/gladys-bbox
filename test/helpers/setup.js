// Run the real wiring of src/app.js against the SDK's fake Gladys and an
// in-memory Bbox.

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../../src/app.js';
import { createBboxClient } from '../../src/bbox/client.js';
import { PASSWORD, createFakeBbox } from './fakeBbox.js';

export async function setup({
  fixture = 'ftth',
  config = {},
  devices = [],
  logger = createLogger({ level: 'silent' }),
  now,
} = {}) {
  const bbox = createFakeBbox(fixture);
  const gladys = createFakeGladys({ config: { password: PASSWORD, ...config }, devices });
  const dataDir = await mkdtemp(path.join(tmpdir(), 'gladys-bbox-'));
  const app = createApp(gladys, {
    createClient: (cfg) => createBboxClient({ transport: bbox.transport, password: cfg.password }),
    dataDir,
    logger,
    now,
  });
  app.register();
  return { gladys, app, bbox, dataDir };
}

/** Connect, then stop the reading timer: the tests drive the readings. */
export async function connect(context) {
  await context.gladys.connect();
  context.app.stop();
  return context;
}

/** The discovered device with this external id. */
export function discovered(gladys, externalId) {
  return gladys.fake.discoveredDevices.find((device) => device.external_id === externalId);
}
