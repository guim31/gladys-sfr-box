# SFR Box

Follow your SFR Box from Gladys: line, Internet connection, Wi-Fi, connected
devices, and reboot it from a scene or the dashboard. Everything stays on your
local network: Gladys reads the box once a minute through its local API, with
no cloud account.

> **Developed without the hardware: feedback welcome.** This integration was
> written from the public documentation of the box API and from real answers
> collected by the open-source library
> [hacf-fr/sfrbox-api](https://github.com/hacf-fr/sfrbox-api) (Home Assistant).
> If something is missing or wrong on your box, please open an issue with your
> model and firmware (shown by the **Test the connection** button).
>
> This integration is not affiliated with SFR.

## Compatible boxes

The box must expose the local "neufbox" API (`http://192.168.1.1/api/1.0/`).

| Box                                       | Status                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| NB4, NB5, NB6, NB6V, NB6VAC               | The API is documented for these models.                                                                                                        |
| Newer firmwares (`BOX10H`, `3DCM` / FTTB) | System information confirmed by real answers; the rest is untested.                                                                            |
| SFR Box 8 and 8X                          | Unknown: not listed by the API documentation nor by Home Assistant. The newer firmwares above suggest it may answer. Your feedback is welcome. |
| Boxes without this API (e.g. `NCC`)       | Not supported.                                                                                                                                 |

## Prerequisites

- Gladys 5.1 or later.
- Gladys and the box on the same local network.
- Optional: the **administrator password** of the box. By default it is the
  Wi-Fi key printed on the label of the box, unless you changed it in the box
  interface (`http://192.168.1.1`).

## Configuration

1. Install the integration from the Gladys catalog, then open its
   **Configuration** tab.
2. **Box address**: `192.168.1.1` unless your network uses another one.
3. **Administrator login** (`admin`) and **password**: optional. Without them,
   you get the line, the Internet connection and the system information. With
   them, you also get the Wi-Fi state and the reboot.
4. **Discover the connected devices**: lists the devices the box sees, for
   presence detection.
5. **Language of the feature names**: the names given to the features when you
   add a device (they cannot change afterwards).
6. Save, then click **Test the connection**: the result shows the model, the
   firmware, the line, the number of connected devices and whether the password
   was accepted.
7. Open the **Discovery** tab and add the **SFR Box** device, and the connected
   devices you want to follow.

The password is stored by Gladys and is never written in the logs.

## What you get

**The "SFR Box" device**

| Feature                                   | When                                  |
| ----------------------------------------- | ------------------------------------- |
| Internet connection (connected or not)    | always                                |
| IPv6 connection                           | always                                |
| Public IPv4 address                       | always                                |
| Line type (ADSL, FTTH…)                   | always                                |
| DSL line synchronized                     | DSL line                              |
| DSL download and upload rates (kbit/s)    | DSL line                              |
| Attenuation and noise margin, down and up | DSL line                              |
| Fibre line up                             | fibre line                            |
| Wi-Fi enabled                             | with the administrator password       |
| Box uptime (hours)                        | always                                |
| Box temperature                           | when the box has a temperature sensor |
| Model, firmware                           | always                                |

The fibre line exposes no rate through this API: rates are for DSL only. If
you add the password later or your line moves to fibre, the **Discovery** tab
offers to **Update** the device.

**Connected devices (presence)**

Each device the box sees can be added as a Gladys device with a **Presence**
feature, shown as "seen N minutes ago". It is refreshed when the device appears
on the network, then every 5 minutes while it stays connected. To mark someone
as away, use the Gladys scene action **Check user presence** with a delay of
**10 minutes or more**.

Phones often use a **private (random) Wi-Fi address** per network: turn it off
for your home network in the phone's Wi-Fi settings, or the device will show up
under a new address. Depending on the firmware, the box may only give this list
with the administrator password.

## Scenes

- **Internet connection lost** (trigger): the box reports its Internet
  connection down. Not fired during a reboot asked through Gladys.
- **Internet connection restored** (trigger): the connection is back. The
  following actions can read the outage duration with
  `{{triggerEvent.data.outage_seconds}}` (about one minute of precision, empty
  when the outage started before Gladys was watching).
- **Reboot the SFR Box** (action): Internet, TV and phone are cut for a few
  minutes. Needs the administrator password.

These triggers rely on the box's own report: if the box itself is unreachable
(powered off, rebooting), nothing is fired.

## Dashboard

The **SFR Box** widget shows the Internet connection, the line state, the DSL
rates, the uptime and the temperature. Its **Show a reboot button** setting
adds a reboot button, with a confirmation, when the password is configured.

## Actions

- **Test the connection**: reads the box now and checks the password.
- **Reboot the box**: tick **I confirm the reboot**, then run the action.

## Troubleshooting

- **"SFR Box unreachable"**: check the address, and that Gladys runs on the
  same network as the box (a VPN or a second router in between prevents the
  access).
- **"Password refused by the box"**: check the password in the box interface.
  Gladys stops trying after a refusal, to avoid locking the account: save the
  configuration again to retry.
- **"The box only accepts authentication by its button"**: the box disables
  password authentication. Enable it in the box interface to use the Wi-Fi
  state and the reboot.
- A value stays empty: your firmware may not provide it. Run **Test the
  connection** and share the result in an issue.
- The integration logs are available in Gladys (integration page). Set
  `LOG_LEVEL=debug` for more detail; passwords and tokens are never logged.
