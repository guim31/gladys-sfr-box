# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-13

### Added

- First version of the SFR Box integration, on the local API of the box (NB4
  to NB6VAC documented; newer boxes untested). Not affiliated with SFR.
- The "SFR Box" device: Internet connection, IPv6, public IPv4 address, line
  type, DSL synchronization, rates, attenuation and noise margin, fibre line
  status, Wi-Fi state (with the administrator password), uptime, temperature,
  model and firmware.
- Presence of the devices connected to the box, by MAC address.
- "Internet connection lost" and "Internet connection restored" scene
  triggers, the "Reboot the SFR Box" scene action, and the "Test the
  connection" and "Reboot the box" configuration actions.
- The "SFR Box" dashboard widget, with an optional reboot button.
- Texts in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-sfr-box/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-sfr-box/releases/tag/v1.0.1
