// -----------------------------------------------------------------------------
// Entry point of the SFR Box integration for Gladys Assistant.
//
// The SDK reads GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN and
// GLADYS_INTEGRATION_SELECTOR from the environment the supervisor provides.
// Everything else lives in src/ (wiring in src/app.js).
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/app.js';

const gladys = new GladysIntegration();
const { monitor } = registerHandlers(gladys);

gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  monitor.stop();
});

logger.info('Starting the SFR Box integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
