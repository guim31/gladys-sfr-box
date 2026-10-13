# SFR Box for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that
follows an SFR Box on the local network: DSL or fibre line, Internet connection
(IPv4, IPv6, public address), system information, Wi-Fi state, presence of the
connected devices, a reboot action, "Internet connection lost / restored" scene
triggers and a dashboard widget.

> **This project is not affiliated with, endorsed by or sponsored by SFR.** "SFR"
> and "SFR Box" are trademarks of their owner, used here only to name the
> hardware the integration talks to.
>
> **Developed without the hardware: feedback welcome.** See the user
> documentation for the models covered and how to report what your box returns.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## How it works

The box exposes a local REST API, historically the "neufbox" API:
`http://192.168.1.1/api/1.0/?method=<namespace>.<method>`, answering XML.

| Method             | Access                        | Used for                                                    |
| ------------------ | ----------------------------- | ----------------------------------------------------------- |
| `system.getInfo`   | public                        | model, firmware, uptime, temperature, MAC                   |
| `wan.getInfo`      | public                        | Internet status, public IPv4, IPv6 status                   |
| `dsl.getInfo`      | public                        | DSL sync, rates, attenuation, noise margin                  |
| `ftth.getInfo`     | public                        | fibre link status                                           |
| `lan.getHostsList` | public, private on some boxes | connected devices (presence)                                |
| `wlan.getInfo`     | token                         | Wi-Fi enabled (the Wi-Fi keys are dropped)                  |
| `system.reboot`    | token, POST                   | reboot                                                      |
| `auth.getToken`    | public                        | authentication challenge                                    |
| `auth.checkToken`  | public                        | `HMAC-SHA256(token, SHA256(login))` + same for the password |

The integration reads the box every minute with its own timer (Gladys polls at
most once a minute, and the presence of a phone must not depend on the box
device being added), and publishes only the values that changed. The token is
renewed every 5 minutes; after a refused password the integration stops trying
until the configuration is saved again.

## Credits

- [hacf-fr/sfrbox-api](https://github.com/hacf-fr/sfrbox-api) (MIT, © 2022 HACF
  Home Assistant Communauté Francophone): the authentication, the error codes,
  the firmware workarounds (the malformed `dsl.getInfo` of firmware
  3DCM020200r015, the temperature in milli-degrees or degrees) and the shape of
  the test fixtures are ported from this library. Its test vector for the
  authentication hash is reused in `test/sfr-client.test.js`.
- The Home Assistant [SFR Box integration](https://www.home-assistant.io/integrations/sfr_box/)
  (Apache-2.0) for the entities worth exposing and the compatibility notes.
- [sprat/neufbox-client](https://github.com/sprat/neufbox-client) (MIT) for the
  list of API methods, including `lan.getHostsList`.

## Development

Node.js 22 or later, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store .   # store admission checks
```

```
index.js                 entry point: SDK instance, shutdown, connect
src/app.js               every handler, registered before connect()
src/monitor.js           one-minute reading loop, states, presence, scene triggers
src/sfr/client.js        SFR Box API client (token authentication)
src/sfr/xml.js           minimal reader of the API answers
src/sfr/snapshot.js      one reading of the box, normalized
src/devices/box.js       the "SFR Box" device and its states
src/devices/host.js      a connected device (presence)
src/actions.js           Configuration screen actions
src/scenes.js            scene actions
src/widgets.js           dashboard widget
src/i18n.js              every user-facing text, in en / fr / de / es
test/                    node --test, against the SDK's fake Gladys and a fake box
```

The tests never touch the network: `test/helpers/fake-box.js` serves the
fixtures of `test/fixtures/sfr/` (fake identifiers only) and checks the token
authentication like the box. `test/gladys-rules.test.js` checks every device
shape against the feature table of the Gladys core, and `test/secrets.test.js`
that no password, token, hash or Wi-Fi key ever reaches the logs or Gladys.

## Releases

Releases are made with **Actions → Release** (it bumps `package.json`, the
manifest `version` and `docker_image`, moves the `## [Unreleased]` section of
[`CHANGELOG.md`](CHANGELOG.md), tags, builds the multi-arch image to
`ghcr.io/guim31/gladys-sfr-box` and publishes the GitHub Release). Never edit
the versions by hand.

A hand-pushed tag (`git tag vX.Y.Z && git push --tags`) also builds the image
and the Release, but touches no file: bump `version` in `package.json` and in
`gladys-assistant-integration.json` (with the `docker_image` tag) and commit it
**before** tagging, or the store keeps serving the old version.

## License

Apache-2.0. The ported parts of hacf-fr/sfrbox-api remain under its MIT license
notice, reproduced here:

```
MIT License

Copyright (c) 2022 HACF Home Assistant Communauté Francophone

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
