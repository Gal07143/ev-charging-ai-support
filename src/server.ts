import { serve } from '@hono/node-server';
import app from './index';
import { startDiscordBot, stopDiscordBot } from './triggers/discordTriggers';
import { initializeMastra } from './mastra';
import { startMessageWorker, stopMessageWorker } from './utils/messageQueue';
import { getStationMonitoring } from './services/stationMonitoring';
import { logger } from './utils/logger';

const port = Number(process.env.PORT) || 3000;

async function startServer() {
  try {
    logger.info('🚀 Starting Edge Control Support System...');

    // Initialize Mastra
    await initializeMastra();

    // Start message queue worker
    startMessageWorker();

    // Start station monitoring service
    const stationMonitoring = getStationMonitoring();
    await stationMonitoring.start();
    logger.info('✅ Station monitoring service started');

    // Start Discord bot
    await startDiscordBot();

    // Start HTTP server
    serve({
      fetch: app.fetch,
      port,
    });

    logger.info({ port }, '✅ Server is running');
  } catch (error) {
    logger.error({ error }, '❌ Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('⏳ Shutting down gracefully...');
  
  try {
    const stationMonitoring = getStationMonitoring();
    stationMonitoring.stop();
    
    await stopDiscordBot();
    await stopMessageWorker();
    logger.info('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();
