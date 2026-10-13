// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+). The triggers
// ("Internet connection lost / restored") are fired by src/monitor.js.
//
// Throwing fails this action only: the scene logs it and goes on.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'scenes' });

export function createSceneActions({ monitor }) {
  return {
    // The scene author chose to reboot: no confirmation here. The monitor
    // mutes the connection triggers during the reboot (no scene loop).
    async reboot_box() {
      // monitor.reboot() writes the info line: one line per action.
      logger.debug('Scene action reboot_box');
      await monitor.reboot();
    },
  };
}
