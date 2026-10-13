# Bbox for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration for the
**Bouygues Telecom Bbox**: line and Internet state, throughput, Wi-Fi, connected
devices (presence) and missed calls, read from the local API of the box. No
cloud, no account other than the box's administrator password.

> This project is independent and **not affiliated with, endorsed by or
> supported by Bouygues Telecom**. "Bbox" and "Bouygues Telecom" are trademarks
> of their owners, used here only to name the hardware the integration talks
> to.

**Developed without the hardware: feedback welcome.** The integration was
written from the API documentation and the open-source clients listed below,
and tested against recorded answers only. Please open an issue with your Bbox
model and the integration logs if something is missing or wrong.

User documentation: [English](docs/en.md) · [Français](docs/fr.md).

## What it does

| Gladys surface   | Content                                                                                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Device **Bbox**  | Internet connected, line synchronized, line type, synchronized rates, instantaneous download/upload rates, public IPv4, IPv6, model, firmware, uptime, temperature¹, connected devices count, Wi-Fi 2.4 GHz / 5 GHz / guest¹ switches, missed calls¹ |
| Presence devices | One per host the Bbox knows (MAC address), `presence-sensor/push`, opt-in from the Discovery tab                                                                                                                                                     |
| Actions          | **Test the connection**; **Restart the Bbox** (confirmation checkbox)                                                                                                                                                                                |
| Scene triggers   | `connection_lost`, `connection_restored` (downtime, IPv4), `missed_call` (caller number, count)                                                                                                                                                      |
| Widget           | **Bbox**: live throughput and devices tiles, status rows, guest Wi-Fi button                                                                                                                                                                         |

¹ Only when the model exposes it: detected at the first reading, remembered in
`/data/capabilities.json` so a feature never comes and goes.

The box is read every 60 seconds by default (configurable, never faster), by a
timer inside the container (`should_poll: false`). Only changed values are
published; everything is published again when the user adds a device.

### Models

The integration uses the local API shared by the Sagemcom-made Bbox routers
(`https://mabbox.bytel.fr/api/v1`). The recorded answers it is tested against
come from the **Bbox Fibre (F@st5330b)** and the **Wi-Fi 6 generation
(F@st5688b)**, through the public fixtures of the projects credited below. The
**Bbox Miami, Ultym, Must, Wi-Fi 6 and Wi-Fi 7** expose the same API but none
was tried on real hardware; the 6 GHz band of the Wi-Fi 7 box is not handled
yet.

## The Bbox API

- Official documentation ("API Bbox", Bouygues Telecom):
  <https://api.bbox.fr/doc/apirouter/index.html>. The page has been unreachable
  at times; the open-source clients below follow it.
- Base URL `https://mabbox.bytel.fr/api/v1`. Reads are `GET`; writes are
  `PUT`/`POST` with a short-lived `btoken` from `GET /device/token`. A session
  comes from `POST /login` (administrator password) as the `BBOX_ID` cookie.
- Routes used: `login`, `device`, `device/cpu`, `device/token`,
  `device/reboot`, `wan/ip`, `wan/ip/stats`, `wan/ftth`, `wan/xdsl`,
  `wireless`, `wireless/24`, `wireless/5`, `wireless/guestenable`, `voip`,
  `voip/fullcalllog/<line>`, `hosts`.

### TLS

The box serves its API with a certificate issued for `mabbox.bytel.fr`, a name
only the box's own DNS server resolves. The integration connects to the
configured address (`192.168.1.254` by default) and verifies the certificate
for `mabbox.bytel.fr` (SNI and host name check), so it works even when the
Gladys host uses another DNS server. Verification is on by default; the only
way to turn it off is the explicit **Certificate check: Do not verify**
setting, documented for boxes whose certificate chain Node cannot validate
(reported by users of other clients), and logged as a warning at every start.

## Credits

The protocol knowledge comes from these projects, read to understand the API
(no code copied):

- [HydrelioxGitHub/pybbox](https://github.com/HydrelioxGitHub/pybbox) (MIT),
  the library of the former Home Assistant "Bbox" integration;
- [bertrandmartel/bboxapi-router](https://github.com/bertrandmartel/bboxapi-router)
  (MIT), whose public fixtures shaped the recorded answers of the tests;
- [hadamrd/bbox-cli](https://github.com/hadamrd/bbox-cli) (MIT), the most
  recent description of the login, token and Wi-Fi routes;
- [Cyr-ius/hass-bbox2](https://github.com/Cyr-ius/hass-bbox2) (MIT) and
  [Cyr-ius/bboxpy](https://github.com/Cyr-ius/bboxpy) (GPL-3.0, read only):
  temperature, throughput units and certificate handling.

Thanks to their authors.

## Development

Node.js 22 or later, ESM, no build step; the only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test                 # node --test, against the SDK's fake Gladys and an in-memory Bbox
npm run lint             # ESLint
npm run format:check     # Prettier, as the CI runs it
npx github:GladysAssistant/integration-store .   # store admission checks
```

```
index.js                 SDK wiring only
src/app.js               reading loop, states, presence, triggers, commands, actions
src/bbox/client.js       API client: login, session, token, error kinds
src/bbox/transport.js    HTTPS to the box, certificate checked for mabbox.bytel.fr
src/bbox/snapshot.js     one reading: API answers -> flat snapshot
src/devices.js           published devices and their states
src/triggers.js          scene triggers
src/widget.js            dashboard widget
src/capabilities.js      model capabilities, remembered in /data
src/i18n.js              user texts (en, fr, de, es)
test/                    node --test; recorded answers in test/fixtures/bbox/
```

`test/gladys-rules.test.js` checks every published feature against the table
of the Gladys core (`test/fixtures/gladys-feature-table.json`);
`test/i18n.test.js` checks the four languages; `test/secrets.test.js` checks
that the password, the session cookie and the token never reach the logs nor
`/data`.

Run it against a real Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="bbox" \
DATA_DIR=./data LOG_LEVEL=debug \
npm start
```

## Releases

Versions belong to the **Release** workflow (Actions → Release): it bumps
`package.json`, the manifest `version` and `docker_image` tag, moves the
`## [Unreleased]` section of [`CHANGELOG.md`](CHANGELOG.md), tags, builds the
multi-arch image to `ghcr.io/guim31/gladys-bbox` and publishes the GitHub
Release. A hand-pushed `vX.Y.Z` tag also builds, but then bump the three
version fields yourself and commit them before tagging.

## License

Apache-2.0
