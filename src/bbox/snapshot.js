// -----------------------------------------------------------------------------
// One reading of the Bbox: the API answers turned into a flat snapshot.
//
// Field names follow the API Bbox (api/v1) as the Bbox web interface and the
// open-source clients use it (pybbox, bboxapi-router, bbox-cli, hass-bbox2:
// see the README credits). The parsing is defensive: models and firmwares do
// not all expose every field, and a value the box does not give is `null`,
// never a guess.
//
// Units: the API gives the line and the WAN throughput in kbit/s; the snapshot
// holds Mbit/s. The uptime is in seconds.
// -----------------------------------------------------------------------------

import { first } from './client.js';

/**
 * Read every route of a reading. `/device` and `/wan/ip` are mandatory (no
 * snapshot without them); the other routes are optional, a model without
 * telephony or without guest Wi-Fi answers 404 there.
 */
export async function readSnapshot(client, { logger } = {}) {
  const optional = async (route) => {
    try {
      return await client.get(route);
    } catch (err) {
      if (err.kind === 'api_error') {
        logger?.debug(`Optional route ${route} unavailable: ${err.message}`);
        return null;
      }
      // Lost connection or session: the whole reading fails.
      throw err;
    }
  };

  const device = first(await client.get('device')).device ?? {};
  const wan = first(await client.get('wan/ip')).wan ?? {};
  const stats = first(await optional('wan/ip/stats')).wan?.ip?.stats ?? null;
  const lineType = detectLineType(device, wan);
  const ftth = lineType === 'ftth' ? first(await optional('wan/ftth')).wan?.ftth : null;
  const xdsl =
    lineType === 'adsl' || lineType === 'vdsl' ? first(await optional('wan/xdsl')).wan?.xdsl : null;
  const wireless = first(await optional('wireless')).wireless ?? null;
  const voip = first(await optional('voip')).voip ?? null;
  const hosts = await optional('hosts');
  // Older models give the temperature in /device, others only in /device/cpu.
  const cpu =
    typeof device.temperature?.current === 'number'
      ? null
      : first(await optional('device/cpu')).device?.cpu;

  return buildSnapshot({ device, wan, stats, lineType, ftth, xdsl, wireless, voip, hosts, cpu });
}

/** Pure part of the reading, tested against recorded answers. */
export function buildSnapshot({
  device,
  wan,
  stats,
  lineType,
  ftth,
  xdsl,
  wireless,
  voip,
  hosts,
  cpu,
}) {
  const ip = wan.ip ?? {};
  const isXdsl = lineType === 'adsl' || lineType === 'vdsl';
  return {
    // The serial number identifies the box (external ids); the WAN MAC
    // address stands in on the rare firmware that hides it.
    serial: nonEmpty(device.serialnumber) ?? normalizeMac(ip.mac),
    model: nonEmpty(device.modelname),
    firmware: nonEmpty(device.main?.version) ?? nonEmpty(device.running?.version),
    uptime: finite(device.uptime),
    temperature: readTemperature(device, cpu),
    lineType,
    lineSync: readLineSync(lineType, ftth, xdsl, wan),
    syncDown: isXdsl ? kbitToMbit(xdsl?.down?.bitrates) : kbitToMbit(stats?.rx?.maxBandwidth),
    syncUp: isXdsl ? kbitToMbit(xdsl?.up?.bitrates) : kbitToMbit(stats?.tx?.maxBandwidth),
    internet: typeof ip.state === 'string' ? ip.state.toLowerCase() === 'up' : null,
    ipv4: nonEmpty(ip.address),
    ipv6: readIpv6(ip),
    rateDown: kbitToMbit(stats?.rx?.bandwidth),
    rateUp: kbitToMbit(stats?.tx?.bandwidth),
    wifi24: readEnable(wireless?.radio?.['24']),
    wifi5: readEnable(wireless?.radio?.['5']),
    wifiGuest: readEnable(wireless?.radio?.guest) ?? readEnable(wireless?.ssid?.guest),
    voipLines: readVoipLines(voip),
    missedCalls: readMissedCalls(voip),
    hosts: readHosts(hosts),
  };
}

export function detectLineType(device, wan) {
  const using = device.using ?? {};
  if (using.ftth === 1) {
    return 'ftth';
  }
  if (using.vdsl === 1) {
    return 'vdsl';
  }
  if (using.adsl === 1) {
    return 'adsl';
  }
  const linkType = wan.link?.type;
  if (typeof linkType === 'string' && linkType !== '') {
    return linkType.toLowerCase();
  }
  return null;
}

function readLineSync(lineType, ftth, xdsl, wan) {
  if (lineType === 'ftth' && typeof ftth?.state === 'string') {
    return ftth.state.toLowerCase() === 'up';
  }
  if ((lineType === 'adsl' || lineType === 'vdsl') && typeof xdsl?.state === 'string') {
    return ['connected', 'showtime', 'up'].includes(xdsl.state.toLowerCase());
  }
  if (typeof wan.link?.state === 'string') {
    return wan.link.state.toLowerCase() === 'up';
  }
  return null;
}

function readTemperature(device, cpu) {
  if (typeof device.temperature?.current === 'number') {
    return round(device.temperature.current, 1);
  }
  // In thousandths of a degree there (46407 = 46.4 °C).
  const main = cpu?.temperature?.main;
  if (typeof main === 'number' && main > 0) {
    return round(main / 1000, 1);
  }
  return null;
}

function readIpv6(ip) {
  const addresses = Array.isArray(ip.ip6address) ? ip.ip6address : [];
  for (const entry of addresses) {
    const address = nonEmpty(entry?.ipaddress);
    if (address) {
      return address;
    }
  }
  return null;
}

function readEnable(section) {
  if (section === undefined || section === null || section.enable === undefined) {
    return null;
  }
  return Number(section.enable) === 1;
}

function readVoipLines(voip) {
  if (!Array.isArray(voip)) {
    return [];
  }
  return voip
    .filter((line) => line && typeof line === 'object')
    .map((line) => ({ id: line.id, notAnswered: finite(line.notanswered) ?? 0 }));
}

function readMissedCalls(voip) {
  if (!Array.isArray(voip) || voip.length === 0) {
    return null;
  }
  return voip.reduce((total, line) => total + (finite(line?.notanswered) ?? 0), 0);
}

// The answer of /hosts can come as several array elements, each carrying a
// part of the list: merge them.
function readHosts(answer) {
  if (answer === null || answer === undefined) {
    return null;
  }
  const parts = Array.isArray(answer) ? answer : [answer];
  const byMac = new Map();
  for (const part of parts) {
    for (const host of part?.hosts?.list ?? []) {
      const mac = normalizeMac(host?.macaddress);
      if (!mac) {
        continue;
      }
      byMac.set(mac, {
        mac,
        name: nonEmpty(host.hostname) ?? nonEmpty(host.userfriendlyname) ?? null,
        ip: nonEmpty(host.ipaddress),
        active: Number(host.active) === 1,
      });
    }
  }
  return [...byMac.values()];
}

/** Lower-case colon form, or null for a missing or all-zero address. */
export function normalizeMac(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const hex = value.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (hex.length !== 12 || /^0+$/.test(hex) || /^f+$/.test(hex)) {
    return null;
  }
  return hex.match(/../g).join(':');
}

function kbitToMbit(value) {
  const kbit = finite(value);
  return kbit === null ? null : round(kbit / 1000, 2);
}

function finite(value) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
}

function nonEmpty(value) {
  if (typeof value === 'number') {
    return String(value);
  }
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
