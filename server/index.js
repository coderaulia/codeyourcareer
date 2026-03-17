import { createApp, bootstrapAdminFromEnv } from './app.js';
import { getDeployInfo, logError, logInfo } from './logger.js';

const { app, config } = createApp();

if (config.adminEmail && config.adminPassword) {
  void bootstrapAdminFromEnv(config).catch((error) => {
    logError('admin_bootstrap_failed', error);
  });
}

process.on('unhandledRejection', (error) => {
  logError('unhandled_rejection', error);
});

process.on('uncaughtException', (error) => {
  logError('uncaught_exception', error);
});

app.listen(config.port, () => {
  logInfo('server_started', {
    port: config.port,
    ...getDeployInfo(),
  });
});
