# SFR Box API fixtures

Answers of the local SFR Box API (`/api/1.0/`), in the shape of the real ones
collected by [hacf-fr/sfrbox-api](https://github.com/hacf-fr/sfrbox-api) (MIT,
© 2022 HACF Home Assistant Communauté Francophone), with every identifying value
replaced by a fake one: MAC addresses are locally administered (`02:…`), the
public IP is a documentation address (RFC 5737), serials, SSID and Wi-Fi key
are made up. The `3dcm` files keep the malformed `dsl.getInfo` of firmware
3DCM020200r015 (an unclosed tag closed by `</firewall>`).

The `lan.getHostsList` answer follows the documented format of the neufbox API
(`name`, `ip`, `mac`, `iface`, `probe`, `alive`, `type`, `status`): it was not
captured on a real box.
