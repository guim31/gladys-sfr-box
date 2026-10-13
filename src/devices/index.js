// -----------------------------------------------------------------------------
// Discovery: the box, then one device per connected device it knows (when the
// configuration asks for them and the API gives them).
// -----------------------------------------------------------------------------

import { buildBoxDevice } from './box.js';
import { buildHostDevice } from './host.js';

export function buildDiscoveredDevices(gladys, snapshot, config) {
  if (!snapshot) {
    return [];
  }
  return [
    buildBoxDevice(gladys, snapshot, config),
    ...(config.discover_hosts ? (snapshot.hosts ?? []) : []).map((host) =>
      buildHostDevice(gladys, host, config),
    ),
  ];
}
