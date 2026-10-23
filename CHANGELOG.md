# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- Widget setting **Rows to show** (« Lignes à afficher ») : pick the tiles, status
  rows and guest Wi-Fi button the widget shows; left empty, it shows everything.

## [1.0.2] - 2026-10-13

### Added

- Documentation in German and Spanish (`docs/de.md`, `docs/es.md`), published
  by the store from Gladys 5.2.

### Changed

- Calmer logs: a normal reading writes nothing at info level any more. Info
  keeps the connection to the Bbox, the loss and return of Internet and the
  user actions; a failure that repeats writes one line when it starts and one
  when it ends; the rest is at debug level (`LOG_LEVEL=debug`).

## [1.0.1] - 2026-10-13

### Added

- First version of the Bbox integration: a **Bbox** device with the Internet
  connection, line synchronization and type, synchronized and instantaneous
  rates, public IPv4 and IPv6, model, firmware, uptime, temperature, connected
  devices count and missed calls, read from the local API of the box.
- Wi-Fi 2.4 GHz, 5 GHz and guest Wi-Fi switches.
- Presence of the devices the Bbox knows, by MAC address, to add from the
  Discovery tab.
- **Test the connection** and **Restart the Bbox** (with a confirmation
  checkbox) actions.
- Scene triggers: Internet connection lost, Internet connection restored,
  missed call.
- **Bbox** dashboard widget.
- Texts in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-bbox/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/guim31/gladys-bbox/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/guim31/gladys-bbox/releases/tag/v1.0.1
